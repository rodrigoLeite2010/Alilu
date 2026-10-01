import "server-only";
import { getDb } from "@/lib/db/client";

export type CreditPurchaseStatus = "PENDING" | "PAID" | "CANCELED" | "REFUNDED" | "CHARGEBACK";

export interface CreditPurchaseRecord {
  id: string;
  userId: string;
  packageId: string | null;
  packageName: string;
  credits: number;
  bonusCredits: number;
  priceCents: number;
  asaasPaymentId: string | null;
  invoiceUrl: string | null;
  status: CreditPurchaseStatus;
  paidAt: Date | null;
  refundedAt: Date | null;
  createdAt: Date;
}

function mapPurchase(row: Record<string, unknown>): CreditPurchaseRecord {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    packageId: (row.package_id as string | null) ?? null,
    packageName: row.package_name as string,
    credits: Number(row.credits),
    bonusCredits: Number(row.bonus_credits),
    priceCents: Number(row.price_cents),
    asaasPaymentId: (row.asaas_payment_id as string | null) ?? null,
    invoiceUrl: (row.invoice_url as string | null) ?? null,
    status: row.status as CreditPurchaseStatus,
    paidAt: row.paid_at ? new Date(row.paid_at as string) : null,
    refundedAt: row.refunded_at ? new Date(row.refunded_at as string) : null,
    createdAt: new Date(row.created_at as string),
  };
}

export async function insertPurchase(input: {
  userId: string;
  packageId: string;
  packageName: string;
  credits: number;
  bonusCredits: number;
  priceCents: number;
}): Promise<CreditPurchaseRecord> {
  const db = getDb();
  const rows = await db`
    insert into ai_credit_purchases (user_id, package_id, package_name, credits, bonus_credits, price_cents)
    values (${input.userId}, ${input.packageId}, ${input.packageName}, ${input.credits}, ${input.bonusCredits}, ${input.priceCents})
    returning *
  `;
  return mapPurchase(rows[0]);
}

export async function attachAsaasPayment(id: string, asaasPaymentId: string, invoiceUrl: string | null): Promise<void> {
  const db = getDb();
  await db`
    update ai_credit_purchases set asaas_payment_id = ${asaasPaymentId}, invoice_url = ${invoiceUrl}, updated_at = now()
    where id = ${id}
  `;
}

/** Compra pendente recente do mesmo pacote (clique duplo / voltou sem pagar) — reaproveitada em vez de criar outra cobrança. */
export async function findReusablePendingPurchase(userId: string, packageId: string, since: Date): Promise<CreditPurchaseRecord | null> {
  const db = getDb();
  const rows = await db`
    select * from ai_credit_purchases
    where user_id = ${userId} and package_id = ${packageId} and status = 'PENDING'
      and invoice_url is not null and created_at >= ${since.toISOString()}
    order by created_at desc limit 1
  `;
  return rows[0] ? mapPurchase(rows[0]) : null;
}

export async function getPurchaseByAsaasPaymentId(asaasPaymentId: string): Promise<CreditPurchaseRecord | null> {
  const db = getDb();
  const rows = await db`select * from ai_credit_purchases where asaas_payment_id = ${asaasPaymentId}`;
  return rows[0] ? mapPurchase(rows[0]) : null;
}

export async function getPurchaseForUser(id: string, userId: string): Promise<CreditPurchaseRecord | null> {
  const db = getDb();
  const rows = await db`select * from ai_credit_purchases where id = ${id} and user_id = ${userId}`;
  return rows[0] ? mapPurchase(rows[0]) : null;
}

export async function listPurchasesForUser(userId: string, limit = 20): Promise<CreditPurchaseRecord[]> {
  const db = getDb();
  const rows = await db`
    select * from ai_credit_purchases where user_id = ${userId} and asaas_payment_id is not null
    order by created_at desc limit ${limit}
  `;
  return rows.map(mapPurchase);
}

/** Transição de status atômica (só a partir dos status permitidos). Devolve a linha se mudou. */
export async function transitionPurchase(
  id: string,
  from: CreditPurchaseStatus[],
  to: CreditPurchaseStatus,
  now: Date,
): Promise<CreditPurchaseRecord | null> {
  const db = getDb();
  const rows = await db`
    update ai_credit_purchases
    set status = ${to},
        paid_at = case when ${to} = 'PAID' then ${now.toISOString()}::timestamptz else paid_at end,
        refunded_at = case when ${to} in ('REFUNDED', 'CHARGEBACK') then ${now.toISOString()}::timestamptz else refunded_at end,
        updated_at = now()
    where id = ${id} and status = any(string_to_array(${from.join(",")}, ','))
    returning *
  `;
  return rows[0] ? mapPurchase(rows[0]) : null;
}
