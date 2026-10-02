import "server-only";
import { getDb } from "@/lib/db/client";
import type { CreditTransactionType } from "../types";

/**
 * Carteira de créditos Alilu + extrato auditável.
 *
 * TODA movimentação é UM único comando SQL (CTE "update … returning" +
 * "insert … select from upd"): o saldo e o lançamento do extrato mudam
 * juntos ou não mudam — sem BEGIN/COMMIT, que o driver HTTP do Neon não
 * suporta. O WHERE do UPDATE garante que o saldo nunca fica negativo
 * (duas gerações simultâneas nunca gastam o mesmo crédito: o Postgres
 * serializa as duas pela trava da linha) e a chave única
 * (type, reference_type, reference_id) do extrato garante que um retry
 * nunca lança a mesma movimentação duas vezes.
 */

export interface WalletRecord {
  userId: string;
  available: number;
  reserved: number;
  welcomeBonusGrantedAt: Date | null;
  unrecoveredCredits: number;
}

export interface CreditTransactionRecord {
  id: string;
  userId: string;
  type: CreditTransactionType;
  amount: number;
  reservedDelta: number;
  availableAfter: number;
  reservedAfter: number;
  referenceType: string;
  referenceId: string;
  description: string;
  createdAt: Date;
}

function mapWallet(row: Record<string, unknown>): WalletRecord {
  return {
    userId: row.user_id as string,
    available: Number(row.available),
    reserved: Number(row.reserved),
    welcomeBonusGrantedAt: row.welcome_bonus_granted_at ? new Date(row.welcome_bonus_granted_at as string) : null,
    unrecoveredCredits: Number(row.unrecovered_credits ?? 0),
  };
}

function mapTransaction(row: Record<string, unknown>): CreditTransactionRecord {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    type: row.type as CreditTransactionType,
    amount: Number(row.amount),
    reservedDelta: Number(row.reserved_delta),
    availableAfter: Number(row.available_after),
    reservedAfter: Number(row.reserved_after),
    referenceType: row.reference_type as string,
    referenceId: row.reference_id as string,
    description: (row.description as string | null) ?? "",
    createdAt: new Date(row.created_at as string),
  };
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "23505";
}

export async function ensureWallet(userId: string): Promise<WalletRecord> {
  const db = getDb();
  await db`insert into ai_credit_wallets (user_id) values (${userId}) on conflict (user_id) do nothing`;
  const rows = await db`select * from ai_credit_wallets where user_id = ${userId}`;
  return mapWallet(rows[0]);
}

export async function getWallet(userId: string): Promise<WalletRecord | null> {
  const db = getDb();
  const rows = await db`select * from ai_credit_wallets where user_id = ${userId}`;
  return rows[0] ? mapWallet(rows[0]) : null;
}

export interface WalletMovementInput {
  userId: string;
  type: CreditTransactionType;
  /** Variação do saldo disponível (+/−). */
  availableDelta: number;
  /** Variação do saldo reservado (+/−). */
  reservedDelta: number;
  referenceType: string;
  referenceId: string;
  description: string;
}

export type WalletMovementResult =
  | { status: "applied"; transaction: CreditTransactionRecord }
  | { status: "duplicate"; transaction: CreditTransactionRecord }
  | { status: "insufficient" };

async function findTransaction(type: CreditTransactionType, referenceType: string, referenceId: string): Promise<CreditTransactionRecord | null> {
  const db = getDb();
  const rows = await db`
    select * from ai_credit_transactions
    where type = ${type} and reference_type = ${referenceType} and reference_id = ${referenceId}
  `;
  return rows[0] ? mapTransaction(rows[0]) : null;
}

/**
 * Movimenta a carteira atomicamente. "insufficient" quando o saldo
 * (disponível ou reservado) ficaria negativo; "duplicate" quando a mesma
 * movimentação (type + referência) já foi lançada antes — idempotente.
 */
export async function applyWalletMovement(input: WalletMovementInput): Promise<WalletMovementResult> {
  await ensureWallet(input.userId);
  const db = getDb();
  try {
    const rows = await db`
      with upd as (
        update ai_credit_wallets
        set available = available + ${input.availableDelta},
            reserved = reserved + ${input.reservedDelta},
            updated_at = now()
        where user_id = ${input.userId}
          and available + ${input.availableDelta} >= 0
          and reserved + ${input.reservedDelta} >= 0
          and not exists (
            select 1 from ai_credit_transactions t
            where t.type = ${input.type} and t.reference_type = ${input.referenceType} and t.reference_id = ${input.referenceId}
          )
        returning available, reserved
      )
      insert into ai_credit_transactions (
        user_id, type, amount, reserved_delta, available_after, reserved_after, reference_type, reference_id, description
      )
      select ${input.userId}, ${input.type}, ${input.availableDelta}, ${input.reservedDelta},
        upd.available, upd.reserved, ${input.referenceType}, ${input.referenceId}, ${input.description}
      from upd
      returning *
    `;
    if (rows[0]) return { status: "applied", transaction: mapTransaction(rows[0]) };
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
  }
  const existing = await findTransaction(input.type, input.referenceType, input.referenceId);
  return existing ? { status: "duplicate", transaction: existing } : { status: "insufficient" };
}

/**
 * Consumo final de uma geração entregue. Normalmente baixa do reservado
 * (RESERVE → CONSUME). Na recuperação de resultado, a geração pode já ter
 * sido reembolsada localmente; nesse caso baixa do disponível, e qualquer
 * diferença já usada fica em unrecovered_credits para auditoria.
 */
