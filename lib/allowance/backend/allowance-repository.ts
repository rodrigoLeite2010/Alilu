import "server-only";
import { getDb } from "@/lib/db/client";
import type { CategoryType, SourceType, TransactionType } from "../types";

/**
 * SQL da Mesada. Regras:
 * - toda leitura/escrita é filtrada pelo dono (user_id da sessão) via allowance_children;
 * - o saldo NUNCA é coluna: sai das movimentações (disponível = entradas + retiradas − gastos − guardado);
 * - cada operação financeira é UM comando SQL atômico (o driver HTTP do Neon não tem BEGIN/COMMIT):
 *   a checagem de saldo e o lançamento acontecem juntos.
 */

type Row = Record<string, unknown>;
const num = (value: unknown) => Number(value ?? 0);
const dateStr = (value: unknown): string | null => {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
};

// ---------------------------------------------------------------------------
// Crianças
// ---------------------------------------------------------------------------
export interface ChildRecord {
  id: string;
  userId: string;
  name: string;
  avatar: string | null;
  birthDate: string | null;
  allowNegativeBalance: boolean;
  weeklyLimitCents: number | null;
  active: boolean;
}

function mapChild(row: Row): ChildRecord {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    avatar: (row.avatar as string | null) ?? null,
    birthDate: dateStr(row.birth_date),
    allowNegativeBalance: Boolean(row.allow_negative_balance),
    weeklyLimitCents: row.weekly_limit_cents === null || row.weekly_limit_cents === undefined ? null : num(row.weekly_limit_cents),
    active: Boolean(row.active),
  };
}

export async function listChildren(userId: string): Promise<ChildRecord[]> {
  const rows = await getDb()`select * from allowance_children where user_id = ${userId} and active order by created_at, id`;
  return rows.map(mapChild);
}

export async function getChildForUser(userId: string, childId: string): Promise<ChildRecord | null> {
  const rows = await getDb()`select * from allowance_children where id = ${childId} and user_id = ${userId}`;
  return rows[0] ? mapChild(rows[0]) : null;
}

export async function insertChild(
  userId: string,
  input: { name: string; avatar: string | null; birthDate: string | null },
): Promise<ChildRecord> {
  const rows = await getDb()`
    insert into allowance_children (user_id, name, avatar, birth_date)
    values (${userId}, ${input.name}, ${input.avatar}, ${input.birthDate}) returning *
  `;
  return mapChild(rows[0]);
}

export async function updateChild(
  userId: string,
  childId: string,
  patch: {
    name?: string;
    avatar?: string | null;
    birthDate?: string | null;
    allowNegativeBalance?: boolean;
    weeklyLimitCents?: number | null;
    active?: boolean;
  },
): Promise<ChildRecord | null> {
  const current = await getChildForUser(userId, childId);
  if (!current) return null;
  const pick = <T>(value: T | undefined, fallback: T) => (value === undefined ? fallback : value);
  const rows = await getDb()`
    update allowance_children set
      name = ${pick(patch.name, current.name)},
      avatar = ${pick(patch.avatar, current.avatar)},
      birth_date = ${pick(patch.birthDate, current.birthDate)},
      allow_negative_balance = ${pick(patch.allowNegativeBalance, current.allowNegativeBalance)},
      weekly_limit_cents = ${pick(patch.weeklyLimitCents, current.weeklyLimitCents)},
      active = ${pick(patch.active, current.active)},
      updated_at = now()
    where id = ${childId} and user_id = ${userId} returning *
  `;
  return rows[0] ? mapChild(rows[0]) : null;
}

// ---------------------------------------------------------------------------
// Saldos (fonte de verdade = movimentações)
// ---------------------------------------------------------------------------
export interface Balances {
  availableCents: number;
  savingsCents: number;
}

export async function getBalances(childId: string): Promise<Balances> {
  const rows = await getDb()`
    select
      coalesce(sum(case type when 'INCOME' then amount_cents when 'SAVINGS_WITHDRAWAL' then amount_cents
                             else -amount_cents end), 0) as available,
      coalesce(sum(case type when 'SAVINGS_TRANSFER' then amount_cents when 'SAVINGS_WITHDRAWAL' then -amount_cents
                             else 0 end), 0) as savings
    from allowance_transactions where child_id = ${childId}
  `;
  return { availableCents: num(rows[0]?.available), savingsCents: num(rows[0]?.savings) };
}

