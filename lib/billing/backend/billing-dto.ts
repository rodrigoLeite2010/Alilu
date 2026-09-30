import "server-only";
import type { AutomationAccessResult, AutomationSubscriptionRecord } from "./billing-types";

/**
 * Serialização para JSON das respostas da API de billing — nunca expõe
 * asaas_customer_id/cpf_cnpj/asaas_subscription_id (dados internos do
 * Asaas, sem valor nenhum pra UI e melhor nem trafegar) e sempre datas
 * em ISO.
 */

export function serializeAccessResult(result: AutomationAccessResult) {
  return {
    allowed: result.allowed,
    status: result.status,
    reason: result.reason,
    trialEndsAt: result.trialEndsAt ? result.trialEndsAt.toISOString() : null,
    remainingToday: result.remainingToday,
    currentPeriodEndsAt: result.currentPeriodEndsAt ? result.currentPeriodEndsAt.toISOString() : null,
  };
}

export function serializeSubscription(subscription: AutomationSubscriptionRecord) {
  return {
    status: subscription.status,
    trialEndsAt: subscription.trialEndsAt ? subscription.trialEndsAt.toISOString() : null,
    monthlyPriceCents: subscription.monthlyPriceCents,
    startedAt: subscription.startedAt ? subscription.startedAt.toISOString() : null,
    currentPeriodEndsAt: subscription.currentPeriodEndsAt ? subscription.currentPeriodEndsAt.toISOString() : null,
    canceledAt: subscription.canceledAt ? subscription.canceledAt.toISOString() : null,
  };
}
