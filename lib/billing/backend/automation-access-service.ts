import "server-only";
import { randomUUID } from "node:crypto";
import { normalizeEmail } from "@/lib/instagram/backend/otp";
import { getUserById } from "@/lib/instagram/backend/users-store";
import {
  getSubscriptionByUserId,
  reserveTrialUsage,
  releaseTrialUsage,
} from "./automation-subscription-repository";
import { countReservedSince, getCycleUsed, releasePlanUsage, reservePlanUsage } from "./plan-usage-repository";
import { countAiUsageSince } from "./ai-usage-repository";
import { billingDateStr, billingDayStart } from "../billing-time";
import {
  AI_CAPTION_DAILY_CAP,
  FREE_TRIAL,
  PLAN_USAGE_WARNING_RATIO,
  cheapestAiPlan,
  formatPriceBrl,
  getPlan,
  type PlanCode,
  type PlanDefinition,
} from "../plans";
import {
  TRIAL_DAYS,
  TRIAL_DAILY_LIMIT,
  SubscriptionRequiredError,
  type AccessDenialCode,
  type AutomationAccessResult,
  type AutomationSubscriptionRecord,
} from "./billing-types";

/**
 * Único ponto do sistema que decide, para um usuário, o que o plano dele
 * libera: Piloto Automático (texto manual), IA (Piloto e botão de IA do
 * compositor) e Importador de Instagram. Nunca chama Asaas nem toca em
 * content-automation/instagram diretamente — só lê/escreve
 * automation_subscriptions e o uso por ciclo através dos repositórios.
 *
 * `content-automation-cron.ts` chama `reserveAutomationUse` como a
 * PRIMEIRA linha de `generateAndCreatePublication`; as telas/rotas chamam
 * as funções somente-leitura (`canUseAutomation`, `canUseAi`,
 * `canUseImporter`, `getBillingSummary`). Os números (preços, limites)
 * vêm SEMPRE de ../plans.ts.
 */

/** Referência usada pelo Piloto Automático na reserva da franquia (1 por execução gerada). */
export const AUTOMATION_USAGE_REFERENCE_TYPE = "AUTOMATION_RUN";

function getAutomationBillingExemptEmails(): Set<string> {
  return new Set(
    (process.env.AUTOMATION_BILLING_EXEMPT_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim())
      .filter(Boolean)
      .map(normalizeEmail),
  );
}

async function isBillingExemptUser(userId: string): Promise<boolean> {
  const exemptEmails = getAutomationBillingExemptEmails();
  if (exemptEmails.size === 0) return false;
  const user = await getUserById(userId);
  return Boolean(user?.email && exemptEmails.has(normalizeEmail(user.email)));
}

function buildExemptAccess(): AutomationAccessResult {
  return {
    allowed: true,
    status: "EXEMPT",
    reason: null,
    code: null,
    trialEndsAt: null,
    remainingToday: null,
    currentPeriodEndsAt: null,
  };
}