export async function getBalancesForChildren(childIds: string[]): Promise<Map<string, Balances>> {
  const map = new Map<string, Balances>();
  if (childIds.length === 0) return map;
  const rows = await getDb()`
    select child_id,
      coalesce(sum(case type when 'INCOME' then amount_cents when 'SAVINGS_WITHDRAWAL' then amount_cents
                             else -amount_cents end), 0) as available,
      coalesce(sum(case type when 'SAVINGS_TRANSFER' then amount_cents when 'SAVINGS_WITHDRAWAL' then -amount_cents
                             else 0 end), 0) as savings
    from allowance_transactions where child_id = any(${childIds}::uuid[]) group by child_id
  `;
  for (const row of rows) map.set(row.child_id as string, { availableCents: num(row.available), savingsCents: num(row.savings) });
  return map;
}

// ---------------------------------------------------------------------------
// Mesada (plano)
// ---------------------------------------------------------------------------
export interface PlanRecord {
  id: string;
  childId: string;
  name: string;
  monthlyAmountCents: number;
  paymentDay: number;
  carryOverBalance: boolean;
  active: boolean;
  startDate: string;
}

function mapPlan(row: Row): PlanRecord {
  return {
    id: row.id as string,
    childId: row.child_id as string,
    name: row.name as string,
    monthlyAmountCents: num(row.monthly_amount_cents),
    paymentDay: num(row.payment_day),
    carryOverBalance: Boolean(row.carry_over_balance),
    active: Boolean(row.active),
    startDate: dateStr(row.start_date) as string,
  };
}

export async function getActivePlan(childId: string): Promise<PlanRecord | null> {
  const rows = await getDb()`select * from allowance_plans where child_id = ${childId} and active order by created_at desc limit 1`;
  return rows[0] ? mapPlan(rows[0]) : null;
}

export async function getActivePlansForChildren(childIds: string[]): Promise<Map<string, PlanRecord>> {
  const map = new Map<string, PlanRecord>();
  if (childIds.length === 0) return map;
  const rows = await getDb()`
    select distinct on (child_id) * from allowance_plans
    where child_id = any(${childIds}::uuid[]) and active order by child_id, created_at desc
  `;
  for (const row of rows) map.set(row.child_id as string, mapPlan(row));
  return map;
}

export async function savePlan(
  childId: string,
  input: { name: string; monthlyAmountCents: number; paymentDay: number; carryOverBalance: boolean; startDate: string },
): Promise<PlanRecord> {
  const db = getDb();
  const existing = await getActivePlan(childId);
  if (existing) {
    const rows = await db`
      update allowance_plans set name = ${input.name}, monthly_amount_cents = ${input.monthlyAmountCents},
        payment_day = ${input.paymentDay}, carry_over_balance = ${input.carryOverBalance}, updated_at = now()
      where id = ${existing.id} returning *
    `;
    return mapPlan(rows[0]);
  }
  const rows = await db`
    insert into allowance_plans (child_id, name, monthly_amount_cents, payment_day, carry_over_balance, start_date)
    values (${childId}, ${input.name}, ${input.monthlyAmountCents}, ${input.paymentDay}, ${input.carryOverBalance}, ${input.startDate})
    returning *
  `;
  return mapPlan(rows[0]);
}

export async function deactivatePlan(childId: string): Promise<void> {
  await getDb()`update allowance_plans set active = false, updated_at = now() where child_id = ${childId} and active`;
}

/** Mesadas ativas de crianças ativas (cron). */
export async function listActivePlansWithOwner(): Promise<Array<PlanRecord & { userId: string }>> {
  const rows = await getDb()`
    select p.*, c.user_id from allowance_plans p join allowance_children c on c.id = p.child_id
    where p.active and c.active and p.monthly_amount_cents > 0
  `;
  return rows.map((row) => ({ ...mapPlan(row), userId: row.user_id as string }));
}

// ---------------------------------------------------------------------------
// Categorias
// ---------------------------------------------------------------------------
export interface CategoryRecord {
  id: string;
  userId: string | null;
  name: string;
  type: CategoryType;
  icon: string;
  color: string | null;
  isSystem: boolean;
  active: boolean;
  sortOrder: number;
}

