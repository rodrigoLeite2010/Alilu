import type { ReadabilityIndexes } from "./readability-calculator";

/**
 * Nota Alilu (0–100, maior = mais fácil). NÃO é média cega: cada índice é
 * primeiro convertido para a mesma escala 0–100 ("facilidade"):
 *
 *  - Flesch (já é 0–100 de facilidade): limitado a 0–100.             peso 40%
 *  - Gulpease (≈ 20 muito difícil … 80+ muito fácil): (g − 20) / 60.   peso 30%
 *  - Índices de série (Flesch-Kincaid, ARI, Coleman-Liau — anos de
 *    estudo): média → 4º ano = 100 … 16º ano = 0, linear.             peso 30%
 *
 * O Gunning Fog fica de fora da nota (já usa as palavras complexas, que
 * são mostradas à parte) para não contar a mesma coisa duas vezes.
 */

export type ReadabilityLevel = "MUITO_DIFICIL" | "DIFICIL" | "MODERADO" | "FACIL" | "MUITO_FACIL";

export const LEVEL_LABEL: Record<ReadabilityLevel, string> = {
  MUITO_DIFICIL: "Muito difícil",
  DIFICIL: "Difícil",
  MODERADO: "Moderado",
  FACIL: "Fácil",
  MUITO_FACIL: "Muito fácil",
};

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

export function normalizeFlesch(flesch: number): number {
  return clamp(flesch);
}

export function normalizeGulpease(value: number): number {
  return clamp(((value - 20) / 60) * 100);
}

export function normalizeGrade(grade: number): number {
  return clamp(((16 - grade) / 12) * 100);
}

export function aliluScore(indexes: ReadabilityIndexes): number {
  const grade = (indexes.fleschKincaid + indexes.ari + indexes.colemanLiau) / 3;
  const score = 0.4 * normalizeFlesch(indexes.flesch) + 0.3 * normalizeGulpease(indexes.gulpease) + 0.3 * normalizeGrade(grade);
  return Math.round(clamp(score));
}

export function levelForScore(score: number): ReadabilityLevel {
  if (score < 30) return "MUITO_DIFICIL";
  if (score < 50) return "DIFICIL";
  if (score < 70) return "MODERADO";
  if (score < 85) return "FACIL";
  return "MUITO_FACIL";
}

/** Texto simples por índice (para não assustar com números acadêmicos). */
export function interpretFlesch(value: number): string {
  if (value >= 75) return "Leitura muito fácil.";
  if (value >= 50) return "Leitura relativamente fácil.";
  if (value >= 25) return "Leitura difícil.";
  return "Leitura muito difícil.";
}

export function interpretGulpease(value: number): string {
  if (value >= 80) return "Muito fácil, até para quem lê pouco.";
  if (value >= 60) return "Fácil para a maioria dos leitores.";
  if (value >= 40) return "Exige atenção de quem lê pouco.";
  return "Difícil para a maioria dos leitores.";
}

export function interpretGrade(years: number): string {
  if (years <= 6) return "Entendido com até ~6 anos de estudo.";
  if (years <= 9) return "Nível de ensino fundamental (~7 a 9 anos de estudo).";
  if (years <= 12) return "Nível de ensino médio (~10 a 12 anos de estudo).";
  return "Nível de ensino superior (mais de 12 anos de estudo).";
}
