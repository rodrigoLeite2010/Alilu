import "server-only";
import { isAdminEmail } from "@/lib/admin/admin-email";
import { billingDateStr } from "@/lib/billing/billing-time";
import { getSubscriptionByUserId } from "@/lib/billing/backend/automation-subscription-repository";
import { releasePlanUsage, reservePlanUsage, getCycleUsed } from "@/lib/billing/backend/plan-usage-repository";
import {
  CAROUSEL_FREE_TRIAL,
  carouselPriceFor,
  getCarouselPlan,
  trialEmailKey,
  type CarouselPlanCode,
  type CarouselPlanDefinition,
  type CarouselPrice,
} from "../carousel-plans";
import {
  claimCarouselTrial,
  getCarouselSubscription,
  isCarouselTrialUsed,
  type CarouselSubscriptionRecord,
} from "./carousel-billing-repository";
import { getUserEmail } from "./carousel-repository";

export const CAROUSEL_USAGE_REFERENCE_TYPE = "CAROUSEL_PROJECT";

export type CarouselAccessCode =
  | "SUBSCRIPTION_REQUIRED"
  | "PAYMENT_PENDING"
  | "PAYMENT_OVERDUE"
  | "QUOTA_EXCEEDED"
  | "TRIAL_USED";

export interface CarouselAccess {
  /** PLAN = assinatura paga em vigor; TRIAL = carrossel grátis disponível; ADMIN = login de administrador (sempre liberado, sem cota); NONE = sem acesso. */
  kind: "PLAN" | "TRIAL" | "ADMIN" | "NONE";
  allowed: boolean;
  plan: CarouselPlanDefinition | null;
  subscription: CarouselSubscriptionRecord | null;
  /** Só PLAN: chave do ciclo da cota (prefixo "carousel:"). */
  cycleKey: string | null;
  used: number;
  limit: number;
  code: CarouselAccessCode | null;
  reason: string | null;
}

/** O plano pago em vigor: ACTIVE (cortesia vence pela data) ou CANCELED dentro do período já pago. */
export function paidCarouselPlanOf(sub: CarouselSubscriptionRecord | null, now: Date): CarouselPlanDefinition | null {
  if (!sub) return null;
  const paidUntilOk = sub.currentPeriodEndsAt !== null && sub.currentPeriodEndsAt > now;
  if (sub.status === "ACTIVE") {
    if (sub.complimentary && !paidUntilOk) return null;
    return getCarouselPlan(sub.planCode);
  }
  if (sub.status === "CANCELED" && paidUntilOk) return getCarouselPlan(sub.planCode);
  return null;
}

export function carouselCycleKey(sub: CarouselSubscriptionRecord, now: Date): string {
  if (sub.currentPeriodEndsAt) return `carousel:${sub.currentPeriodEndsAt.toISOString().slice(0, 10)}`;
  return `carousel:m:${billingDateStr(now).slice(0, 7)}`;
}

function deny(code: CarouselAccessCode, reason: string, base: Pick<CarouselAccess, "plan" | "subscription" | "cycleKey" | "used" | "limit">): CarouselAccess {
  return { kind: "NONE", allowed: false, code, reason, ...base };
}