function mapCategory(row: Row): CategoryRecord {
  return {
    id: row.id as string,
    userId: (row.user_id as string | null) ?? null,
    name: row.name as string,
    type: row.type as CategoryType,
    icon: row.icon as string,
    color: (row.color as string | null) ?? null,
    isSystem: Boolean(row.is_system),
    active: Boolean(row.active),
    sortOrder: num(row.sort_order),
  };
}

/** Padrão do sistema + personalizadas do usuário. */
export async function listCategories(userId: string, includeInactive = false): Promise<CategoryRecord[]> {
  const rows = await getDb()`
    select * from allowance_categories
    where (user_id is null or user_id = ${userId}) and (active or ${includeInactive})
    order by type, sort_order, name
  `;
  return rows.map(mapCategory);
}

export async function getCategoryForUser(userId: string, id: string): Promise<CategoryRecord | null> {
  const rows = await getDb()`select * from allowance_categories where id = ${id} and (user_id is null or user_id = ${userId})`;
  return rows[0] ? mapCategory(rows[0]) : null;
}

export async function insertCategory(
  userId: string,
  input: { name: string; type: CategoryType; icon: string; color: string | null; sortOrder: number },
): Promise<CategoryRecord> {
  const rows = await getDb()`
    insert into allowance_categories (user_id, name, type, icon, color, sort_order)
    values (${userId}, ${input.name}, ${input.type}, ${input.icon}, ${input.color}, ${input.sortOrder}) returning *
  `;
  return mapCategory(rows[0]);
}

/** Só categorias PRÓPRIAS (as do sistema nunca mudam). */
export async function updateOwnCategory(
  userId: string,
  id: string,
  patch: { name?: string; icon?: string; color?: string | null; active?: boolean; sortOrder?: number },
): Promise<CategoryRecord | null> {
  const rows = await getDb()`select * from allowance_categories where id = ${id} and user_id = ${userId}`;
  if (!rows[0]) return null;
  const current = mapCategory(rows[0]);
  const pick = <T>(value: T | undefined, fallback: T) => (value === undefined ? fallback : value);
  const updated = await getDb()`
    update allowance_categories set name = ${pick(patch.name, current.name)}, icon = ${pick(patch.icon, current.icon)},
      color = ${pick(patch.color, current.color)}, active = ${pick(patch.active, current.active)},
      sort_order = ${pick(patch.sortOrder, current.sortOrder)}
    where id = ${id} and user_id = ${userId} returning *
  `;
  return updated[0] ? mapCategory(updated[0]) : null;
}

export async function getSystemCategoryId(type: CategoryType, name: string): Promise<string | null> {
  const rows = await getDb()`select id from allowance_categories where user_id is null and type = ${type} and name = ${name}`;
  return rows[0] ? (rows[0].id as string) : null;
}

// ---------------------------------------------------------------------------
// Movimentações
// ---------------------------------------------------------------------------
export interface TransactionRecord {
  id: string;
  childId: string;
  type: TransactionType;
  sourceType: SourceType;
  categoryId: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  goalId: string | null;
  goalName: string | null;
  amountCents: number;
  description: string;
  date: string;
  referenceId: string | null;
}

function mapTransaction(row: Row): TransactionRecord {
  return {
    id: row.id as string,
    childId: row.child_id as string,
    type: row.type as TransactionType,
    sourceType: row.source_type as SourceType,
    categoryId: (row.category_id as string | null) ?? null,
    categoryName: (row.category_name as string | null) ?? null,
    categoryIcon: (row.category_icon as string | null) ?? null,
    goalId: (row.goal_id as string | null) ?? null,
    goalName: (row.goal_name as string | null) ?? null,
    amountCents: num(row.amount_cents),
    description: (row.description as string | null) ?? "",
    date: dateStr(row.transaction_date) as string,
    referenceId: (row.reference_id as string | null) ?? null,
  };
}

/**
 * GASTO — só lança se a criança é do usuário e (há saldo OU a criança permite saldo negativo).
 * Checagem e lançamento no mesmo comando.
 */
export async function insertExpense(
  userId: string,
  input: { childId: string; categoryId: string | null; amountCents: number; description: string; date: string },
): Promise<string | null> {
  const rows = await getDb()`
    insert into allowance_transactions (child_id, type, category_id, amount_cents, description, transaction_date, source_type, created_by_user_id)
    select c.id, 'EXPENSE', ${input.categoryId}, ${input.amountCents}, ${input.description}, ${input.date}, 'MANUAL', ${userId}
    from allowance_children c
    where c.id = ${input.childId} and c.user_id = ${userId}
      and (c.allow_negative_balance or (
        select coalesce(sum(case t.type when 'INCOME' then t.amount_cents when 'SAVINGS_WITHDRAWAL' then t.amount_cents
                                        else -t.amount_cents end), 0)
        from allowance_transactions t where t.child_id = c.id) >= ${input.amountCents})
    returning id
  `;
  return rows[0] ? (rows[0].id as string) : null;
}

