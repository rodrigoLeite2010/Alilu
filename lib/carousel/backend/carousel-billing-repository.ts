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