/** Somente leitura: o que o usuário pode fazer agora (nunca reserva cota). */
export async function getCarouselAccess(userId: string, now: Date = new Date()): Promise<CarouselAccess> {
  const subscription = await getCarouselSubscription(userId);
  // Administrador: sempre liberado, sem cota e sem consumir o carrossel grátis.
  if (isAdminEmail(await getUserEmail(userId))) {
    return { kind: "ADMIN", allowed: true, code: null, reason: null, plan: null, subscription, cycleKey: null, used: 0, limit: 0 };
  }
  const plan = paidCarouselPlanOf(subscription, now);

  if (plan && subscription) {
    const cycleKey = carouselCycleKey(subscription, now);
    const used = await getCycleUsed(userId, cycleKey);
    const base = { plan, subscription, cycleKey, used, limit: plan.carouselsPerCycle };
    if (used >= plan.carouselsPerCycle) {
      return deny("QUOTA_EXCEEDED", `Você usou os ${plan.carouselsPerCycle} carrosséis do plano ${plan.name} neste ciclo. A cota renova no próximo ciclo ou você pode fazer upgrade.`, base);
    }
    return { kind: "PLAN", allowed: true, code: null, reason: null, ...base };
  }

  const none = { plan: null, subscription, cycleKey: null, used: 0, limit: 0 };
  if (subscription?.status === "PAST_DUE") {
    return deny("PAYMENT_OVERDUE", "O pagamento do Carrossel Inteligente está em atraso. Regularize para criar novos carrosséis.", none);
  }
  if (subscription?.status === "PENDING_PAYMENT") {
    // Enquanto o primeiro pagamento não confirma, o carrossel grátis (se não usado) continua valendo.
    const email = await getUserEmail(userId);
    if (email && !(await isCarouselTrialUsed(userId, trialEmailKey(email)))) {
      return { kind: "TRIAL", allowed: true, code: null, reason: null, ...none, limit: CAROUSEL_FREE_TRIAL.carousels };
    }
    return deny("PAYMENT_PENDING", "Seu pagamento ainda está aguardando confirmação.", none);
  }

  const email = await getUserEmail(userId);
  const trialUsed = email ? await isCarouselTrialUsed(userId, trialEmailKey(email)) : true;
  if (!trialUsed) {
    return { kind: "TRIAL", allowed: true, code: null, reason: null, ...none, limit: CAROUSEL_FREE_TRIAL.carousels };
  }
  return deny(
    trialUsed && !subscription ? "TRIAL_USED" : "SUBSCRIPTION_REQUIRED",
    "Seu carrossel grátis já foi usado. Assine um plano do Carrossel Inteligente para continuar criando.",
    none,
  );
}

export type CompletionResult =
  | { status: "counted"; via: "PLAN" | "TRIAL" | "ADMIN" }
  | { status: "already-counted" }
  | { status: "denied"; access: CarouselAccess };

/**
 * Consome a cota de UM carrossel concluído. Idempotente por projeto: concluir
 * (ou regenerar) o MESMO projeto de novo nunca conta outra vez. Previews,
 * falhas e regenerações de slide nunca chamam isto.
 */
export async function consumeCarouselQuota(userId: string, projectId: string, now: Date = new Date()): Promise<CompletionResult> {
  if (isAdminEmail(await getUserEmail(userId))) return { status: "counted", via: "ADMIN" };
  const subscription = await getCarouselSubscription(userId);
  const plan = paidCarouselPlanOf(subscription, now);

  if (plan && subscription) {
    const cycleKey = carouselCycleKey(subscription, now);
    const reserved = await reservePlanUsage({
      userId,
      referenceType: CAROUSEL_USAGE_REFERENCE_TYPE,
      referenceId: projectId,
      cycleKey,
      planCode: `carousel:${plan.code}`,
      limit: plan.carouselsPerCycle,
    });
    if (reserved.status === "reserved") return { status: "counted", via: "PLAN" };
    if (reserved.status === "duplicate") return { status: "already-counted" };
    return { status: "denied", access: await getCarouselAccess(userId, now) };
  }

  const email = await getUserEmail(userId);
  if (email) {
    const claim = await claimCarouselTrial({ userId, emailKey: trialEmailKey(email), projectId });
    if (claim.granted) return { status: "counted", via: "TRIAL" };
  }
  return { status: "denied", access: await getCarouselAccess(userId, now) };
}

/** Devolve a cota (só para erro nosso depois de contar). */
export async function releaseCarouselQuota(userId: string, projectId: string): Promise<boolean> {
  return releasePlanUsage({ userId, referenceType: CAROUSEL_USAGE_REFERENCE_TYPE, referenceId: projectId });
}

// ---------------------------------------------------------------------------
// Desconto de cliente Alilu (decidido SEMPRE aqui, nunca pelo frontend)
// ---------------------------------------------------------------------------

/**
 * Cliente Alilu = assinatura PAGA do Piloto Automático em vigor: status
 * ACTIVE, não cortesia, com período ainda não vencido. Teste, cancelada,
 * em atraso, pendente ou expirada não dão desconto.
 */
export async function isExistingAliluCustomer(userId: string, now: Date = new Date()): Promise<boolean> {
  const sub = await getSubscriptionByUserId(userId);
  if (!sub) return false;
  if (sub.status !== "ACTIVE" || sub.complimentary) return false;
  return sub.currentPeriodEndsAt !== null && sub.currentPeriodEndsAt > now;
}

export async function getCarouselQuote(userId: string, planCode: CarouselPlanCode, now: Date = new Date()): Promise<CarouselPrice> {
  return carouselPriceFor(planCode, await isExistingAliluCustomer(userId, now));
}
