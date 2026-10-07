import "server-only";
import { getDb } from "@/lib/db/client";
import { isCarouselPlanCode, type CarouselPlanCode } from "../carousel-plans";

export type CarouselSubscriptionStatus = "PENDING_PAYMENT" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "EXPIRED";

export interface CarouselSubscriptionRecord {
  id: string;
  userId: string;
  planCode: CarouselPlanCode;
  pendingPlanCode: CarouselPlanCode | null;
  status: CarouselSubscriptionStatus;
  listPriceCents: number;
  priceCents: number;
  discountPercent: number;
  asaasCustomerId: string | null;
  asaasSubscriptionId: string | null;
  complimentary: boolean;
  startedAt: Date | null;
  currentPeriodEndsAt: Date | null;
  canceledAt: Date | null;
}

type Row = Record<string, unknown>;

function toDate(value: unknown): Date | null {
  if (!value) return null;
  return value instanceof Date ? value : new Date(String(value));
}

function toSubscription(row: Row): CarouselSubscriptionRecord {
  const plan = row.plan_code;
  return {
    id: row.id as string,
    userId: row.user_id as string,
    planCode: isCarouselPlanCode(plan) ? plan : "STARTER",
    pendingPlanCode: isCarouselPlanCode(row.pending_plan_code) ? row.pending_plan_code : null,
    status: row.status as CarouselSubscriptionStatus,
    listPriceCents: Number(row.list_price_cents),
    priceCents: Number(row.price_cents),
    discountPercent: Number(row.discount_percent),
    asaasCustomerId: (row.asaas_customer_id as string | null) ?? null,
    asaasSubscriptionId: (row.asaas_subscription_id as string | null) ?? null,
    complimentary: row.complimentary === true,
    startedAt: toDate(row.started_at),
    currentPeriodEndsAt: toDate(row.current_period_ends_at),
    canceledAt: toDate(row.canceled_at),
  };
}

export async function getCarouselSubscription(userId: string): Promise<CarouselSubscriptionRecord | null> {
  const rows = await getDb()`select * from carousel_subscriptions where user_id = ${userId}`;
  return rows[0] ? toSubscription(rows[0] as Row) : null;
}

/**
 * Cria/atualiza a assinatura em PENDING_PAYMENT com o preço JÁ calculado no
 * servidor (o checkout do Asaas é a Fase 6). Nunca rebaixa uma assinatura ACTIVE.
 */
export async function savePendingCarouselSubscription(input: {
  userId: string;
  planCode: CarouselPlanCode;
  listPriceCents: number;
  priceCents: number;
  discountPercent: number;
}): Promise<CarouselSubscriptionRecord> {
  const rows = await getDb()`
    insert into carousel_subscriptions (user_id, plan_code, status, list_price_cents, price_cents, discount_percent)
    values (${input.userId}, ${input.planCode}, 'PENDING_PAYMENT', ${input.listPriceCents}, ${input.priceCents}, ${input.discountPercent})
    on conflict (user_id) do update set
      plan_code = excluded.plan_code,
      list_price_cents = excluded.list_price_cents,
      price_cents = excluded.price_cents,
      discount_percent = excluded.discount_percent,
      updated_at = now()
    where carousel_subscriptions.status in ('PENDING_PAYMENT', 'EXPIRED', 'CANCELED')
    returning *
  `;
  if (rows[0]) return toSubscription(rows[0] as Row);
  const current = await getCarouselSubscription(input.userId);
  if (!current) throw new Error("Não foi possível salvar a assinatura do carrossel.");
  return current;
}

export interface TrialClaimResult {
  /** true = este projeto pode usar (ou já usou) o carrossel grátis. */
  granted: boolean;
}

/**
 * Consome o ÚNICO carrossel grátis. Atômico: a chave única por usuário e por
 * e-mail normalizado impede repetir. O mesmo projeto pode "reivindicar" de
 * novo (retry) sem consumir outro.
 */
export async function claimCarouselTrial(input: { userId: string; emailKey: string; projectId: string }): Promise<TrialClaimResult> {
  const db = getDb();
  const inserted = await db`
    insert into carousel_trial_claims (user_id, email_key, project_id)
    values (${input.userId}, ${input.emailKey}, ${input.projectId})
    on conflict do nothing
    returning user_id
  `;
  if (inserted.length > 0) return { granted: true };
  const existing = await db`select project_id from carousel_trial_claims where user_id = ${input.userId}`;
  return { granted: existing[0]?.project_id === input.projectId };
}

