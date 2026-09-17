/**
 * Geração de números de RENAVAM SINTÉTICOS para testes de formulários e
 * validações (categoria Geradores). Mantido isolado da interface (PROMPT
 * MESTRE, seção 14).
 *
 * IMPORTANTE: este arquivo NUNCA consulta o DETRAN, a Base Índice Nacional
 * de Veículos (BIN) nem qualquer cadastro de veículos — os números gerados
 * apenas passam na conta matemática do dígito verificador documentado
 * publicamente, o que não indica que exista um veículo real com esse
 * RENAVAM.
 *
 * O RENAVAM tem 11 dígitos: 10 dígitos-base + 1 dígito verificador. O
 * algoritmo (documentado publicamente e usado por validadores de RENAVAM de
 * terceiros) é:
 *   1. Inverte a ordem dos 10 dígitos-base.
 *   2. Multiplica cada dígito invertido pelos pesos [2,3,4,5,6,7,8,9,2,3],
 *      posição a posição.
 *   3. Soma os produtos, multiplica a soma por 10 e tira o resto da divisão
 *      por 11.
 *   4. DV = resto, exceto quando o resto é 10 -> DV = 0.
 *
 * Os 10 dígitos-base são sorteados com `crypto.getRandomValues` (ver
 * lib/random/secure-random.ts), nunca com `Math.random`.
 */

import { secureRandomDigit } from "@/lib/random/secure-random";

/** Quantidade máxima de RENAVAM que podem ser gerados em um único lote. */
export const RENAVAM_GENERATOR_MAX_BATCH = 100;

export interface RenavamGeneratorInput {
  count: number;
  /** true => "0000000000-0"; false => "00000000000" */
  formatted: boolean;
}

export interface RenavamGeneratorFieldErrors {
  count?: string;
}

const CHECK_DIGIT_WEIGHTS = [2, 3, 4, 5, 6, 7, 8, 9, 2, 3];

/**
 * Calcula o dígito verificador de um RENAVAM a partir dos 10 dígitos-base
 * (algoritmo descrito no cabeçalho deste arquivo).
 */
export function calculateRenavamCheckDigit(base10: number[]): number {
  if (base10.length !== 10 || base10.some((d) => !Number.isInteger(d) || d < 0 || d > 9)) {
    throw new Error("base10 deve conter exatamente 10 dígitos (0-9).");
  }

  const reversed = [...base10].reverse();
  let sum = 0;
  for (let i = 0; i < 10; i += 1) {
    sum += reversed[i] * CHECK_DIGIT_WEIGHTS[i];
  }
  const rest = (sum * 10) % 11;
  return rest === 10 ? 0 : rest;
}

/** Valida um RENAVAM completo (11 dígitos) pelo mesmo algoritmo. */
export function isValidRenavam(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 11) return false;

  const nums = digits.split("").map(Number);
  return calculateRenavamCheckDigit(nums.slice(0, 10)) === nums[10];
}

/** Aplica a máscara 0000000000-0 a uma string de 11 dígitos. */
export function formatGeneratedRenavam(digits: string): string {
  return `${digits.slice(0, 10)}-${digits.slice(10, 11)}`;
}

/** Gera um único RENAVAM sintético, com dígito verificador correto. */
export function generateRenavam(formatted = true): string {
  const base10 = Array.from({ length: 10 }, () => secureRandomDigit());
  const dv = calculateRenavamCheckDigit(base10);
  const digits = [...base10, dv].join("");

  return formatted ? formatGeneratedRenavam(digits) : digits;
}

export function validateRenavamGeneratorInput(
  input: RenavamGeneratorInput
): RenavamGeneratorFieldErrors {
  const errors: RenavamGeneratorFieldErrors = {};

  if (!Number.isFinite(input.count) || !Number.isInteger(input.count) || input.count < 1) {
    errors.count = "Informe uma quantidade inteira de pelo menos 1.";
  } else if (input.count > RENAVAM_GENERATOR_MAX_BATCH) {
    errors.count = `A quantidade não pode ser maior que ${RENAVAM_GENERATOR_MAX_BATCH}.`;
  }

  return errors;
}

export function isRenavamGeneratorInputValid(input: RenavamGeneratorInput): boolean {
  return Object.keys(validateRenavamGeneratorInput(input)).length === 0;
}

/**
 * Gera um lote de RENAVAM sintéticos. O limite (RENAVAM_GENERATOR_MAX_BATCH)
 * é aplicado ANTES de qualquer geração, então nunca é criado um array maior
 * que o limite, mesmo que a validação seja pulada por algum chamador.
 */
export function generateRenavamBatch(input: RenavamGeneratorInput): string[] {
  const safeCount = Math.min(
    Math.max(1, Math.trunc(input.count) || 1),
    RENAVAM_GENERATOR_MAX_BATCH
  );

  return Array.from({ length: safeCount }, () => generateRenavam(input.formatted));
}