export async function insertIncome(
  userId: string,
  input: { childId: string; categoryId: string | null; amountCents: number; description: string; date: string },
): Promise<string | null> {
  const rows = await getDb()`
    insert into allowance_transactions (child_id, type, category_id, amount_cents, description, transaction_date, source_type, created_by_user_id)
    select c.id, 'INCOME', ${input.categoryId}, ${input.amountCents}, ${input.description}, ${input.date}, 'MANUAL', ${userId}
    from allowance_children c where c.id = ${input.childId} and c.user_id = ${userId}
    returning id
  `;
  return rows[0] ? (rows[0].id as string) : null;
}

/** GUARDAR — nunca mais do que o saldo disponível (independe de saldo negativo permitido). */
export async function insertSavingsDeposit(
  userId: string,
  input: { childId: string; goalId: string | null; amountCents: number; description: string; date: string },
): Promise<string | null> {
  const rows = await getDb()`
    insert into allowance_transactions (child_id, type, goal_id, amount_cents, description, transaction_date, source_type, created_by_user_id)
    select c.id, 'SAVINGS_TRANSFER', ${input.goalId}, ${input.amountCents}, ${input.description}, ${input.date}, 'SAVINGS', ${userId}
    from allowance_children c
    where c.id = ${input.childId} and c.user_id = ${userId}
      and (select coalesce(sum(case t.type when 'INCOME' then t.amount_cents when 'SAVINGS_WITHDRAWAL' then t.amount_cents
                                           else -t.amount_cents end), 0)
           from allowance_transactions t where t.child_id = c.id) >= ${input.amountCents}
    returning id
  `;
  return rows[0] ? (rows[0].id as string) : null;
}

/** RETIRAR — nunca mais do que há no cofrinho (e, com meta, do que há guardado nela). */
export async function insertSavingsWithdrawal(
  userId: string,
  input: { childId: string; goalId: string | null; amountCents: number; description: string; date: string },
): Promise<string | null> {
  const rows = await getDb()`
    insert into allowance_transactions (child_id, type, goal_id, amount_cents, description, transaction_date, source_type, created_by_user_id)
    select c.id, 'SAVINGS_WITHDRAWAL', ${input.goalId}, ${input.amountCents}, ${input.description}, ${input.date}, 'SAVINGS', ${userId}
    from allowance_children c
    where c.id = ${input.childId} and c.user_id = ${userId}
      and (select coalesce(sum(case t.type when 'SAVINGS_TRANSFER' then t.amount_cents when 'SAVINGS_WITHDRAWAL' then -t.amount_cents
                                           else 0 end), 0)
           from allowance_transactions t where t.child_id = c.id) >= ${input.amountCents}
      and (${input.goalId}::uuid is null or (
        select coalesce(sum(case t.type when 'SAVINGS_TRANSFER' then t.amount_cents when 'SAVINGS_WITHDRAWAL' then -t.amount_cents
                                        else 0 end), 0)
        from allowance_transactions t where t.child_id = c.id and t.goal_id = ${input.goalId}::uuid) >= ${input.amountCents})
    returning id
  `;
  return rows[0] ? (rows[0].id as string) : null;
}

export interface TransactionFilters {
  from?: string;
  to?: string;
  /** income | expense | savings | reward | allowance */
  kind?: string;
  categoryId?: string;
  limit?: number;
  offset?: number;
}

