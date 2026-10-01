import "server-only";
import { timingSafeEqual } from "node:crypto";
import { recordWebhookEventOnce, markWebhookEventProcessed } from "./asaas-webhook-events-repository";
import { getAsaasPayment, getAsaasSubscription } from "./asaas-client";
import {
  getByAsaasSubscriptionId,
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
  if (PAYMENT_CONFIRMATION_EVENTS.has(eventType) || PAYMENT_OVERDUE_EVENTS.has(eventType)) {
    await handlePaymentEvent(eventType, payload);
    return;
  }

  if (SUBSCRIPTION_CANCEL_EVENTS.has(eventType)) {
    await handleSubscriptionCancelEvent(payload, now);
    return;
  }

  // Evento fora do MVP — já ficou registrado em asaas_webhook_events pela chamada anterior; nada mais a fazer.
}

async function handlePaymentEvent(eventType: string, payload: Record<string, unknown>): Promise<void> {
  const paymentRef = isRecord(payload.payment) ? payload.payment : null;
  const paymentId = paymentRef && typeof paymentRef.id === "string" ? paymentRef.id : null;
  // O corpo do Webhook só traz `{ payment: { object, id } }` — nunca confiamos só nisso: buscamos
  // os detalhes de verdade (inclui a que assinatura pertence) direto no Asaas.
  if (!paymentId) return;

  const payment = await getAsaasPayment(paymentId);
  if (!payment.subscription) return; // cobrança avulsa, não ligada a uma assinatura — não é deste módulo.

  const subscriptionRow = await getByAsaasSubscriptionId(payment.subscription);
  if (!subscriptionRow) return; // assinatura não é do Piloto Automático (ou o usuário já não existe mais aqui).

  if (PAYMENT_CONFIRMATION_EVENTS.has(eventType)) {
    const asaasSubscription = await getAsaasSubscription(payment.subscription);
    const currentPeriodEndsAt = asaasSubscription.nextDueDate
      ? new Date(`${asaasSubscription.nextDueDate}T00:00:00.000Z`)
      : null;
    await markActiveFromPayment(payment.subscription, currentPeriodEndsAt, new Date());
  } else {
    await markPastDue(payment.subscription);
  }
}

async function handleSubscriptionCancelEvent(payload: Record<string, unknown>, now: Date): Promise<void> {
  const subscriptionRef = isRecord(payload.subscription) ? payload.subscription : null;
  const subscriptionId = subscriptionRef && typeof subscriptionRef.id === "string" ? subscriptionRef.id : null;
  if (!subscriptionId) return;
  await markCanceledByAsaasSubscriptionId(subscriptionId, now);
}
