import type { FinEntry } from "./types";

/**
 * "Assinaturas mensais": nenhuma tabela nova. Uma assinatura é, por
 * definição, uma despesa recorrente já cadastrada na categoria
 * "Assinaturas" (ver lib/financas/categories.ts) — este módulo só lê os
 * lançamentos existentes e calcula quanto custam por mês e por ano.
 *
 * Um lançamento "único" (recurrence "none") na categoria "Assinaturas" não
 * conta como assinatura ativa aqui: é uma compra avulsa, não um custo
 * recorrente — continua aparecendo normalmente em "Despesas".
 */

export const SUBSCRIPTION_CATEGORY = "Assinaturas";

export function isActiveSubscription(
  entry: Pick<FinEntry, "kind" | "category" | "recurrence" | "recurrenceEnd">,
  today: string,
): boolean {
  if (entry.kind !== "expense" || entry.category !== SUBSCRIPTION_CATEGORY) return false;
  if (entry.recurrence === "none") return false;
  if (entry.recurrenceEnd && entry.recurrenceEnd < today) return false;
  return true;
}

/**
 * Custo mensal equivalente, dado o valor e a periodicidade do lançamento.
 * Semanal/quinzenal são anualizados (52 ou 26 ocorrências) e divididos por
 * 12; anual é dividido por 12; mensal é o próprio valor.
 */
export function monthlyEquivalentCents(entry: Pick<FinEntry, "amountCents" | "recurrence">): number {
  switch (entry.recurrence) {
    case "weekly":
      return Math.round((entry.amountCents * 52) / 12);
    case "biweekly":
      return Math.round((entry.amountCents * 26) / 12);
    case "yearly":
      return Math.round(entry.amountCents / 12);
    case "monthly":
    case "none":
      return entry.amountCents;
  }
}

export interface SubscriptionRow {
  entry: FinEntry;
  monthlyCents: number;
  yearlyCents: number;
}

export interface SubscriptionsSummary {
  subscriptions: SubscriptionRow[];
  monthlyTotalCents: number;
  yearlyTotalCents: number;
}

/** Assinaturas ativas (mais caras primeiro) + total por mês e por ano. */
export function summarizeSubscriptions(entries: FinEntry[], today: string): SubscriptionsSummary {
  const subscriptions = entries
    .filter((entry) => isActiveSubscription(entry, today))
    .map((entry) => {
      const monthlyCents = monthlyEquivalentCents(entry);
      return { entry, monthlyCents, yearlyCents: monthlyCents * 12 };
    })
    .sort((a, b) => b.monthlyCents - a.monthlyCents);

  const monthlyTotalCents = subscriptions.reduce((sum, row) => sum + row.monthlyCents, 0);
  return { subscriptions, monthlyTotalCents, yearlyTotalCents: monthlyTotalCents * 12 };
}
