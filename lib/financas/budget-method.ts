import type { Occurrence } from "./types";

export interface Split503020 {
  needsCents: number;
  wantsCents: number;
  savingsCents: number;
}

/** Divide a renda em 50% necessidades, 30% desejos, 20% economia/metas. */
export function split503020(incomeCents: number): Split503020 {
  const income = Math.max(incomeCents, 0);
  const needs = Math.round(income * 0.5);
  const wants = Math.round(income * 0.3);
  return { needsCents: needs, wantsCents: wants, savingsCents: income - needs - wants };
}

export interface ActualSplit {
  /** Despesas classificadas como fixas — aproximação de "necessidades". */
  needsCents: number;
  /** Despesas classificadas como variáveis — aproximação de "desejos". */
  wantsCents: number;
  /** Renda menos despesas totais — o que sobrou (economia real do mês). */
  savingsCents: number;
}

/**
 * Gastos reais do mês, na mesma divisão, para comparar com a recomendação.
 * Usa a classificação fixa/variável de cada despesa como aproximação de
 * "necessidade"/"desejo" — é só uma referência, o próprio usuário decide
 * o que é fixo ou variável ao cadastrar (ver PROMPT MESTRE, FASE 10).
 */
export function actualSplit(occurrences: Occurrence[], incomeCents: number): ActualSplit {
  let needs = 0;
  let wants = 0;
  let total = 0;
  for (const occ of occurrences) {
    if (occ.kind !== "expense") continue;
    total += occ.amountCents;
    if (occ.nature === "fixed") needs += occ.amountCents;
    else wants += occ.amountCents;
  }
  return { needsCents: needs, wantsCents: wants, savingsCents: incomeCents - total };
}
