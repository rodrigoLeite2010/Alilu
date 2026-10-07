import type { CarouselSubscriptionRecord } from "./carousel-billing-repository";
import type { CarouselBillingState } from "./carousel-subscription-service";

/** Assinatura para o navegador: sem IDs do Asaas. */
export function serializeCarouselSubscription(sub: CarouselSubscriptionRecord | null) {
  if (!sub) return null;
  return {
    planCode: sub.planCode,
    pendingPlanCode: sub.pendingPlanCode,
    status: sub.status,
    listPriceCents: sub.listPriceCents,
    priceCents: sub.priceCents,
    discountPercent: sub.discountPercent,
    complimentary: sub.complimentary,
    startedAt: sub.startedAt ? sub.startedAt.toISOString() : null,
    currentPeriodEndsAt: sub.currentPeriodEndsAt ? sub.currentPeriodEndsAt.toISOString() : null,
    canceledAt: sub.canceledAt ? sub.canceledAt.toISOString() : null,
  };
}

export function serializeCarouselBilling(state: CarouselBillingState) {
  const { access } = state;
  return {
    access: {
      kind: access.kind,
      allowed: access.allowed,
      planCode: access.plan?.code ?? null,
      planName: access.plan?.name ?? null,
      used: access.used,
      limit: access.limit,
      code: access.code,
      reason: access.reason,
    },
    subscription: serializeCarouselSubscription(state.subscription),
    existingAliluCustomer: state.existingAliluCustomer,
    plans: state.plans,
  };
}
