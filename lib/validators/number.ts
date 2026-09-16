/**
 * Validação e parsing de números em formulários, no padrão brasileiro.
 * Mantido isolado da interface para ser testável (ver PROMPT MESTRE, seção 14).
 */

/**
 * Converte uma string numérica no formato brasileiro (ex.: "1.234,56") para
 * number. Aceita também números já formatados em padrão internacional
 * ("1234.56") e campos vazios (retorna null).
 */
export function parseLocaleNumberBRL(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === "") {
    return null;
  }

  // Remove separador de milhar (ponto) e troca a vírgula decimal por ponto.
  const normalized = trimmed
    .replace(/\./g, (match, offset, full) => {
      // Se houver vírgula depois, o ponto é separador de milhar.
      return full.includes(",") ? "" : match;
    })
    .replace(",", ".");

  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/** Retorna true quando o valor é um número finito maior que zero. */
export function isPositiveNumber(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

/** Retorna true quando o valor é um número finito maior ou igual a zero. */
export function isNonNegativeNumber(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

/** Retorna true para strings não vazias após remover espaços nas pontas. */
export function isNonEmptyString(value: string): boolean {
  return value.trim().length > 0;
}

/** Limita um número a um intervalo [min, max]. */
export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
