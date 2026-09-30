import "server-only";
import { getDb } from "@/lib/db/client";
import type { EntryInput } from "../validation";
import type { FinEntry, OccurrencePayment } from "../types";

/**
 * Acesso ao banco da Educação Financeira. TODA consulta filtra por user_id
 * — o usuário nunca enxerga nem altera linhas de outro. Datas saem como
 * "YYYY-MM-DD" (to_char) e valores como número (float8 é exato até 2^53
 * centavos), para não depender de como o driver converte date/bigint.
 * Nunca registrar valores em log.
 */


function toEntry(row: Record<string, unknown>): FinEntry {
  return {
    id: row.id as string,
    kind: row.kind as FinEntry["kind"],
    description: row.description as string,
    amountCents: Number(row.amountCents),
    category: row.category as string,
    nature: (row.nature as FinEntry["nature"]) ?? null,
    date: row.date as string,
    recurrence: row.recurrence as FinEntry["recurrence"],
    recurrenceEnd: (row.recurrenceEnd as string | null) ?? null,
    paymentMethod: (row.paymentMethod as string | null) ?? null,
    note: (row.note as string | null) ?? null,
    paidAt: (row.paidAt as string | null) ?? null,
  };
}

/** Lançamentos que podem ter ocorrência em [from, to]. */
export async function listEntriesForRange(userId: string, from: string, to: string): Promise<FinEntry[]> {
  const db = getDb();
  const rows = await db`
    select id, kind, description, amount_cents::float8 as "amountCents", category, nature,
      to_char(entry_date, 'YYYY-MM-DD') as date, recurrence,
      to_char(recurrence_end, 'YYYY-MM-DD') as "recurrenceEnd",
      payment_method as "paymentMethod", note, paid_at::text as "paidAt"
    from fin_entries
    where user_id = ${userId}
      and entry_date <= ${to}::date
      and (
        (recurrence = 'none' and entry_date >= ${from}::date)
        or (recurrence <> 'none' and (recurrence_end is null or recurrence_end >= ${from}::date))
      )
    order by entry_date, description
  `;
  return rows.map((row) => toEntry(row as Record<string, unknown>));
}

export async function listAllEntries(userId: string, kind: "income" | "expense"): Promise<FinEntry[]> {
  const db = getDb();
  const rows = await db`
    select id, kind, description, amount_cents::float8 as "amountCents", category, nature,
      to_char(entry_date, 'YYYY-MM-DD') as date, recurrence,
      to_char(recurrence_end, 'YYYY-MM-DD') as "recurrenceEnd",
      payment_method as "paymentMethod", note, paid_at::text as "paidAt"
    from fin_entries
    where user_id = ${userId} and kind = ${kind}
    order by entry_date desc, created_at desc
    limit 500
  `;
  return rows.map((row) => toEntry(row as Record<string, unknown>));
}

export async function listPaymentsForRange(userId: string, from: string, to: string): Promise<OccurrencePayment[]> {
  const db = getDb();
  const rows = await db`
    select p.entry_id as "entryId", to_char(p.occurrence_date, 'YYYY-MM-DD') as date, p.paid_at::text as "paidAt"
    from fin_occurrence_payments p
    join fin_entries e on e.id = p.entry_id
    where e.user_id = ${userId}
      and p.occurrence_date >= ${from}::date
      and p.occurrence_date <= ${to}::date
  `;
  return rows as unknown as OccurrencePayment[];
}

export async function getEntry(userId: string, id: string): Promise<FinEntry | null> {
  const db = getDb();
  const rows = await db`
    select id, kind, description, amount_cents::float8 as "amountCents", category, nature,
      to_char(entry_date, 'YYYY-MM-DD') as date, recurrence,
      to_char(recurrence_end, 'YYYY-MM-DD') as "recurrenceEnd",
      payment_method as "paymentMethod", note, paid_at::text as "paidAt"
    from fin_entries where id = ${id} and user_id = ${userId}
  `;
  return rows[0] ? toEntry(rows[0] as Record<string, unknown>) : null;
}