export async function listTransactions(childId: string, filters: TransactionFilters = {}): Promise<TransactionRecord[]> {
  const limit = Math.min(200, Math.max(1, filters.limit ?? 50));
  const offset = Math.max(0, filters.offset ?? 0);
  const kind = filters.kind ?? "";
  const rows = await getDb()`
    select t.*, cat.name as category_name, cat.icon as category_icon, g.name as goal_name
    from allowance_transactions t
    left join allowance_categories cat on cat.id = t.category_id
    left join allowance_goals g on g.id = t.goal_id
    where t.child_id = ${childId}
      and (${filters.from ?? null}::date is null or t.transaction_date >= ${filters.from ?? null}::date)
      and (${filters.to ?? null}::date is null or t.transaction_date <= ${filters.to ?? null}::date)
      and (${filters.categoryId ?? null}::uuid is null or t.category_id = ${filters.categoryId ?? null}::uuid)
      and (${kind} = ''
        or (${kind} = 'income' and t.type = 'INCOME')
        or (${kind} = 'expense' and t.type = 'EXPENSE')
        or (${kind} = 'savings' and t.type in ('SAVINGS_TRANSFER', 'SAVINGS_WITHDRAWAL'))
        or (${kind} = 'reward' and t.source_type = 'REWARD')
        or (${kind} = 'allowance' and t.source_type = 'ALLOWANCE'))
    order by t.transaction_date desc, t.created_at desc, t.id desc
    limit ${limit} offset ${offset}
  `;
  return rows.map(mapTransaction);
}

/** Resumo do mês (por data da movimentação) + saldo acumulado até o fim do mês. */
export async function getMonthTotals(childId: string, from: string, to: string) {
  const rows = await getDb()`
    select
      coalesce(sum(amount_cents) filter (where type = 'INCOME' and source_type = 'ALLOWANCE'), 0) as allowance_income,
      coalesce(sum(amount_cents) filter (where type = 'INCOME' and source_type = 'REWARD'), 0) as reward_income,
      coalesce(sum(amount_cents) filter (where type = 'INCOME' and source_type not in ('ALLOWANCE', 'REWARD')), 0) as extra_income,
      coalesce(sum(amount_cents) filter (where type = 'EXPENSE' and source_type <> 'ADJUSTMENT'), 0) as expenses,
      coalesce(sum(amount_cents) filter (where type = 'EXPENSE' and source_type = 'ADJUSTMENT'), 0) as adjustment,
      coalesce(sum(amount_cents) filter (where type = 'SAVINGS_TRANSFER'), 0) as savings,
      coalesce(sum(amount_cents) filter (where type = 'SAVINGS_WITHDRAWAL'), 0) as withdrawals
    from allowance_transactions
    where child_id = ${childId} and transaction_date >= ${from}::date and transaction_date <= ${to}::date
  `;
  const balance = await getDb()`
    select coalesce(sum(case type when 'INCOME' then amount_cents when 'SAVINGS_WITHDRAWAL' then amount_cents else -amount_cents end), 0) as available
    from allowance_transactions where child_id = ${childId} and transaction_date <= ${to}::date
  `;
  const r = rows[0];
  return {
    allowanceIncomeCents: num(r.allowance_income),
    rewardIncomeCents: num(r.reward_income),
    extraIncomeCents: num(r.extra_income),
    expensesCents: num(r.expenses),
    adjustmentCents: num(r.adjustment),
    savingsCents: num(r.savings),
    withdrawalsCents: num(r.withdrawals),
    balanceCents: num(balance[0]?.available),
  };
}

export async function getSpendingByCategory(childId: string, from: string, to: string) {
  const rows = await getDb()`
    select t.category_id, coalesce(c.name, 'Sem categoria') as name, coalesce(c.icon, '🏷️') as icon, sum(t.amount_cents) as total
    from allowance_transactions t left join allowance_categories c on c.id = t.category_id
    where t.child_id = ${childId} and t.type = 'EXPENSE' and t.source_type <> 'ADJUSTMENT'
      and t.transaction_date >= ${from}::date and t.transaction_date <= ${to}::date
    group by t.category_id, c.name, c.icon order by total desc
  `;
  return rows.map((row) => ({ categoryId: (row.category_id as string | null) ?? null, name: row.name as string, icon: row.icon as string, totalCents: num(row.total) }));
}

export async function sumExpenses(childId: string, from: string, to: string): Promise<number> {
  const rows = await getDb()`
    select coalesce(sum(amount_cents), 0) as total from allowance_transactions
    where child_id = ${childId} and type = 'EXPENSE' and source_type <> 'ADJUSTMENT'
      and transaction_date >= ${from}::date and transaction_date <= ${to}::date
  `;
  return num(rows[0]?.total);
}

