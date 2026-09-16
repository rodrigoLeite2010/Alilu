/**
 * Formatação de valores monetários e numéricos no padrão brasileiro (pt-BR).
 *
 * Mantido isolado da interface (ver PROMPT MESTRE, seção 14) para poder ser
 * testado e reutilizado por qualquer calculadora futura.
 */

const BRL_CURRENCY_FORMATTER = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/**
 * Formata um número como moeda brasileira (R$ 1.234,56).
 * Valores não finitos (NaN, Infinity) são tratados como R$ 0,00.
 */
export function formatCurrencyBRL(value: number): string {
  if (!Number.isFinite(value)) {
    return BRL_CURRENCY_FORMATTER.format(0);
  }
  return BRL_CURRENCY_FORMATTER.format(value);
}

/**
 * Formata um número no padrão brasileiro (1.234,56), com o número de casas
 * decimais especificado (padrão: 2).
 */
export function formatNumberBRL(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) {
    value = 0;
  }
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Formata uma fração decimal (0.1 = 10%) ou um valor já em percentual como
 * string percentual brasileira, ex.: formatPercentage(12.5) => "12,5%".
 */
export function formatPercentage(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) {
    value = 0;
  }
  return `${formatNumberBRL(value, decimals)}%`;
}

/**
 * Converte uma sequência de dígitos digitados pelo usuário (interpretados
 * como centavos, como em um campo de valor monetário mascarado enquanto se
 * digita) para um número em reais.
 *
 * Ex.: "85000" -> 850 (R$ 850,00); "50" -> 0.5 (R$ 0,50); "" -> 0.
 *
 * Usado pelo campo de valor do Gerador de Recibo (e reutilizável por
 * qualquer calculadora futura que precise do mesmo tipo de campo).
 */
export function centsDigitsToAmount(digitsOnly: string): number {
  const digits = digitsOnly.replace(/\D/g, "");
  if (digits === "") {
    return 0;
  }
  return Number(digits) / 100;
}