export async function createEntry(userId: string, input: EntryInput): Promise<string> {
  const db = getDb();
  const paidAt = input.paid && input.recurrence === "none" ? new Date().toISOString() : null;
  const rows = await db`
    insert into fin_entries
      (user_id, kind, description, amount_cents, category, nature, entry_date,
       recurrence, recurrence_end, payment_method, note, paid_at)
    values
      (${userId}, ${input.kind}, ${input.description}, ${input.amountCents}, ${input.category}, ${input.nature},
       ${input.date}::date, ${input.recurrence}, ${input.recurrenceEnd}::date, ${input.paymentMethod}, ${input.note},
       ${paidAt}::timestamptz)
    returning id
  `;
  return rows[0].id as string;
}

/** Retorna false se o lançamento não existe ou não é do usuário. */
export async function updateEntry(userId: string, id: string, input: EntryInput): Promise<boolean> {
  const db = getDb();
  const rows = await db`
    update fin_entries set
      kind = ${input.kind}, description = ${input.description}, amount_cents = ${input.amountCents},
      category = ${input.category}, nature = ${input.nature}, entry_date = ${input.date}::date,
      recurrence = ${input.recurrence}, recurrence_end = ${input.recurrenceEnd}::date,
      payment_method = ${input.paymentMethod}, note = ${input.note}, updated_at = now()
    where id = ${id} and user_id = ${userId}
    returning id
  `;
  return rows.length > 0;
}

export async function deleteEntry(userId: string, id: string): Promise<boolean> {
  const db = getDb();
  const rows = await db`delete from fin_entries where id = ${id} and user_id = ${userId} returning id`;
  return rows.length > 0;
}

/**
 * Marca/desmarca uma ocorrência como paga (ou recebida). Não recorrente:
 * atualiza paid_at do lançamento. Recorrente: grava/remove a linha da
 * ocorrência daquele dia. Retorna false se o lançamento não é do usuário.
 */
export async function setOccurrencePaid(
  userId: string,
  entry: Pick<FinEntry, "id" | "recurrence">,
  date: string,
  paid: boolean,
): Promise<boolean> {
  const db = getDb();
  if (entry.recurrence === "none") {
    const rows = await db`
      update fin_entries set paid_at = ${paid ? new Date().toISOString() : null}::timestamptz, updated_at = now()
      where id = ${entry.id} and user_id = ${userId} returning id
    `;
    return rows.length > 0;
  }

  const owned = await db`select id from fin_entries where id = ${entry.id} and user_id = ${userId}`;
  if (owned.length === 0) return false;

  if (paid) {
    await db`
      insert into fin_occurrence_payments (entry_id, occurrence_date)
      values (${entry.id}, ${date}::date)
      on conflict (entry_id, occurrence_date) do nothing
    `;
  } else {
    await db`delete from fin_occurrence_payments where entry_id = ${entry.id} and occurrence_date = ${date}::date`;
  }
  return true;
}

export async function getSettings(userId: string): Promise<{ savingsGoalCents: number }> {
  const db = getDb();
  const rows = await db`
    select monthly_savings_goal_cents::float8 as "savingsGoalCents" from fin_settings where user_id = ${userId}
  `;
  return { savingsGoalCents: rows[0] ? Number(rows[0].savingsGoalCents) : 0 };
}

export async function setSavingsGoal(userId: string, cents: number): Promise<void> {
  const db = getDb();
  await db`
    insert into fin_settings (user_id, monthly_savings_goal_cents) values (${userId}, ${cents})
    on conflict (user_id) do update set monthly_savings_goal_cents = excluded.monthly_savings_goal_cents, updated_at = now()
  `;
}

export async function getOpeningBalance(userId: string, month: string): Promise<number> {
  const db = getDb();
  const rows = await db`
    select opening_balance_cents::float8 as cents from fin_month_balances where user_id = ${userId} and month = ${month}
  `;
  return rows[0] ? Number(rows[0].cents) : 0;
}

export async function setOpeningBalance(userId: string, month: string, cents: number): Promise<void> {
  const db = getDb();
  await db`
    insert into fin_month_balances (user_id, month, opening_balance_cents) values (${userId}, ${month}, ${cents})
    on conflict (user_id, month) do update set opening_balance_cents = excluded.opening_balance_cents, updated_at = now()
  `;
}

