/**
 * Geração de números de CNH SINTÉTICOS para testes de formulários e
 * validações (categoria Geradores). Mantido isolado da interface (PROMPT
 * MESTRE, seção 14).
 *
 * IMPORTANTE: este arquivo NUNCA consulta o DENATRAN, o RENACH nem qualquer
 * cadastro de condutores — os números gerados apenas passam na conta
 * matemática dos dois dígitos verificadores documentados publicamente, o
 * que não indica que exista uma CNH real com esse número.
 *
 * A CNH tem 11 dígitos: 9 dígitos-base + 2 dígitos verificadores (DV1,
 * DV2), calculados pelo algoritmo do DENATRAN (reproduzido por
 * validadores de terceiros de forma consistente):
 *   1. DV1 = soma dos 9 dígitos-base × pesos [9,8,7,6,5,4,3,2,1], resto da
 *      divisão por 11. Se o resto for >= 10, DV1 = 0 e usa-se um desconto
 *      de 2 no cálculo do DV2 (ver abaixo).
 *   2. DV2 = soma dos 9 dígitos-base × pesos [1,2,3,4,5,6,7,8,9], resto da
 *      divisão por 11, subtraído do desconto (2 quando o DV1 "estourou"
 *      acima de 9, 0 caso contrário). Se o resultado for negativo, soma-se
 *      11; se for >= 10, DV2 = 0.
 *
 * Os 9 dígitos-base são sorteados com `crypto.getRandomValues` (ver
 * lib/random/secure-random.ts), nunca com `Math.random`.
 */

import { secureRandomDigit } from "@/lib/random/secure-random";

/** Quantidade máxima de CNH que podem ser geradas em um único lote. */
export const CNH_GENERATOR_MAX_BATCH = 100;

export interface CnhGeneratorInput {
  count: number;
  /** true => "000000000-00"; false => "00000000000" */
  formatted: boolean;
}

export interface CnhGeneratorFieldErrors {
  count?: string;
}

/** Calcula os dois dígitos verificadores de uma CNH a partir dos 9 dígitos-base. */
export function calculateCnhCheckDigits(base9: number[]): [number, number] {
  if (base9.length !== 9 || base9.some((d) => !Number.isInteger(d) || d < 0 || d > 9)) {
    throw new Error("base9 deve conter exatamente 9 dígitos (0-9).");
  }

  let sum1 = 0;
  for (let i = 0; i < 9; i += 1) {
    sum1 += base9[i] * (9 - i);
  }
  const rest1 = sum1 % 11;
  let discount = 0;
  let dv1 = rest1;
  if (dv1 >= 10) {
    dv1 = 0;
    discount = 2;
  }

  let sum2 = 0;
  for (let i = 0; i < 9; i += 1) {
    sum2 += base9[i] * (i + 1);
  }
  let dv2 = (sum2 % 11) - discount;
  if (dv2 < 0) dv2 += 11;
  if (dv2 >= 10) dv2 = 0;

  return [dv1, dv2];
}

/** Valida uma CNH completa (11 dígitos) pelo mesmo algoritmo. */
export function isValidCnh(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 11) return false;

  const nums = digits.split("").map(Number);
  const [dv1, dv2] = calculateCnhCheckDigits(nums.slice(0, 9));
  return dv1 === nums[9] && dv2 === nums[10];
}

/** Aplica a máscara 000000000-00 a uma string de 11 dígitos. */
export function formatGeneratedCnh(digits: string): string {
  return `${digits.slice(0, 9)}-${digits.slice(9, 11)}`;
}

/** Gera uma única CNH sintética, com dígitos verificadores corretos. */
export function generateCnh(formatted = true): string {
  const base9 = Array.from({ length: 9 }, () => secureRandomDigit());
  const [dv1, dv2] = calculateCnhCheckDigits(base9);
  const digits = [...base9, dv1, dv2].join("");

  return formatted ? formatGeneratedCnh(digits) : digits;
}

export function validateCnhGeneratorInput(input: CnhGeneratorInput): CnhGeneratorFieldErrors {
  const errors: CnhGeneratorFieldErrors = {};

  if (!Number.isFinite(input.count) || !Number.isInteger(input.count) || input.count < 1) {
    errors.count = "Informe uma quantidade inteira de pelo menos 1.";
  } else if (input.count > CNH_GENERATOR_MAX_BATCH) {
    errors.count = `A quantidade não pode ser maior que ${CNH_GENERATOR_MAX_BATCH}.`;
  }

  return errors;
}

export function isCnhGeneratorInputValid(input: CnhGeneratorInput): boolean {
  return Object.keys(validateCnhGeneratorInput(input)).length === 0;
}

/**
 * Gera um lote de CNH sintéticas. O limite (CNH_GENERATOR_MAX_BATCH) é
 * aplicado ANTES de qualquer geração, então nunca é criado um array maior
 * que o limite, mesmo que a validação seja pulada por algum chamador.
 */
export function generateCnhBatch(input: CnhGeneratorInput): string[] {
  const safeCount = Math.min(Math.max(1, Math.trunc(input.count) || 1), CNH_GENERATOR_MAX_BATCH);

  return Array.from({ length: safeCount }, () => generateCnh(input.formatted));
}