/** Dados para as medalhas (tudo derivado das movimentações). */
export async function getBadgeFacts(childId: string, currentMonthStart: string) {
  const db = getDb();
  const [saving] = await db`
    select count(*)::int as n, count(distinct to_char(transaction_date, 'YYYY-MM'))::int as months
    from allowance_transactions where child_id = ${childId} and type = 'SAVINGS_TRANSFER'
  `;
  const [notAll] = await db`
    select count(*)::int as n from (
      select to_char(transaction_date, 'YYYY-MM') as ym,
        sum(amount_cents) filter (where type = 'INCOME' and source_type = 'ALLOWANCE') as received,
        sum(amount_cents) filter (where type = 'EXPENSE' and source_type <> 'ADJUSTMENT') as spent
      from allowance_transactions where child_id = ${childId} and transaction_date < ${currentMonthStart}::date
      group by 1
    ) m where coalesce(m.received, 0) > 0 and coalesce(m.spent, 0) < m.received
  `;
  return { savingDeposits: num(saving?.n), savingMonths: num(saving?.months), monthsNotAllSpent: num(notAll?.n) };
}

// ---------------------------------------------------------------------------
// Mesada automática (idempotente)
// ---------------------------------------------------------------------------
/** Entrada da mesada do mês: no máximo UMA por (criança, plano, ano-mês). Devolve true se lançou agora. */
export async function insertMonthlyAllowance(input: {
  childId: string;
  planId: string;
  planName: string;
  amountCents: number;
  yearMonth: string;
  date: string;
}): Promise<boolean> {
  const categoryId = await getSystemCategoryId("INCOME", "Mesada");
  const rows = await getDb()`
    insert into allowance_transactions (child_id, type, category_id, amount_cents, description, transaction_date, source_type, reference_id)
    values (${input.childId}, 'INCOME', ${categoryId}, ${input.amountCents}, ${input.planName}, ${input.date}, 'ALLOWANCE', ${`${input.planId}:${input.yearMonth}`})
    on conflict (child_id, source_type, reference_id) where reference_id is not null do nothing
    returning id
  `;
  return rows.length > 0;
}