export interface GoalRow {
  id: string;
  name: string;
  targetCents: number;
  currentCents: number;
  targetDate: string | null;
}

function toGoal(row: Record<string, unknown>): GoalRow {
  return {
    id: row.id as string,
    name: row.name as string,
    targetCents: Number(row.targetCents),
    currentCents: Number(row.currentCents),
    targetDate: (row.targetDate as string | null) ?? null,
  };
}

export async function listGoals(userId: string): Promise<GoalRow[]> {
  const db = getDb();
  const rows = await db`
    select id, name, target_cents::float8 as "targetCents", current_cents::float8 as "currentCents",
      to_char(target_date, 'YYYY-MM-DD') as "targetDate"
    from fin_goals where user_id = ${userId} order by created_at
  `;
  return rows.map((row) => toGoal(row as Record<string, unknown>));
}

export async function getGoal(userId: string, id: string): Promise<GoalRow | null> {
  const db = getDb();
  const rows = await db`
    select id, name, target_cents::float8 as "targetCents", current_cents::float8 as "currentCents",
      to_char(target_date, 'YYYY-MM-DD') as "targetDate"
    from fin_goals where id = ${id} and user_id = ${userId}
  `;
  return rows[0] ? toGoal(rows[0] as Record<string, unknown>) : null;
}

export async function createGoal(
  userId: string,
  input: { name: string; targetCents: number; currentCents: number; targetDate: string | null },
): Promise<string> {
  const db = getDb();
  const rows = await db`
    insert into fin_goals (user_id, name, target_cents, current_cents, target_date)
    values (${userId}, ${input.name}, ${input.targetCents}, ${input.currentCents}, ${input.targetDate}::date)
    returning id
  `;
  return rows[0].id as string;
}

export async function updateGoal(
  userId: string,
  id: string,
  input: { name: string; targetCents: number; currentCents: number; targetDate: string | null },
): Promise<boolean> {
  const db = getDb();
  const rows = await db`
    update fin_goals set name = ${input.name}, target_cents = ${input.targetCents},
      current_cents = ${input.currentCents}, target_date = ${input.targetDate}::date, updated_at = now()
    where id = ${id} and user_id = ${userId} returning id
  `;
  return rows.length > 0;
}

/** Soma (ou subtrai, com valor negativo) ao valor atual da meta; nunca deixa negativo. */
export async function addToGoal(userId: string, id: string, deltaCents: number): Promise<boolean> {
  const db = getDb();
  const rows = await db`
    update fin_goals set current_cents = greatest(current_cents + ${deltaCents}, 0), updated_at = now()
    where id = ${id} and user_id = ${userId} returning id
  `;
  return rows.length > 0;
}

export async function deleteGoal(userId: string, id: string): Promise<boolean> {
  const db = getDb();
  const rows = await db`delete from fin_goals where id = ${id} and user_id = ${userId} returning id`;
  return rows.length > 0;
}

export interface CategoryLimitRow {
  category: string;
  limitCents: number;
}

export async function listCategoryLimits(userId: string): Promise<CategoryLimitRow[]> {
  const db = getDb();
  const rows = await db`
    select category, limit_cents::float8 as "limitCents"
    from fin_category_limits where user_id = ${userId} order by category
  `;
  return rows.map((row) => ({ category: row.category as string, limitCents: Number(row.limitCents) }));
}

/** Cria o limite da categoria ou atualiza o valor se já existir (1 por categoria por usuário). */
export async function setCategoryLimit(userId: string, category: string, limitCents: number): Promise<void> {
  const db = getDb();
  await db`
    insert into fin_category_limits (user_id, category, limit_cents) values (${userId}, ${category}, ${limitCents})
    on conflict (user_id, category) do update set limit_cents = excluded.limit_cents, updated_at = now()
  `;
}

export async function deleteCategoryLimit(userId: string, category: string): Promise<boolean> {
  const db = getDb();
  const rows = await db`
    delete from fin_category_limits where user_id = ${userId} and category = ${category} returning id
  `;
  return rows.length > 0;
}
