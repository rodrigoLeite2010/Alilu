import "server-only";
import { timingSafeEqual } from "node:crypto";
import { recordWebhookEventOnce, markWebhookEventProcessed } from "./asaas-webhook-events-repository";
import { getAsaasPayment, getAsaasSubscription, updateAsaasSubscriptionValue } from "./asaas-client";
import { parsePlanUpgradeReference } from "./subscription-service";
import { getPlan, PLAN_CODES, type PlanCode } from "../plans";
import { handleCreditPurchasePaymentEvent } from "@/lib/ai-video/backend/credit-purchase-service";
import { handleCarouselSubscriptionCanceled, handleCarouselSubscriptionPayment, handleCarouselUpgradePayment } from "@/lib/carousel/backend/carousel-billing-webhook";
import {
  getByAsaasSubscriptionId,
  getSubscriptionByUserId,
  markPlanUpgraded,
  markActiveFromPayment,
  markPastDue,
  markCanceledByAsaasSubscriptionId,
} from "./automation-subscription-repository";

/**
 * Processa os eventos de Webhook do Asaas para a assinatura do Piloto
 * Automático — o ÚNICO lugar do sistema que libera/bloqueia acesso por
 * causa de pagamento (nunca um redirect do navegador: ver
 * app/api/billing/asaas-webhook/route.ts, que só repassa o corpo já
 * validado para cá). Idempotente por event_id (asaas_webhook_events) —
 * o Asaas garante apenas "at least once", o mesmo evento pode chegar
 * mais de uma vez.
 */

export class AsaasWebhookAuthError extends Error {}
export class AsaasWebhookPayloadError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Valida o header `asaas-access-token` contra ASAAS_WEBHOOK_TOKEN
 * (configurado manualmente no dashboard do Asaas ao cadastrar a URL do
 * Webhook — ver .env.example). Nunca loga nenhum dos dois valores.
 */
export function assertValidWebhookToken(providedToken: string | null): void {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!expected) {
    throw new AsaasWebhookAuthError("ASAAS_WEBHOOK_TOKEN não configurado no servidor.");
  }
  if (!providedToken || !safeEqual(providedToken, expected)) {
    throw new AsaasWebhookAuthError("Token do Webhook do Asaas inválido.");
  }
}

// Nomes de evento confirmados na documentação oficial do Asaas
// (docs.asaas.com/docs/webhook-para-cobrancas e
// .../eventos-para-assinaturas) — nunca inventados. Eventos fora destas
// listas ficam registrados em asaas_webhook_events (auditoria), mas não
// mudam status nenhum: fora do escopo do MVP (chargeback, split, boleto
// visualizado, etc.).
const PAYMENT_CONFIRMATION_EVENTS = new Set(["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"]);
const PAYMENT_OVERDUE_EVENTS = new Set(["PAYMENT_OVERDUE"]);
const SUBSCRIPTION_CANCEL_EVENTS = new Set(["SUBSCRIPTION_DELETED", "SUBSCRIPTION_INACTIVATED"]);
// Cobranças AVULSAS de compra de créditos de IA (ai_credit_purchases) —
// além de confirmação, precisam de estorno, contestação e exclusão.
const CREDIT_PURCHASE_EXTRA_EVENTS = new Set(["PAYMENT_REFUNDED", "PAYMENT_CHARGEBACK_REQUESTED", "PAYMENT_DELETED"]);

export interface WebhookProcessingResult {
  status: "processed" | "duplicate" | "ignored";
  eventType: string;
}

/**
 * Processa um evento já autenticado (assertValidWebhookToken deve ter
 * sido chamado antes, pela rota). Sempre grava o evento primeiro (trava
 * de idempotência) — se já existia E já foi processado, devolve
 * "duplicate" sem tocar em mais nada. Se já existia mas o processamento
 * anterior falhou (processed_at nulo), processa de novo — é assim que a
 * reentrega automática do Asaas recupera uma falha momentânea.
 */
export async function processAsaasWebhookEvent(
  rawBody: unknown,
  now: Date = new Date(),
): Promise<WebhookProcessingResult> {
  if (!isRecord(rawBody) || typeof rawBody.id !== "string" || typeof rawBody.event !== "string") {
    throw new AsaasWebhookPayloadError("Corpo do Webhook do Asaas em formato inesperado (faltam id/event).");
  }
  const eventId = rawBody.id;
  const eventType = rawBody.event;

  const isNewEvent = await recordWebhookEventOnce(eventId, eventType, rawBody);
  if (!isNewEvent) {
    return { status: "duplicate", eventType };
  }

  await routeEvent(eventType, rawBody, now);
  await markWebhookEventProcessed(eventId);

  return { status: "processed", eventType };
}

async function routeEvent(eventType: string, payload: Record<string, unknown>, now: Date): Promise<void> {
  if (
    PAYMENT_CONFIRMATION_EVENTS.has(eventType) ||
    PAYMENT_OVERDUE_EVENTS.has(eventType) ||
    CREDIT_PURCHASE_EXTRA_EVENTS.has(eventType)
  ) {
    await handlePaymentEvent(eventType, payload, now);
    return;
  }

  if (SUBSCRIPTION_CANCEL_EVENTS.has(eventType)) {
    await handleSubscriptionCancelEvent(payload, now);
    return;
  }

  // Evento fora do MVP — já ficou registrado em asaas_webhook_events pela chamada anterior; nada mais a fazer.
}

