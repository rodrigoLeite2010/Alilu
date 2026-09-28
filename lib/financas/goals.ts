import { addMonthsToMonth, monthOf } from "./dates";

export interface Goal {
  id: string;
  name: string;
  targetCents: number;
  currentCents: number;
  targetDate: string | null;
}

export interface GoalProgress {
  percentComplete: number;
  missingCents: number;
  /** null quando a meta não tem data (não dá para calcular por mês). */
  monthsRemaining: number | null;
  monthlyNeededCents: number | null;
  reached: boolean;
}

/** Meses de hoje até targetDate (mínimo 1, se a data já é este mês ou passou). */
function monthsUntil(today: string, targetDate: string): number {
  const todayMonth = monthOf(today);
  const targetMonth = monthOf(targetDate);
  let months = 0;
  let cursor = todayMonth;
  while (cursor < targetMonth) {
    cursor = addMonthsToMonth(cursor, 1);
    months += 1;
  }
  return Math.max(months, 1);
}

export function goalProgress(goal: Goal, today: string): GoalProgress {
  const missing = Math.max(goal.targetCents - goal.currentCents, 0);
  const percent = goal.targetCents > 0 ? Math.min(Math.round((goal.currentCents / goal.targetCents) * 1000) / 10, 999) : 0;
  const monthsRemaining = goal.targetDate ? monthsUntil(today, goal.targetDate) : null;
  return {
    percentComplete: percent,
    missingCents: missing,
    monthsRemaining,
    monthlyNeededCents: monthsRemaining !== null ? Math.ceil(missing / monthsRemaining) : null,
    reached: goal.currentCents >= goal.targetCents,
  };
}

export type ReserveMonths = 3 | 6 | 9 | 12;

/** Reserva de emergência sugerida: despesas essenciais mensais × meses desejados. */
export function suggestedReserveCents(essentialMonthlyExpensesCents: number, months: ReserveMonths): number {
  return Math.max(essentialMonthlyExpensesCents, 0) * months;
}