function evaluateAccess(existing: AutomationSubscriptionRecord | null, now: Date): AutomationAccessResult {
  if (!existing) {
    return {
      allowed: true,
      status: "NEW",
      reason: null,
      code: null,
      trialEndsAt: null,
      remainingToday: TRIAL_DAILY_LIMIT,
      currentPeriodEndsAt: null,
    };
  }

  switch (existing.status) {
    case "TRIAL": {
      if (!existing.trialEndsAt || now >= existing.trialEndsAt) {
        return {
          allowed: false,
          status: "EXPIRED",
          reason: `Seu período de teste de ${TRIAL_DAYS} dias terminou. Assine para continuar usando o Piloto Automático.`,
          code: "TRIAL_ENDED",
          trialEndsAt: existing.trialEndsAt,
          remainingToday: 0,
          currentPeriodEndsAt: null,
        };
      }
      const usedToday = existing.trialUsageDate === billingDateStr(now) ? existing.trialUsageCount : 0;
      const remainingToday = Math.max(TRIAL_DAILY_LIMIT - usedToday, 0);
      return {
        allowed: remainingToday > 0,
        status: "TRIAL",
        reason:
          remainingToday > 0
            ? null
            : `Você atingiu o limite de ${TRIAL_DAILY_LIMIT} automações de hoje. Volte amanhã ou assine para continuar.`,
        code: remainingToday > 0 ? null : "TRIAL_DAILY_LIMIT",
        trialEndsAt: existing.trialEndsAt,
        remainingToday,
        currentPeriodEndsAt: null,
      };
    }
    case "ACTIVE":
      return {
        allowed: true,
        status: "ACTIVE",
        reason: null,
        code: null,
        trialEndsAt: null,
        remainingToday: null,
        currentPeriodEndsAt: existing.currentPeriodEndsAt,
      };
    case "PENDING_PAYMENT":
      return {
        allowed: false,
        status: "PENDING_PAYMENT",
        reason: "Seu pagamento ainda está aguardando confirmação.",
        code: "PAYMENT_PENDING",
        trialEndsAt: null,
        remainingToday: 0,
        currentPeriodEndsAt: null,
      };
    case "PAST_DUE":
      return {
        allowed: false,
        status: "PAST_DUE",
        reason: "Seu pagamento está em atraso. Novas automações ficam pausadas até a confirmação — as já agendadas não são apagadas.",
        code: "PAYMENT_OVERDUE",
        trialEndsAt: null,
        remainingToday: 0,
        currentPeriodEndsAt: existing.currentPeriodEndsAt,
      };
    case "CANCELED": {
      if (existing.currentPeriodEndsAt && existing.currentPeriodEndsAt > now) {
        return {
          allowed: true,
          status: "CANCELED",
          reason: "Sua assinatura foi cancelada, mas continua ativa até o fim do período já pago.",
          code: null,
          trialEndsAt: null,
          remainingToday: null,
          currentPeriodEndsAt: existing.currentPeriodEndsAt,
        };
      }
      return {
        allowed: false,
        status: "EXPIRED",
        reason: "Sua assinatura terminou.",
        code: "SUBSCRIPTION_REQUIRED",
        trialEndsAt: null,
        remainingToday: 0,
        currentPeriodEndsAt: existing.currentPeriodEndsAt,
      };
    }
    case "EXPIRED":
    default:
      return {
        allowed: false,
        status: "EXPIRED",
        reason: "Seu período de teste ou assinatura terminou. Assine para continuar usando o Piloto Automático.",
        code: "SUBSCRIPTION_REQUIRED",
        trialEndsAt: null,
        remainingToday: 0,
        currentPeriodEndsAt: null,
      };
  }
}

/** O plano pago em vigor (assinatura ACTIVE, ou CANCELED ainda dentro do período já pago); `null` caso contrário. */
function paidPlanOf(existing: AutomationSubscriptionRecord | null, now: Date): PlanDefinition | null {
  if (!existing) return null;
  if (existing.status === "ACTIVE") return getPlan(existing.planCode);
  if (existing.status === "CANCELED" && existing.currentPeriodEndsAt && existing.currentPeriodEndsAt > now) {
    return getPlan(existing.planCode);
  }
  return null;
}

/**
 * Chave do ciclo de cobrança = data em que o ciclo termina. Quando o
 * pagamento renova, o Asaas devolve a nova data e o contador "zera" sozinho.
 * Sem data (não deveria acontecer com assinatura paga), cai para o mês civil.
 */
function cycleKeyOf(existing: AutomationSubscriptionRecord, now: Date): string {
  if (existing.currentPeriodEndsAt) return existing.currentPeriodEndsAt.toISOString().slice(0, 10);
  return `m:${billingDateStr(now).slice(0, 7)}`;
}

function aiPlanRequiredMessage(plan: PlanDefinition | null): string {
  const target = cheapestAiPlan();
  const offer = `${target.name} (${formatPriceBrl(target.priceCents)}/mês)`;
  return plan
    ? `O plano ${plan.name} não inclui geração com IA. Faça upgrade para o plano ${offer} ou use o texto manual, sem IA.`
    : `A geração com IA faz parte dos planos pagos. Assine o plano ${offer} para usar a IA.`;
}

function planLimitMessage(plan: PlanDefinition, limit: number): string {
  const next = plan.code === "CREATOR" ? getPlan("PRO") : null;
  return next
    ? `Você atingiu o limite de ${limit} publicações com IA do plano ${plan.name} neste ciclo. Faça upgrade para o plano ${next.name} (${next.aiPostsPerCycle} por ciclo) ou use o texto manual, sem limite.`
    : `Você atingiu o limite de ${limit} publicações com IA do plano ${plan.name} neste ciclo. O limite renova no próximo ciclo — o texto manual continua sem limite.`;
}

// ---------------------------------------------------------------------------
// Consultas somente-leitura
// ---------------------------------------------------------------------------

/** Somente leitura — usado pela tela do Piloto Automático para desenhar banners/avisos. Nunca reserva uso. */
export async function canUseAutomation(userId: string, now: Date = new Date()): Promise<AutomationAccessResult> {
  if (await isBillingExemptUser(userId)) {
    return buildExemptAccess();
  }
  const existing = await getSubscriptionByUserId(userId);
  return evaluateAccess(existing, now);
}

