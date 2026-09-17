/**
 * Geração de números de PIS/PASEP (NIT/NIS) SINTÉTICOS para testes de
 * formulários e validações (categoria Geradores). Mantido isolado da
 * interface (PROMPT MESTRE, seção 14).
 *
 * IMPORTANTE: este arquivo NUNCA consulta a Caixa Econômica Federal, o
 * eSocial ou qualquer base de dados de trabalhadores — os números gerados
 * apenas passam na conta matemática do dígito verificador oficial, o que
 * não indica que existam ou tenham sido emitidos para alguém.
 *
 * O PIS/PASEP tem 11 dígitos: 10 dígitos-base + 1 dígito verificador,
 * calculado pelo mesmo algoritmo de módulo 11 usado para validar o NIT no
 * eSocial/CAGED — pesos [3,2,9,8,7,6,5,4,3,2] aplicados aos 10 dígitos-base
 * (posição a posição), soma, resto da divisão por 11, e:
 *   DV = 11 - resto, exceto quando esse resultado é 10 ou 11 -> DV = 0.
 *
 * Os 10 primeiros dígitos são sorteados com `crypto.getRandomValues` (ver
 * lib/random/secure-random.ts), nunca com `Math.random`.
 */

import { secureRandomDigit } from "@/lib/random/secure-random";

/** Quantidade máxima de PIS/PASEP que podem ser gerados em um único lote. */
export const PIS_GENERATOR_MAX_BATCH = 100;

export interface PisGeneratorInput {
  count: number;
  /** true => "000.00000.00-0"; false => "00000000000" */
  formatted: boolean;
}

export interface PisGeneratorFieldErrors {
  count?: string;
}

const CHECK_DIGIT_WEIGHTS = [3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

/**
 * Calcula o dígito verificador de um PIS/PASEP a partir dos 10 dígitos-base
 * (algoritmo oficial de módulo 11 — ver cabeçalho deste arquivo).
 */
export function calculatePisCheckDigit(base10: number[]): number {
  if (base10.length !== 10 || base10.some((d) => !Number.isInteger(d) || d < 0 || d > 9)) {
    throw new Error("base10 deve conter exatamente 10 dígitos (0-9).");
  }

  let sum = 0;
  for (let i = 0; i < 10; i += 1) {
    sum += base10[i] * CHECK_DIGIT_WEIGHTS[i];
  }
  const rest = sum % 11;
  let dv = 11 - rest;
  if (dv >= 10) dv = 0;
  return dv;
}

/**
 * Valida um PIS/PASEP completo (11 dígitos) pelo mesmo algoritmo, usado nos
 * testes automatizados para conferir cada número que este arquivo gera.
 */
export function isValidPisPasep(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 11) return false;

  const nums = digits.split("").map(Number);
  return calculatePisCheckDigit(nums.slice(0, 10)) === nums[10];
}

/** Aplica a máscara 000.00000.00-0 a uma string de 11 dígitos. */
export function formatGeneratedPis(digits: string): string {
  return `${digits.slice(0, 3)}.${digits.slice(3, 8)}.${digits.slice(8, 10)}-${digits.slice(10, 11)}`;
}

/** Gera um único PIS/PASEP sintético, com dígito verificador correto. */
export function generatePisPasep(formatted = true): string {
  const base10 = Array.from({ length: 10 }, () => secureRandomDigit());
  const dv = calculatePisCheckDigit(base10);
  const digits = [...base10, dv].join("");

  return formatted ? formatGeneratedPis(digits) : digits;
}

export function validatePisGeneratorInput(input: PisGeneratorInput): PisGeneratorFieldErrors {
  const errors: PisGeneratorFieldErrors = {};

  if (!Number.isFinite(input.count) || !Number.isInteger(input.count) || input.count < 1) {
    errors.count = "Informe uma quantidade inteira de pelo menos 1.";
  } else if (input.count > PIS_GENERATOR_MAX_BATCH) {
    errors.count = `A quantidade não pode ser maior que ${PIS_GENERATOR_MAX_BATCH}.`;
  }

  return errors;
}

export function isPisGeneratorInputValid(input: PisGeneratorInput): boolean {
  return Object.keys(validatePisGeneratorInput(input)).length === 0;
}

/**
 * Gera um lote de PIS/PASEP sintéticos. O limite (PIS_GENERATOR_MAX_BATCH)
 * é aplicado ANTES de qualquer geração, então nunca é criado um array maior
 * que o limite, mesmo que a validação seja pulada por algum chamador.
 */
export function generatePisBatch(input: PisGeneratorInput): string[] {
  const safeCount = Math.min(Math.max(1, Math.trunc(input.count) || 1), PIS_GENERATOR_MAX_BATCH);

  return Array.from({ length: safeCount }, () => generatePisPasep(input.formatted));
}