async function handlePaymentEvent(eventType: string, payload: Record<string, unknown>, now: Date): Promise<void> {
  const paymentRef = isRecord(payload.payment) ? payload.payment : null;
  const paymentId = paymentRef && typeof paymentRef.id === "string" ? paymentRef.id : null;
  // O corpo do Webhook só traz `{ payment: { object, id } }` — nunca confiamos só nisso: buscamos
  // os detalhes de verdade (inclui a que assinatura pertence) direto no Asaas.
  if (!paymentId) return;

  const payment = await getAsaasPayment(paymentId);
  if (!payment.subscription) {
    // Cobrança proporcional de upgrade de plano (criada por changeAutomationPlan).
    if (await handlePlanUpgradePayment(eventType, payment)) return;
    // Upgrade do Carrossel Inteligente (produto separado, referência própria).
    if (await handleCarouselUpgradePayment(eventType, payment)) return;
    // Cobrança avulsa: hoje, só a compra de créditos de IA usa. Se não for
    // uma compra conhecida, o evento só fica registrado (auditoria).
    await handleCreditPurchasePaymentEvent(eventType, payment, now);
    return;
  }
  // Estorno/contestação/exclusão de cobrança de ASSINATURA continuam fora do escopo (só registrados).
  if (CREDIT_PURCHASE_EXTRA_EVENTS.has(eventType)) return;

  const subscriptionRow = await getByAsaasSubscriptionId(payment.subscription);
  if (!subscriptionRow) {
    // Não é do Piloto Automático: pode ser do Carrossel Inteligente.
    await handleCarouselSubscriptionPayment(eventType, payment, now);
    return;
  }

  if (PAYMENT_CONFIRMATION_EVENTS.has(eventType)) {
    const asaasSubscription = await getAsaasSubscription(payment.subscription);
    const currentPeriodEndsAt = asaasSubscription.nextDueDate
      ? new Date(`${asaasSubscription.nextDueDate}T00:00:00.000Z`)
      : null;
    // Downgrade agendado só vale quando o que foi pago é o PRÓXIMO ciclo (vencimento >= fim do período
    // atual). PAYMENT_RECEIVED do cartão chega ~1 mês depois do CONFIRMED do MESMO ciclo — esse não troca.
    let applyPlan: { planCode: PlanCode; priceCents: number } | null = null;
    if (
      subscriptionRow.pendingPlanCode &&
      subscriptionRow.currentPeriodEndsAt &&
      payment.dueDate &&
      payment.dueDate >= subscriptionRow.currentPeriodEndsAt.toISOString().slice(0, 10)
    ) {
      applyPlan = {
        planCode: subscriptionRow.pendingPlanCode,
        priceCents: getPlan(subscriptionRow.pendingPlanCode).priceCents,
      };
    }
    await markActiveFromPayment(payment.subscription, currentPeriodEndsAt, new Date(), applyPlan);
  } else {
    await markPastDue(payment.subscription);
  }
}

async function handleSubscriptionCancelEvent(payload: Record<string, unknown>, now: Date): Promise<void> {
  const subscriptionRef = isRecord(payload.subscription) ? payload.subscription : null;
  const subscriptionId = subscriptionRef && typeof subscriptionRef.id === "string" ? subscriptionRef.id : null;
  if (!subscriptionId) return;
  await markCanceledByAsaasSubscriptionId(subscriptionId, now);
  await handleCarouselSubscriptionCanceled(subscriptionId, now);
}

const PAID_STATUSES = new Set(["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"]);

/**
 * Cobrança avulsa de upgrade confirmada → plano novo vale já e o preço da
 * assinatura no Asaas passa ao do plano novo (ciclos seguintes).
 * Devolve `true` se a cobrança é de upgrade (tratada ou ignorada de
 * propósito), `false` se não tem nada a ver com plano.
 */
async function handlePlanUpgradePayment(
  eventType: string,
  payment: { status: string; externalReference: string | null },
): Promise<boolean> {
  const ref = parsePlanUpgradeReference(payment.externalReference);
  if (!ref) return false;
  if (!PAYMENT_CONFIRMATION_EVENTS.has(eventType) || !PAID_STATUSES.has(payment.status)) return true;

  const sub = await getSubscriptionByUserId(ref.userId);
  if (!sub || sub.status !== "ACTIVE" || !sub.asaasSubscriptionId) return true;

  const target = getPlan(ref.planCode);
  const lowerPlans = PLAN_CODES.filter((code) => getPlan(code).rank < target.rank);
  if (!lowerPlans.includes(sub.planCode)) return true; // já está nesse plano ou em um maior — evento repetido/atrasado.

  // Primeiro o Asaas (idempotente), depois o banco: se algo falhar, a reentrega do webhook repete o par inteiro.
  await updateAsaasSubscriptionValue(sub.asaasSubscriptionId, target.priceCents / 100);
  await markPlanUpgraded(ref.userId, target.code, target.priceCents, lowerPlans);
  return true;
}
