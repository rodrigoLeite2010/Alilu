import "server-only";
import { getAsaasSubscription, type AsaasPayment } from "@/lib/billing/backend/asaas-client";
import { updateAsaasSubscriptionValue } from "@/lib/billing/backend/asaas-client";
import { CAROUSEL_PLAN_CODES, getCarouselPlan, type CarouselPlanCode } from "../carousel-plans";
import {
  getCarouselSubscription,
  getCarouselSubscriptionByAsaasId,
  markCarouselActiveFromPayment,
  markCarouselCanceledByAsaasId,
  markCarouselPastDue,
  markCarouselPlanUpgraded,
} from "./carousel-billing-repository";
import { parseCarouselUpgradeReference, priceAfterChange } from "./carousel-subscription-service";

/**
 * Parte do webhook do Asaas que cuida do Carrossel. Chamado por
 * asaas-webhook-service (único ponto que processa eventos). Idempotente:
 * todos os UPDATEs têm guarda de status/plano, então reentregas e eventos
 * atrasados não mudam nada.
 */
const CONFIRMATION = new Set(["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"]);
const OVERDUE = new Set(["PAYMENT_OVERDUE"]);
const PAID_STATUSES = new Set(["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"]);

/** Cobrança de uma assinatura do Carrossel. `true` = a assinatura é do Carrossel (tratada). */
export async function handleCarouselSubscriptionPayment(eventType: string, payment: Pick<AsaasPayment, "subscription" | "dueDate">, now: Date): Promise<boolean> {
  if (!payment.subscription) return false;
  const sub = await getCarouselSubscriptionByAsaasId(payment.subscription);
  if (!sub) return false;

  if (CONFIRMATION.has(eventType)) {
    const asaasSubscription = await getAsaasSubscription(payment.subscription);
    const periodEnd = asaasSubscription.nextDueDate ? new Date(`${asaasSubscription.nextDueDate}T00:00:00.000Z`) : null;
    let applyPlan: { planCode: CarouselPlanCode; listPriceCents: number; priceCents: number } | null = null;
    if (sub.pendingPlanCode && sub.currentPeriodEndsAt && payment.dueDate && payment.dueDate >= sub.currentPeriodEndsAt.toISOString().slice(0, 10)) {
      applyPlan = { planCode: sub.pendingPlanCode, ...priceAfterChange(sub, sub.pendingPlanCode) };
    }
    await markCarouselActiveFromPayment(payment.subscription, periodEnd, now, applyPlan);
  } else if (OVERDUE.has(eventType)) {
    await markCarouselPastDue(payment.subscription);
  }
  return true;
}

/** Cobrança avulsa de upgrade do Carrossel. `true` = é de upgrade (tratada ou ignorada de propósito). */
export async function handleCarouselUpgradePayment(eventType: string, payment: { status: string; externalReference: string | null }): Promise<boolean> {
  const ref = parseCarouselUpgradeReference(payment.externalReference);
  if (!ref) return false;
  if (!CONFIRMATION.has(eventType) || !PAID_STATUSES.has(payment.status)) return true;

  const sub = await getCarouselSubscription(ref.userId);
  if (!sub || sub.status !== "ACTIVE" || sub.complimentary || !sub.asaasSubscriptionId) return true;
  const target = getCarouselPlan(ref.planCode);
  const lowerPlans = CAROUSEL_PLAN_CODES.filter((code) => getCarouselPlan(code).rank < target.rank);
  if (!lowerPlans.includes(sub.planCode)) return true;

  const next = priceAfterChange(sub, target.code);
  await updateAsaasSubscriptionValue(sub.asaasSubscriptionId, next.priceCents / 100);
  await markCarouselPlanUpgraded(ref.userId, target.code, next.listPriceCents, next.priceCents, lowerPlans);
  return true;
}

export async function handleCarouselSubscriptionCanceled(asaasSubscriptionId: string, now: Date): Promise<void> {
  await markCarouselCanceledByAsaasId(asaasSubscriptionId, now);
}
