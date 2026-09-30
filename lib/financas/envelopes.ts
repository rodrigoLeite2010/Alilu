import type { BudgetState } from "./types";

/**
 * "Método dos envelopes": um limite de gasto por categoria de despesa,
 * comparado contra o gasto real do mês (lib/financas/summary.ts,
 * `expensesByCategory`) — sem persistir "quanto já gastei", só o teto.
 */

export interface CategoryLimit {
  category: string;
  limitCents: number;
}

export interface CategoryLimitProgress {
  category: string;
  limitCents: number;
  spentCents: number;
  /** Percentual gasto do limite (0-999,9 — pode passar de 100). */
  percentUsed: number;
  /** limitCents − spentCents; negativo quando estourou. */
  remainingCents: number;
  state: BudgetState;
}

const ATTENTION_THRESHOLD = 0.8;

export function categoryLimitProgress(limit: CategoryLimit, spentCents: number): CategoryLimitProgress {
  const percentUsed = limit.limitCents > 0 ? Math.round((spentCents / limit.limitCents) * 1000) / 10 : 0;
  const remainingCents = limit.limitCents - spentCents;
  let state: BudgetState = "ok";
  if (spentCents > limit.limitCents) state = "over";
  else if (spentCents >= limit.limitCents * ATTENTION_THRESHOLD) state = "attention";

  return { category: limit.category, limitCents: limit.limitCents, spentCents, percentUsed, remainingCents, state };
}