export interface FeatureAccess {
  allowed: boolean;
  code: AccessDenialCode | null;
  reason: string | null;
}

const ALLOWED: FeatureAccess = { allowed: true, code: null, reason: null };

function deny(code: AccessDenialCode, reason: string): FeatureAccess {
  return { allowed: false, code, reason };
}

/** Importador de Instagram: só planos pagos (qualquer um). O teste gratuito NÃO inclui o importador. */
export async function canUseImporter(userId: string, now: Date = new Date()): Promise<FeatureAccess> {
  if (await isBillingExemptUser(userId)) return ALLOWED;
  const existing = await getSubscriptionByUserId(userId);
  const plan = paidPlanOf(existing, now);
  if (plan?.includesImporter) return ALLOWED;
  if (existing?.status === "PAST_DUE") {
    return deny("PAYMENT_OVERDUE", "Seu pagamento está em atraso. Regularize a assinatura para voltar a usar o importador de Instagram.");
  }
  if (existing?.status === "PENDING_PAYMENT") {
    return deny("PAYMENT_PENDING", "Seu pagamento ainda está aguardando confirmação. O importador libera assim que for confirmado.");
  }
  return deny(
    "PAID_PLAN_REQUIRED",
    `O importador de Instagram faz parte dos planos pagos, a partir de ${formatPriceBrl(getPlan("AUTOMATION").priceCents)}/mês. Assine para usar.`,
  );
}

/**
 * Pode CONFIGURAR/ATIVAR uma automação com texto de IA? Só olha o plano
 * (a franquia é cobrada na hora de gerar, dentro de reserveAutomationUse):
 * planos com IA e o teste gratuito válido (inclusive quem ainda não
 * começou o teste) podem; plano sem IA, teste vencido e sem plano não.
 */
export async function canUseAiAutomation(userId: string, now: Date = new Date()): Promise<FeatureAccess> {
  if (await isBillingExemptUser(userId)) return ALLOWED;
  const existing = await getSubscriptionByUserId(userId);
  if (!existing) return ALLOWED; // teste ainda não começou: IA liberada (3 por dia, 7 dias)
  if (existing.status === "TRIAL") {
    const access = evaluateAccess(existing, now);
    return access.status === "EXPIRED" ? deny("TRIAL_ENDED", aiPlanRequiredMessage(null)) : ALLOWED;
  }
  const plan =
    paidPlanOf(existing, now) ??
    (existing.status === "PAST_DUE" || existing.status === "PENDING_PAYMENT" ? getPlan(existing.planCode) : null);
  if (plan?.includesAi) return ALLOWED;
  return deny("AI_PLAN_REQUIRED", aiPlanRequiredMessage(plan));
}

/**
 * Botão de IA do compositor (legenda avulsa com IA). Libera para planos com
 * IA e para quem está no teste gratuito válido; quem nunca começou o teste
 * ou tem plano sem IA recebe o convite de upgrade. Respeita o teto diário
 * de legendas (não consome a franquia de publicações do Piloto).
 */
export async function canUseAiCaption(userId: string, now: Date = new Date()): Promise<FeatureAccess> {
  const exempt = await isBillingExemptUser(userId);
  if (!exempt) {
    const existing = await getSubscriptionByUserId(userId);
    const plan = paidPlanOf(existing, now);
    if (plan) {
      if (!plan.includesAi) return deny("AI_PLAN_REQUIRED", aiPlanRequiredMessage(plan));
    } else if (existing?.status === "TRIAL") {
      const access = evaluateAccess(existing, now);
      if (access.status === "EXPIRED") return deny("TRIAL_ENDED", aiPlanRequiredMessage(null));
    } else if (existing?.status === "PAST_DUE") {
      return deny("PAYMENT_OVERDUE", "Seu pagamento está em atraso. Regularize a assinatura para voltar a usar a IA.");
    } else if (existing?.status === "PENDING_PAYMENT") {
      return deny("PAYMENT_PENDING", "Seu pagamento ainda está aguardando confirmação.");
    } else {
      return deny("AI_PLAN_REQUIRED", aiPlanRequiredMessage(null));
    }
  }
  const usedToday = await countAiUsageSince(userId, "ai_caption", billingDayStart(now));
  if (!exempt && usedToday >= AI_CAPTION_DAILY_CAP) {
    return deny("AI_DAILY_CAP", `Você atingiu o limite de ${AI_CAPTION_DAILY_CAP} legendas com IA por hoje. Volte amanhã.`);
  }
  return ALLOWED;
}

export type BillingNoticeLevel = "info" | "warning" | "blocked";

