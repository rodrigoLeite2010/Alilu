import "server-only";
import {
  getSubscriptionByUserId,
  reserveTrialUsage,
  releaseTrialUsage,
} from "./automation-subscription-repository";
import {
  TRIAL_DAYS,
  TRIAL_DAILY_LIMIT,
  SubscriptionRequiredError,
  type AutomationAccessResult,
  type AutomationSubscriptionRecord,
} from "./billing-types";

/**
 * Único ponto do sistema que decide se o Piloto Automático pode chamar a
 * IA e publicar para um usuário. Nunca chama Asaas nem toca em
 * content-automation/instagram diretamente — só lê/escreve
 * automation_subscriptions através do repositório.
 * `content-automation-cron.ts` chama `reserveAutomationUse` como a
 * PRIMEIRA linha de `generateAndCreatePublication`; a tela do Piloto
 * chama `canUseAutomation` (somente leitura) para desenhar banners.
 */

function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function evaluateAccess(existing: AutomationSubscriptionRecord | null, now: Date): AutomationAccessResult {
  if (!existing) {
    return {
      allowed: true,
      status: "NEW",
      reason: null,
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
          reason: "Seu período de teste de 7 dias terminou. Assine para continuar usando o Piloto Automático.",
          trialEndsAt: existing.trialEndsAt,
          remainingToday: 0,
          currentPeriodEndsAt: null,
        };
      }
      const usedToday = existing.trialUsageDate === toDateStr(now) ? existing.trialUsageCount : 0;
      const remainingToday = Math.max(TRIAL_DAILY_LIMIT - usedToday, 0);
      return {
        allowed: remainingToday > 0,
        status: "TRIAL",
        reason:
          remainingToday > 0
            ? null
            : "Você atingiu o limite de 3 automações de hoje. Volte amanhã ou assine para uso ilimitado.",
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
        trialEndsAt: null,
        remainingToday: null,
        currentPeriodEndsAt: existing.currentPeriodEndsAt,
      };
    case "PENDING_PAYMENT":
      return {
        allowed: false,
        status: "PENDING_PAYMENT",
        reason: "Seu pagamento ainda está aguardando confirmação.",
        trialEndsAt: null,
        remainingToday: 0,
        currentPeriodEndsAt: null,
      };
    case "PAST_DUE":
      return {
        allowed: false,
        status: "PAST_DUE",
        reason: "Seu pagamento está em atraso. Novas automações ficam pausadas até a confirmação — as já agendadas não são apagadas.",
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
          trialEndsAt: null,
          remainingToday: null,
          currentPeriodEndsAt: existing.currentPeriodEndsAt,
        };
      }
      return {
        allowed: false,
        status: "EXPIRED",
        reason: "Sua assinatura terminou.",
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
        trialEndsAt: null,
        remainingToday: 0,
        currentPeriodEndsAt: null,
      };
  }
}

/** Somente leitura — usado pela tela do Piloto Automático para desenhar banners/avisos. Nunca reserva uso. */
export async function canUseAutomation(userId: string, now: Date = new Date()): Promise<AutomationAccessResult> {
  const existing = await getSubscriptionByUserId(userId);
  return evaluateAccess(existing, now);
}

/** O que reserveAutomationUse devolve — releaseAutomationUse precisa saber se deve (e como) devolver a vaga. */
export type AutomationUseReservation =
  | { consumedTrialSlot: true; userId: string; usageDate: string }
  | { consumedTrialSlot: false };

/**
 * Reserva atomicamente 1 uso do Piloto — PRIMEIRA coisa que
 * generateAndCreatePublication chama, antes de qualquer chamada à IA.
 * Lança SubscriptionRequiredError (nunca devolve um "allowed: false") se
 * o uso não é permitido; quem chama deve propagar o erro e não gerar
 * conteúdo algum.
 */
export async function reserveAutomationUse(
  userId: string,
  now: Date = new Date(),
): Promise<AutomationUseReservation> {
  const existing = await getSubscriptionByUserId(userId);

  if (!existing || existing.status === "TRIAL") {
    const reserved = await reserveTrialUsage(userId, now, TRIAL_DAYS, TRIAL_DAILY_LIMIT);
    if (!reserved) {
      const denied = evaluateAccess(existing, now);
      throw new SubscriptionRequiredError(denied.reason ?? "Uso do Piloto Automático não permitido no momento.");
    }
    return { consumedTrialSlot: true, userId, usageDate: toDateStr(now) };
  }

  const access = evaluateAccess(existing, now);
  if (!access.allowed) {
    throw new SubscriptionRequiredError(access.reason ?? "Uso do Piloto Automático não permitido no momento.");
  }
  return { consumedTrialSlot: false };
}

/**
 * Devolve a vaga reservada quando a geração falha por erro interno
 * (nunca "gasta" um dos 3 usos diários do usuário por uma falha nossa).
 * Chamar sempre dentro do catch da geração, nunca no caminho de sucesso.
 */
export async function releaseAutomationUse(reservation: AutomationUseReservation): Promise<void> {
  if (!reservation.consumedTrialSlot) return;
  await releaseTrialUsage(reservation.userId, reservation.usageDate);
}