/** "Não acumular": zera o saldo disponível ANTES da nova mesada com um lançamento de ajuste (histórico preservado). */
export async function insertClosingAdjustment(input: { childId: string; planId: string; yearMonth: string; date: string }): Promise<boolean> {
  const rows = await getDb()`
    insert into allowance_transactions (child_id, type, amount_cents, description, transaction_date, source_type, reference_id)
    select ${input.childId}, 'EXPENSE', b.available, 'Ajuste de fechamento (saldo não acumulado)', ${input.date}::date, 'ADJUSTMENT', ${`${input.planId}:${input.yearMonth}:close`}
    from (
      select coalesce(sum(case type when 'INCOME' then amount_cents when 'SAVINGS_WITHDRAWAL' then amount_cents else -amount_cents end), 0) as available
      from allowance_transactions where child_id = ${input.childId}
    ) b
    where b.available > 0
      -- só fecha ANTES da mesada do mês entrar; depois dela o fechamento daquele mês nunca mais acontece
      and not exists (select 1 from allowance_transactions a where a.child_id = ${input.childId} and a.source_type = 'ALLOWANCE'
                      and a.reference_id = ${`${input.planId}:${input.yearMonth}`})
    on conflict (child_id, source_type, reference_id) where reference_id is not null do nothing
    returning id
  `;
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// Metas
// ---------------------------------------------------------------------------
export interface GoalRecord {
  id: string;
  childId: string;
  name: string;
  targetCents: number;
  targetDate: string | null;
  icon: string;
  status: "ACTIVE" | "ACHIEVED" | "CANCELED";
  savedCents: number;
}

function mapGoal(row: Row): GoalRecord {
  return {
    id: row.id as string,
    childId: row.child_id as string,
    name: row.name as string,
    targetCents: num(row.target_cents),
    targetDate: dateStr(row.target_date),
    icon: row.icon as string,
    status: row.status as GoalRecord["status"],
    savedCents: num(row.saved),
  };
}

export async function insertGoal(
  childId: string,
  input: { name: string; targetCents: number; targetDate: string | null; icon: string },
): Promise<GoalRecord> {
  const rows = await getDb()`
    insert into allowance_goals (child_id, name, target_cents, target_date, icon)
    values (${childId}, ${input.name}, ${input.targetCents}, ${input.targetDate}, ${input.icon}) returning *, 0 as saved
  `;
  return mapGoal(rows[0]);
}

export async function listGoals(childId: string, includeCanceled = false): Promise<GoalRecord[]> {
  const rows = await getDb()`
    select g.*, coalesce((
      select sum(case t.type when 'SAVINGS_TRANSFER' then t.amount_cents when 'SAVINGS_WITHDRAWAL' then -t.amount_cents else 0 end)
      from allowance_transactions t where t.goal_id = g.id), 0) as saved
    from allowance_goals g where g.child_id = ${childId} and (g.status <> 'CANCELED' or ${includeCanceled})
    order by g.status, g.created_at
  `;
  return rows.map(mapGoal);
}

export async function getGoal(childId: string, goalId: string): Promise<GoalRecord | null> {
  return (await listGoals(childId, true)).find((goal) => goal.id === goalId) ?? null;
}

export async function updateGoal(
  childId: string,
  goalId: string,
  patch: { name?: string; targetCents?: number; targetDate?: string | null; icon?: string; status?: GoalRecord["status"] },
): Promise<GoalRecord | null> {
  const current = await getGoal(childId, goalId);
  if (!current) return null;
  const pick = <T>(value: T | undefined, fallback: T) => (value === undefined ? fallback : value);
  await getDb()`
    update allowance_goals set name = ${pick(patch.name, current.name)}, target_cents = ${pick(patch.targetCents, current.targetCents)},
      target_date = ${pick(patch.targetDate, current.targetDate)}, icon = ${pick(patch.icon, current.icon)},
      status = ${pick(patch.status, current.status)}, updated_at = now()
    where id = ${goalId} and child_id = ${childId}
  `;
  return getGoal(childId, goalId);
}

// ---------------------------------------------------------------------------
// Tarefas e recompensas
// ---------------------------------------------------------------------------
export interface TaskRecord {
  id: string;
  childId: string;
  name: string;
  description: string | null;
  hasReward: boolean;
  rewardCents: number;
  repeatable: boolean;
  active: boolean;
  pendingCompletionId: string | null;
  completedCount: number;
}

function mapTask(row: Row): TaskRecord {
  return {
    id: row.id as string,
    childId: row.child_id as string,
    name: row.name as string,
    description: (row.description as string | null) ?? null,
    hasReward: Boolean(row.has_reward),
    rewardCents: num(row.reward_cents),
    repeatable: Boolean(row.repeatable),
    active: Boolean(row.active),
    pendingCompletionId: (row.pending_id as string | null) ?? null,
    completedCount: num(row.completed_count),
  };
}


export async function listTasks(childId: string, includeInactive = false): Promise<TaskRecord[]> {
  const rows = await getDb()`
    select t.*,
      (select c.id from allowance_task_completions c where c.task_id = t.id and c.status = 'PENDING' order by c.completed_at limit 1) as pending_id,
      (select count(*) from allowance_task_completions c where c.task_id = t.id and c.status = 'APPROVED') as completed_count
    from allowance_tasks t where t.child_id = ${childId} and (t.active or ${includeInactive})
    order by t.created_at, t.id
  `;
  return rows.map(mapTask);
}

export async function getTask(childId: string, taskId: string): Promise<TaskRecord | null> {
  return (await listTasks(childId, true)).find((task) => task.id === taskId) ?? null;
}

export async function insertTask(
  childId: string,
  input: { name: string; description: string | null; hasReward: boolean; rewardCents: number; repeatable: boolean },
): Promise<string> {
  const rows = await getDb()`
    insert into allowance_tasks (child_id, name, description, has_reward, reward_cents, repeatable)
    values (${childId}, ${input.name}, ${input.description}, ${input.hasReward}, ${input.rewardCents}, ${input.repeatable}) returning id
  `;
  return rows[0].id as string;
}

export async function updateTask(
  childId: string,
  taskId: string,
  patch: { name?: string; description?: string | null; hasReward?: boolean; rewardCents?: number; repeatable?: boolean; active?: boolean },
): Promise<boolean> {
  const current = await getTask(childId, taskId);
  if (!current) return false;
  const pick = <T>(value: T | undefined, fallback: T) => (value === undefined ? fallback : value);
  const hasReward = pick(patch.hasReward, current.hasReward);
  const rewardCents = hasReward ? pick(patch.rewardCents, current.rewardCents) : 0;
  await getDb()`
    update allowance_tasks set name = ${pick(patch.name, current.name)}, description = ${pick(patch.description, current.description)},
      has_reward = ${hasReward}, reward_cents = ${rewardCents}, repeatable = ${pick(patch.repeatable, current.repeatable)},
      active = ${pick(patch.active, current.active)}, updated_at = now()
    where id = ${taskId} and child_id = ${childId}
  `;
  return true;
}

/**
 * Registra "concluída" (aguardando aprovação). Não cria dinheiro. Evita duplicar: sem outra pendente
 * e, em tarefa única, sem conclusão aprovada. Devolve o id ou null.
 */
export async function insertCompletion(childId: string, taskId: string): Promise<string | null> {
  const rows = await getDb()`
    insert into allowance_task_completions (task_id, child_id)
    select t.id, t.child_id from allowance_tasks t
    where t.id = ${taskId} and t.child_id = ${childId} and t.active
      and not exists (select 1 from allowance_task_completions c where c.task_id = t.id and c.status = 'PENDING')
      and (t.repeatable or not exists (select 1 from allowance_task_completions c where c.task_id = t.id and c.status = 'APPROVED'))
    returning id
  `;
  return rows[0] ? (rows[0].id as string) : null;
}

/**
 * APROVA a conclusão e lança a recompensa NO MESMO COMANDO (atômico). Só aprova uma vez (status PENDING);
 * o índice único (child, REWARD, completion id) é a segunda trava contra pagamento duplicado.
 */
export async function approveCompletion(
  userId: string,
  completionId: string,
  date: string,
): Promise<{ approved: boolean; paidCents: number }> {
  const categoryId = await getSystemCategoryId("INCOME", "Recompensa");
  const rows = await getDb()`
    with upd as (
      update allowance_task_completions comp
      set status = 'APPROVED', approved_at = now(), approved_by_user_id = ${userId},
          reward_amount_paid_cents = case when t.has_reward then t.reward_cents else 0 end
      from allowance_tasks t, allowance_children c
      where comp.id = ${completionId} and comp.status = 'PENDING'
        and t.id = comp.task_id and c.id = comp.child_id and c.user_id = ${userId}
      returning comp.id, comp.child_id, t.name, t.has_reward, t.reward_cents
    ), ins as (
      insert into allowance_transactions (child_id, type, category_id, amount_cents, description, transaction_date, source_type, reference_id, created_by_user_id)
      select child_id, 'INCOME', ${categoryId}, reward_cents, 'Recompensa: ' || name, ${date}::date, 'REWARD', id::text, ${userId}
      from upd where has_reward and reward_cents > 0
      returning amount_cents
    )
    select (select count(*) from upd)::int as approved, coalesce((select sum(amount_cents) from ins), 0) as paid
  `;
  return { approved: num(rows[0]?.approved) > 0, paidCents: num(rows[0]?.paid) };
}

export async function rejectCompletion(userId: string, completionId: string): Promise<boolean> {
  const rows = await getDb()`
    update allowance_task_completions comp set status = 'REJECTED', approved_at = now(), approved_by_user_id = ${userId}
    from allowance_children c
    where comp.id = ${completionId} and comp.status = 'PENDING' and c.id = comp.child_id and c.user_id = ${userId}
    returning comp.id
  `;
  return rows.length > 0;
}

export async function getCompletionOwner(completionId: string): Promise<{ childId: string; userId: string } | null> {
  const rows = await getDb()`
    select comp.child_id, c.user_id from allowance_task_completions comp join allowance_children c on c.id = comp.child_id
    where comp.id = ${completionId}
  `;
  return rows[0] ? { childId: rows[0].child_id as string, userId: rows[0].user_id as string } : null;
}

export async function sumRewardsInRange(childIds: string[], from: string, to: string): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (childIds.length === 0) return map;
  const rows = await getDb()`
    select child_id, coalesce(sum(amount_cents), 0) as total from allowance_transactions
    where child_id = any(${childIds}::uuid[]) and source_type = 'REWARD' and transaction_date >= ${from}::date and transaction_date <= ${to}::date
    group by child_id
  `;
  for (const row of rows) map.set(row.child_id as string, num(row.total));
  return map;
}

export async function countActiveGoals(childIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (childIds.length === 0) return map;
  const rows = await getDb()`
    select child_id, count(*)::int as n from allowance_goals where child_id = any(${childIds}::uuid[]) and status = 'ACTIVE' group by child_id
  `;
  for (const row of rows) map.set(row.child_id as string, num(row.n));
  return map;
}
