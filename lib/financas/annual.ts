import type { Occurrence } from "./types";

/**
 * "Planejamento anual": receitas, despesas e saldo mês a mês ao longo de um
 * ano. Reaproveita o mesmo `Occurrence[]` já expandido pelo motor de
 * recorrência (lib/financas/recurrence.ts) para o intervalo do ano inteiro
 * — só agrupa por mês. Saldo do mês aqui é sempre "renda do mês menos
 * despesas do mês" (igual a `availableCents` de summarizeMonth), não
 * depende de saldo inicial nem de o que já foi pago/recebido, para valer
 * igualmente para meses passados e futuros do ano.
 */

export interface MonthlyFlow {
  /** "YYYY-MM" */
  month: string;
  incomeCents: number;
  expenseCents: number;
  /** incomeCents − expenseCents. */
  balanceCents: number;
}

export interface AnnualPlan {
  /** "YYYY" */
  year: string;
  /** 12 meses, janeiro a dezembro. */
  months: MonthlyFlow[];
  incomeTotalCents: number;
  expenseTotalCents: number;
  balanceTotalCents: number;
}

export function summarizeAnnualPlan(occurrences: Occurrence[], year: string): AnnualPlan {
  const months: MonthlyFlow[] = Array.from({ length: 12 }, (_, i) => ({
    month: `${year}-${String(i + 1).padStart(2, "0")}`,
    incomeCents: 0,
    expenseCents: 0,
    balanceCents: 0,
  }));
  const byMonth = new Map(months.map((flow) => [flow.month, flow]));

  for (const occ of occurrences) {
    const bucket = byMonth.get(occ.date.slice(0, 7));
    if (!bucket) continue;
    if (occ.kind === "income") bucket.incomeCents += occ.amountCents;
    else bucket.expenseCents += occ.amountCents;
  }
  for (const flow of months) flow.balanceCents = flow.incomeCents - flow.expenseCents;

  const incomeTotalCents = months.reduce((sum, flow) => sum + flow.incomeCents, 0);
  const expenseTotalCents = months.reduce((sum, flow) => sum + flow.expenseCents, 0);
  return { year, months, incomeTotalCents, expenseTotalCents, balanceTotalCents: incomeTotalCents - expenseTotalCents };
}