export interface BillingNotice {
  code: string;
  level: BillingNoticeLevel;
  message: string;
}

export interface BillingSummary {
  access: AutomationAccessResult;
  /** Plano pago em vigor, ou `null` (teste/sem plano/pagamento pendente). */
  plan: { code: PlanCode; name: string; priceCents: number } | null;
  /** Downgrade agendado para o próximo ciclo. */
  pendingPlan: { code: PlanCode; name: string } | null;
  features: { manualAutomation: boolean; ai: boolean; importer: boolean };
  /** Franquia de publicações com IA do ciclo (só planos com IA). */
  aiUsage: {
    used: number;
    limit: number;
    remaining: number;
    cycleEndsAt: Date | null;
    dailyUsed: number;
    dailyReference: number | null;
  } | null;
  /** Avisos prontos para a tela, do mais grave para o mais leve. */
  notices: BillingNotice[];
}

/** Tudo que as telas precisam (plano, uso, avisos) numa só leitura. Somente leitura. */
export async function getBillingSummary(userId: string, now: Date = new Date()): Promise<BillingSummary> {
  if (await isBillingExemptUser(userId)) {
    return {
      access: buildExemptAccess(),
      plan: null,
      pendingPlan: null,
      features: { manualAutomation: true, ai: true, importer: true },
      aiUsage: null,
      notices: [],
    };
  }

  const existing = await getSubscriptionByUserId(userId);
  const access = evaluateAccess(existing, now);
  const plan = paidPlanOf(existing, now);
  const notices: BillingNotice[] = [];

  const trialLike = access.status === "NEW" || access.status === "TRIAL";
  const features = {
    manualAutomation: access.allowed,
    ai: plan ? plan.includesAi : trialLike && access.allowed && FREE_TRIAL.includesAi,
    importer: Boolean(plan?.includesImporter),
  };

  if (access.status === "TRIAL" && access.trialEndsAt) {
    const daysLeft = Math.max(Math.ceil((access.trialEndsAt.getTime() - now.getTime()) / 86_400_000), 0);
    if (access.remainingToday === 0) {
      notices.push({ code: "TRIAL_DAILY_LIMIT", level: "blocked", message: access.reason ?? "Você atingiu o limite de hoje." });
    } else if (access.remainingToday === 1) {
      notices.push({ code: "TRIAL_DAILY_LAST", level: "warning", message: "Resta 1 automação grátis hoje." });
    }
    if (daysLeft <= 2) {
      notices.push({
        code: "TRIAL_ENDING",
        level: "warning",
        message: daysLeft <= 1 ? "Seu teste grátis termina hoje." : `Seu teste grátis termina em ${daysLeft} dias.`,
      });
    }
  }
  if (!access.allowed && access.reason && access.status !== "TRIAL") {
    notices.push({ code: access.code ?? "SUBSCRIPTION_REQUIRED", level: "blocked", message: access.reason });
  }

  let aiUsage: BillingSummary["aiUsage"] = null;
  if (existing && plan?.includesAi && plan.aiPostsPerCycle !== null) {
    const limit = plan.aiPostsPerCycle;
    const [used, dailyUsed] = await Promise.all([
      getCycleUsed(userId, cycleKeyOf(existing, now)),
      countReservedSince(userId, billingDayStart(now)),
    ]);
    aiUsage = {
      used,
      limit,
      remaining: Math.max(limit - used, 0),
      cycleEndsAt: existing.currentPeriodEndsAt,
      dailyUsed,
      dailyReference: plan.aiDailyReference,
    };
    if (used >= limit) {
      notices.push({ code: "PLAN_LIMIT_REACHED", level: "blocked", message: planLimitMessage(plan, limit) });
    } else if (used / limit >= PLAN_USAGE_WARNING_RATIO) {
      notices.push({
        code: "PLAN_LIMIT_NEAR",
        level: "warning",
        message: `Você usou ${used} de ${limit} publicações com IA do ciclo. Restam ${limit - used}.`,
      });
    }
    if (plan.aiDailyReference !== null && dailyUsed > plan.aiDailyReference && used < limit) {
      notices.push({
        code: "DAILY_PACE",
        level: "info",
        message: `Hoje você já fez ${dailyUsed} publicações com IA, acima do ritmo de cerca de ${plan.aiDailyReference} por dia do plano ${plan.name}. Não bloqueia — mas o ciclo acaba mais cedo nesse ritmo.`,
      });
    }
  }

  const pendingPlan = existing?.pendingPlanCode ? getPlan(existing.pendingPlanCode) : null;
  const rank = { blocked: 0, warning: 1, info: 2 } as const;
  notices.sort((a, b) => rank[a.level] - rank[b.level]);

  return {
    access,
    plan: plan ? { code: plan.code, name: plan.name, priceCents: plan.priceCents } : null,
    pendingPlan: pendingPlan ? { code: pendingPlan.code, name: pendingPlan.name } : null,
    features,
    aiUsage,
    notices,
  };
}