/** O usuário (ou alguém com o mesmo e-mail normalizado) já usou o carrossel grátis? */
export async function isCarouselTrialUsed(userId: string, emailKey: string): Promise<boolean> {
  const rows = await getDb()`select 1 from carousel_trial_claims where user_id = ${userId} or email_key = ${emailKey} limit 1`;
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// Cobrança (Fase 6) — espelha automation-subscription-repository, com os
// mesmos "guards" de status para webhooks repetidos/atrasados serem inofensivos.
// ---------------------------------------------------------------------------
export async function getCarouselSubscriptionByAsaasId(asaasSubscriptionId: string): Promise<CarouselSubscriptionRecord | null> {
  const rows = await getDb()`select * from carousel_subscriptions where asaas_subscription_id = ${asaasSubscriptionId}`;
  return rows[0] ? toSubscription(rows[0] as Row) : null;
}

export interface CarouselCheckoutStartInput {
  planCode: CarouselPlanCode;
  listPriceCents: number;
  priceCents: number;
  discountPercent: number;
  cpfCnpj: string;
  asaasCustomerId: string;
  asaasSubscriptionId: string;
}

/** Guarda o checkout em andamento. Nunca mexe numa assinatura ACTIVE/PAST_DUE. */
export async function saveCarouselCheckoutStart(userId: string, input: CarouselCheckoutStartInput): Promise<CarouselSubscriptionRecord | null> {
  const rows = await getDb()`
    insert into carousel_subscriptions
      (user_id, plan_code, status, list_price_cents, price_cents, discount_percent, cpf_cnpj, asaas_customer_id, asaas_subscription_id)
    values
      (${userId}, ${input.planCode}, 'PENDING_PAYMENT', ${input.listPriceCents}, ${input.priceCents}, ${input.discountPercent},
       ${input.cpfCnpj}, ${input.asaasCustomerId}, ${input.asaasSubscriptionId})
    on conflict (user_id) do update set
      plan_code = excluded.plan_code, status = 'PENDING_PAYMENT',
      list_price_cents = excluded.list_price_cents, price_cents = excluded.price_cents, discount_percent = excluded.discount_percent,
      cpf_cnpj = excluded.cpf_cnpj, asaas_customer_id = excluded.asaas_customer_id, asaas_subscription_id = excluded.asaas_subscription_id,
      pending_plan_code = null, canceled_at = null, complimentary = false, updated_at = now()
    where carousel_subscriptions.status in ('PENDING_PAYMENT', 'EXPIRED', 'CANCELED')
       or (carousel_subscriptions.complimentary = true)
    returning *
  `;
  return rows[0] ? toSubscription(rows[0] as Row) : null;
}

export async function setCarouselPendingPlan(userId: string, planCode: CarouselPlanCode | null): Promise<CarouselSubscriptionRecord | null> {
  const rows = await getDb()`
    update carousel_subscriptions set pending_plan_code = ${planCode}, updated_at = now()
    where user_id = ${userId} and status = 'ACTIVE' returning *
  `;
  return rows[0] ? toSubscription(rows[0] as Row) : null;
}

export async function markCarouselActiveFromPayment(
  asaasSubscriptionId: string,
  currentPeriodEndsAt: Date | null,
  now: Date,
  applyPlan: { planCode: CarouselPlanCode; listPriceCents: number; priceCents: number } | null = null,
): Promise<CarouselSubscriptionRecord | null> {
  const rows = await getDb()`
    update carousel_subscriptions set
      status = 'ACTIVE',
      started_at = coalesce(started_at, ${now.toISOString()}),
      current_period_ends_at = ${currentPeriodEndsAt ? currentPeriodEndsAt.toISOString() : null},
      plan_code = coalesce(${applyPlan?.planCode ?? null}::text, plan_code),
      list_price_cents = coalesce(${applyPlan?.listPriceCents ?? null}::integer, list_price_cents),
      price_cents = coalesce(${applyPlan?.priceCents ?? null}::integer, price_cents),
      pending_plan_code = case when pending_plan_code = ${applyPlan?.planCode ?? null}::text then null else pending_plan_code end,
      updated_at = now()
    where asaas_subscription_id = ${asaasSubscriptionId} and status <> 'CANCELED'
    returning *
  `;
  return rows[0] ? toSubscription(rows[0] as Row) : null;
}

export async function markCarouselPastDue(asaasSubscriptionId: string): Promise<CarouselSubscriptionRecord | null> {
  const rows = await getDb()`
    update carousel_subscriptions set status = 'PAST_DUE', updated_at = now()
    where asaas_subscription_id = ${asaasSubscriptionId} and status in ('ACTIVE', 'PENDING_PAYMENT') returning *
  `;
  return rows[0] ? toSubscription(rows[0] as Row) : null;
}

export async function markCarouselCanceled(userId: string, now: Date): Promise<CarouselSubscriptionRecord | null> {
  const rows = await getDb()`
    update carousel_subscriptions set status = 'CANCELED', canceled_at = ${now.toISOString()}, pending_plan_code = null, updated_at = now()
    where user_id = ${userId} and status in ('ACTIVE', 'PAST_DUE', 'PENDING_PAYMENT') returning *
  `;
  return rows[0] ? toSubscription(rows[0] as Row) : null;
}

export async function markCarouselCanceledByAsaasId(asaasSubscriptionId: string, now: Date): Promise<CarouselSubscriptionRecord | null> {
  const rows = await getDb()`
    update carousel_subscriptions set status = 'CANCELED', canceled_at = coalesce(canceled_at, ${now.toISOString()}), pending_plan_code = null, updated_at = now()
    where asaas_subscription_id = ${asaasSubscriptionId} and status in ('ACTIVE', 'PAST_DUE', 'PENDING_PAYMENT') returning *
  `;
  return rows[0] ? toSubscription(rows[0] as Row) : null;
}

export async function markCarouselReactivated(userId: string, newAsaasSubscriptionId: string, now: Date): Promise<CarouselSubscriptionRecord | null> {
  const rows = await getDb()`
    update carousel_subscriptions set status = 'ACTIVE', asaas_subscription_id = ${newAsaasSubscriptionId}, canceled_at = null, updated_at = now()
    where user_id = ${userId} and status = 'CANCELED' and current_period_ends_at > ${now.toISOString()} returning *
  `;
  return rows[0] ? toSubscription(rows[0] as Row) : null;
}

export async function markCarouselPlanUpgraded(
  userId: string,
  planCode: CarouselPlanCode,
  listPriceCents: number,
  priceCents: number,
  fromPlanCodes: readonly CarouselPlanCode[],
): Promise<CarouselSubscriptionRecord | null> {
  const rows = await getDb()`
    update carousel_subscriptions set
      plan_code = ${planCode}, list_price_cents = ${listPriceCents}, price_cents = ${priceCents}, pending_plan_code = null, updated_at = now()
    where user_id = ${userId} and status = 'ACTIVE' and plan_code = any(${[...fromPlanCodes]}::text[])
    returning *
  `;
  return rows[0] ? toSubscription(rows[0] as Row) : null;
}

/** Cortesia do admin: plano ativo sem cobrança até `endsAt`. Nunca sobrescreve assinatura paga ativa. */
export async function grantCarouselComplimentary(input: { userId: string; planCode: CarouselPlanCode; listPriceCents: number; endsAt: Date; note: string | null; now: Date }): Promise<CarouselSubscriptionRecord | null> {
  const rows = await getDb()`
    insert into carousel_subscriptions
      (user_id, plan_code, status, list_price_cents, price_cents, discount_percent, complimentary, admin_note, started_at, current_period_ends_at)
    values
      (${input.userId}, ${input.planCode}, 'ACTIVE', ${input.listPriceCents}, ${input.listPriceCents}, 0, true, ${input.note}, ${input.now.toISOString()}, ${input.endsAt.toISOString()})
    on conflict (user_id) do update set
      plan_code = excluded.plan_code, status = 'ACTIVE', complimentary = true, admin_note = excluded.admin_note,
      list_price_cents = excluded.list_price_cents, price_cents = excluded.price_cents, discount_percent = 0,
      pending_plan_code = null, canceled_at = null, started_at = excluded.started_at, current_period_ends_at = excluded.current_period_ends_at, updated_at = now()
    where carousel_subscriptions.status <> 'ACTIVE' or carousel_subscriptions.complimentary = true
    returning *
  `;
  return rows[0] ? toSubscription(rows[0] as Row) : null;
}

/** Encerra uma cortesia (admin). Assinatura paga não é tocada. */
export async function endCarouselComplimentary(userId: string, now: Date): Promise<boolean> {
  const rows = await getDb()`
    update carousel_subscriptions set status = 'EXPIRED', current_period_ends_at = ${now.toISOString()}, updated_at = now()
    where user_id = ${userId} and complimentary = true returning id
  `;
  return rows.length > 0;
}