export async function consumeDeliveredGeneration(input: {
  userId: string;
  credits: number;
  referenceType: string;
  referenceId: string;
  description: string;
}): Promise<{ status: "applied" | "duplicate"; transaction: CreditTransactionRecord | null; unrecovered: number }> {
  await ensureWallet(input.userId);
  const credits = Math.max(0, Math.round(input.credits));
  const db = getDb();
  try {
    const rows = await db`
      with old as (
        select available, reserved from ai_credit_wallets where user_id = ${input.userId} for update
      ),
      calc as (
        select
          least(old.reserved, ${credits}) as reserved_to_consume,
          least(old.available, greatest(${credits} - least(old.reserved, ${credits}), 0)) as available_to_debit,
          greatest(${credits} - least(old.reserved, ${credits}) - least(old.available, greatest(${credits} - least(old.reserved, ${credits}), 0)), 0) as unrecovered
        from old
      ),
      upd as (
        update ai_credit_wallets w
        set available = w.available - calc.available_to_debit,
            reserved = w.reserved - calc.reserved_to_consume,
            unrecovered_credits = w.unrecovered_credits + calc.unrecovered,
            updated_at = now()
        from calc
        where w.user_id = ${input.userId}
          and not exists (
            select 1 from ai_credit_transactions t
            where t.type = 'CONSUME' and t.reference_type = ${input.referenceType} and t.reference_id = ${input.referenceId}
          )
        returning w.available, w.reserved, calc.available_to_debit, calc.reserved_to_consume, calc.unrecovered
      )
      insert into ai_credit_transactions (
        user_id, type, amount, reserved_delta, available_after, reserved_after, reference_type, reference_id, description
      )
      select ${input.userId}, 'CONSUME', -upd.available_to_debit, -upd.reserved_to_consume,
        upd.available, upd.reserved, ${input.referenceType}, ${input.referenceId}, ${input.description}
      from upd
      returning *, (select unrecovered from upd) as unrecovered
    `;
    if (rows[0]) return { status: "applied", transaction: mapTransaction(rows[0]), unrecovered: Number(rows[0].unrecovered ?? 0) };
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
  }
  const existing = await findTransaction("CONSUME", input.referenceType, input.referenceId);
  return { status: "duplicate", transaction: existing, unrecovered: 0 };
}

/**
 * Bônus de boas-vindas — no máximo UMA vez por usuário (trava em
 * welcome_bonus_granted_at, no mesmo comando do lançamento). Devolve
 * `true` só na vez em que concedeu.
 */
export async function grantWelcomeBonusOnce(userId: string, credits: number): Promise<boolean> {
  if (credits <= 0) return false;
  await ensureWallet(userId);
  const db = getDb();
  try {
    const rows = await db`
      with upd as (
        update ai_credit_wallets
        set available = available + ${credits}, welcome_bonus_granted_at = now(), updated_at = now()
        where user_id = ${userId} and welcome_bonus_granted_at is null
        returning available, reserved
      )
      insert into ai_credit_transactions (
        user_id, type, amount, reserved_delta, available_after, reserved_after, reference_type, reference_id, description
      )
      select ${userId}, 'BONUS', ${credits}, 0, upd.available, upd.reserved, 'welcome_bonus', ${userId}, 'Bônus de boas-vindas'
      from upd
      returning id
    `;
    return rows.length > 0;
  } catch (error) {
    if (isUniqueViolation(error)) return false;
    throw error;
  }
}

/**
 * Estorno/chargeback de uma compra: retira do DISPONÍVEL até `credits`
 * (nunca deixa o saldo negativo); o que já tinha sido usado vai para
 * unrecovered_credits (acompanhado pelo admin). Idempotente pela
 * referência. Devolve quanto foi efetivamente retirado.
 */
export async function debitUpToAvailable(input: {
  userId: string;
  type: Extract<CreditTransactionType, "PURCHASE_REFUND" | "CHARGEBACK" | "EXPIRE">;
  credits: number;
  referenceType: string;
  referenceId: string;
  description: string;
}): Promise<{ debited: number; unrecovered: number; duplicate: boolean }> {
  await ensureWallet(input.userId);
  const db = getDb();
  try {
    const rows = await db`
      with old as (
        select available from ai_credit_wallets where user_id = ${input.userId} for update
      ),
      upd as (
        update ai_credit_wallets w
        set available = w.available - least(old.available, ${input.credits}),
            unrecovered_credits = w.unrecovered_credits + (${input.credits} - least(old.available, ${input.credits})),
            updated_at = now()
        from old
        where w.user_id = ${input.userId}
          and not exists (
            select 1 from ai_credit_transactions t
            where t.type = ${input.type} and t.reference_type = ${input.referenceType} and t.reference_id = ${input.referenceId}
          )
        returning w.available, w.reserved, least(old.available, ${input.credits}) as debited
      )
      insert into ai_credit_transactions (
        user_id, type, amount, reserved_delta, available_after, reserved_after, reference_type, reference_id, description
      )
      select ${input.userId}, ${input.type}, -upd.debited, 0, upd.available, upd.reserved,
        ${input.referenceType}, ${input.referenceId}, ${input.description}
      from upd
      returning amount
    `;
    if (rows[0]) {
      const debited = -Number(rows[0].amount);
      return { debited, unrecovered: input.credits - debited, duplicate: false };
    }
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
  }
  return { debited: 0, unrecovered: 0, duplicate: true };
}

export async function listTransactions(userId: string, limit = 50): Promise<CreditTransactionRecord[]> {
  const db = getDb();
  const rows = await db`
    select * from ai_credit_transactions where user_id = ${userId}
    order by created_at desc, id desc
    limit ${limit}
  `;
  return rows.map(mapTransaction);
}