// ---------------------------------------------------------------------------
// Reserva / devolução (Piloto Automático)
// ---------------------------------------------------------------------------

/** O que reserveAutomationUse devolve — releaseAutomationUse precisa saber se deve (e como) devolver a vaga. */
export type AutomationUseReservation =
  | { consumedTrialSlot: true; userId: string; usageDate: string }
  | { consumedTrialSlot: false; planUsage?: { userId: string; referenceType: string; referenceId: string } };

export interface ReserveAutomationOptions {
  /** A execução gera texto com IA? Sem IA (texto manual) não consome franquia e não exige plano com IA. */
  usesAi?: boolean;
  /** Id estável da execução (ex.: id do run) — evita contar duas vezes em retry. */
  referenceId?: string;
}

/**
 * Reserva atomicamente 1 uso do Piloto — PRIMEIRA coisa que
 * generateAndCreatePublication chama, antes de qualquer chamada à IA.
 * Lança SubscriptionRequiredError (com `code`) — nunca devolve um
 * "allowed: false" — se o uso não é permitido; quem chama deve propagar o
 * erro e não gerar conteúdo algum.
 *
 *  - Teste (ou 1º uso): 3 por dia por 7 dias, com ou sem IA.
 *  - Plano pago sem IA (AUTOMATION): texto manual sem limite; IA → AI_PLAN_REQUIRED.
 *  - Plano pago com IA (CREATOR/PRO): texto manual sem limite; IA consome
 *    1 da franquia do ciclo (PLAN_LIMIT_REACHED quando esgotada).
 */
export async function reserveAutomationUse(
  userId: string,
  now: Date = new Date(),
  options: ReserveAutomationOptions = {},
): Promise<AutomationUseReservation> {
  if (await isBillingExemptUser(userId)) {
    return { consumedTrialSlot: false };
  }

  const existing = await getSubscriptionByUserId(userId);

  if (!existing || existing.status === "TRIAL") {
    const reserved = await reserveTrialUsage(userId, now, TRIAL_DAYS, TRIAL_DAILY_LIMIT);
    if (!reserved) {
      const denied = evaluateAccess(existing, now);
      throw new SubscriptionRequiredError(
        denied.reason ?? "Uso do Piloto Automático não permitido no momento.",
        denied.code ?? "SUBSCRIPTION_REQUIRED",
      );
    }
    return { consumedTrialSlot: true, userId, usageDate: billingDateStr(now) };
  }

  const access = evaluateAccess(existing, now);
  if (!access.allowed) {
    throw new SubscriptionRequiredError(
      access.reason ?? "Uso do Piloto Automático não permitido no momento.",
      access.code ?? "SUBSCRIPTION_REQUIRED",
    );
  }

  if (!options.usesAi) return { consumedTrialSlot: false };

  const plan = getPlan(existing.planCode);
  if (!plan.includesAi || plan.aiPostsPerCycle === null) {
    throw new SubscriptionRequiredError(aiPlanRequiredMessage(plan), "AI_PLAN_REQUIRED");
  }

  const reference = {
    userId,
    referenceType: AUTOMATION_USAGE_REFERENCE_TYPE,
    referenceId: options.referenceId ?? randomUUID(),
  };
  const result = await reservePlanUsage({
    ...reference,
    cycleKey: cycleKeyOf(existing, now),
    planCode: plan.code,
    limit: plan.aiPostsPerCycle,
  });
  if (result.status === "limit") {
    throw new SubscriptionRequiredError(planLimitMessage(plan, plan.aiPostsPerCycle), "PLAN_LIMIT_REACHED");
  }
  // "duplicate" = esta execução já tinha reserva ativa (retry) — segue sem contar de novo.
  return { consumedTrialSlot: false, planUsage: reference };
}

/**
 * Devolve a vaga reservada quando a geração falha por erro interno
 * (nunca "gasta" um dos usos do usuário por uma falha nossa). Chamar
 * sempre dentro do catch da geração, nunca no caminho de sucesso.
 * Idempotente.
 */
export async function releaseAutomationUse(reservation: AutomationUseReservation): Promise<void> {
  if (reservation.consumedTrialSlot) {
    await releaseTrialUsage(reservation.userId, reservation.usageDate);
    return;
  }
  if (reservation.planUsage) {
    await releasePlanUsage(reservation.planUsage);
  }
}
