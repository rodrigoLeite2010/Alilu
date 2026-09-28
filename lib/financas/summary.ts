import { addDays, diffDays, monthRange } from "./dates";
import type { BudgetState, Occurrence, OccurrenceStatus } from "./types";

export function occurrenceStatus(occurrence: Occurrence, today: string): OccurrenceStatus {
  if (occurrence.kind === "income") {
    return occurrence.paid ? "income-received" : "income";
  }
  if (occurrence.paid) return "paid";
  return occurrence.date < today ? "overdue" : "pending";
}

export interface MonthSummary {
  incomeTotalCents: number;
  incomeReceivedCents: number;
  incomePendingCents: number;
  expenseTotalCents: number;
  expensePaidCents: number;
  /** Despesas não pagas com vencimento de hoje em diante. */
  expenseUpcomingCents: number;
  /** Despesas não pagas com vencimento anterior a hoje. */
  expenseOverdueCents: number;
  /** Saldo do mês até agora: saldo inicial + recebido − pago. */
  balanceNowCents: number;
  /** Renda do mês − despesas do mês ("Ainda disponível"). */
  availableCents: number;
  /** Saldo estimado no fim do mês, se tudo previsto acontecer. */
  projectedEndCents: number;
  savingsGoalCents: number;
  /** Projeção menos a meta de economia: o que dá para gastar livremente. */
  freeToSpendCents: number;
  state: BudgetState;
}

export function summarizeMonth(
  occurrences: Occurrence[],
  options: { today: string; openingBalanceCents?: number; savingsGoalCents?: number },
): MonthSummary {
  const opening = options.openingBalanceCents ?? 0;
  const goal = options.savingsGoalCents ?? 0;

  let incomeTotal = 0;
  let incomeReceived = 0;
  let expenseTotal = 0;
  let expensePaid = 0;
  let expenseUpcoming = 0;
  let expenseOverdue = 0;

  for (const occ of occurrences) {
    if (occ.kind === "income") {
      incomeTotal += occ.amountCents;
      if (occ.paid) incomeReceived += occ.amountCents;
    } else {
      expenseTotal += occ.amountCents;
      if (occ.paid) expensePaid += occ.amountCents;
      else if (occ.date < options.today) expenseOverdue += occ.amountCents;
      else expenseUpcoming += occ.amountCents;
    }
  }

  const incomePending = incomeTotal - incomeReceived;
  const balanceNow = opening + incomeReceived - expensePaid;
  const projectedEnd = balanceNow + incomePending - expenseUpcoming - expenseOverdue;
  const free = projectedEnd - goal;

  let state: BudgetState = "ok";
  if (projectedEnd < 0) state = "over";
  else if (projectedEnd < goal || expenseOverdue > 0) state = "attention";

  return {
    incomeTotalCents: incomeTotal,
    incomeReceivedCents: incomeReceived,
    incomePendingCents: incomePending,
    expenseTotalCents: expenseTotal,
    expensePaidCents: expensePaid,
    expenseUpcomingCents: expenseUpcoming,
    expenseOverdueCents: expenseOverdue,
    balanceNowCents: balanceNow,
    availableCents: incomeTotal - expenseTotal,
    projectedEndCents: projectedEnd,
    savingsGoalCents: goal,
    freeToSpendCents: free,
    state,
  };
}

export interface CanSpend {
  freeCents: number;
  daysLeft: number;
  perDayCents: number;
}

/** "Quanto posso gastar?": saldo livre e média diária até o fim do mês. */
export function computeCanSpend(summary: MonthSummary, month: string, today: string): CanSpend {
  const { from, to } = monthRange(month);
  let daysLeft: number;
  if (today < from) daysLeft = diffDays(from, to) + 1;
  else if (today > to) daysLeft = 0;
  else daysLeft = diffDays(today, to) + 1;

  const free = Math.max(summary.freeToSpendCents, 0);
  return {
    freeCents: summary.freeToSpendCents,
    daysLeft,
    perDayCents: daysLeft > 0 ? Math.floor(free / daysLeft) : 0,
  };
}

export interface CashFlowPoint {
  date: string;
  balanceCents: number;
}

/**
 * Projeção diária de saldo: parte do saldo atual e aplica, dia a dia, as
 * ocorrências ainda não pagas/recebidas. Vencidas e não pagas caem em "hoje".
 */
export function projectCashFlow(input: {
  startingBalanceCents: number;
  occurrences: Occurrence[];
  today: string;
  days: number;
}): CashFlowPoint[] {
  const { startingBalanceCents, occurrences, today, days } = input;
  const deltaByDay = new Map<string, number>();
  const lastDay = addDays(today, Math.max(days, 1) - 1);

  for (const occ of occurrences) {
    if (occ.paid) continue;
    const day = occ.date < today ? today : occ.date;
    if (day > lastDay) continue;
    const signed = occ.kind === "income" ? occ.amountCents : -occ.amountCents;
    deltaByDay.set(day, (deltaByDay.get(day) ?? 0) + signed);
  }

  const points: CashFlowPoint[] = [];
  let balance = startingBalanceCents;
  for (let i = 0; i < Math.max(days, 1); i += 1) {
    const date = addDays(today, i);
    balance += deltaByDay.get(date) ?? 0;
    points.push({ date, balanceCents: balance });
  }
  return points;
}

export interface UpcomingBuckets {
  overdue: Occurrence[];
  today: Occurrence[];
  tomorrow: Occurrence[];
  next7: Occurrence[];
  rest: Occurrence[];
}

/** Agrupa despesas não pagas em "vencidas / hoje / amanhã / 7 dias / resto do mês". */
export function bucketUpcoming(occurrences: Occurrence[], today: string): UpcomingBuckets {
  const buckets: UpcomingBuckets = { overdue: [], today: [], tomorrow: [], next7: [], rest: [] };
  const tomorrow = addDays(today, 1);
  const in7 = addDays(today, 7);
  for (const occ of occurrences) {
    if (occ.kind !== "expense" || occ.paid) continue;
    if (occ.date < today) buckets.overdue.push(occ);
    else if (occ.date === today) buckets.today.push(occ);
    else if (occ.date === tomorrow) buckets.tomorrow.push(occ);
    else if (occ.date <= in7) buckets.next7.push(occ);
    else buckets.rest.push(occ);
  }
  return buckets;
}

export interface CategoryTotal {
  category: string;
  totalCents: number;
  /** Percentual da renda do mês (0 se não há renda). */
  percentOfIncome: number;
}

export function expensesByCategory(occurrences: Occurrence[], incomeTotalCents: number): CategoryTotal[] {
  const totals = new Map<string, number>();
  for (const occ of occurrences) {
    if (occ.kind !== "expense") continue;
    totals.set(occ.category, (totals.get(occ.category) ?? 0) + occ.amountCents);
  }
  return [...totals.entries()]
    .map(([category, totalCents]) => ({
      category,
      totalCents,
      percentOfIncome: incomeTotalCents > 0 ? Math.round((totalCents / incomeTotalCents) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.totalCents - a.totalCents);
}

