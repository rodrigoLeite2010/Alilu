/**
 * Geração de números inteiros aleatórios dentro de um intervalo (categoria
 * Geradores). Mantido isolado da interface (PROMPT MESTRE, seção 14).
 *
 * Toda a geração acontece localmente, com `crypto.getRandomValues` (ver
 * lib/random/secure-random.ts) — nunca com `Math.random`.
 */

import { secureRandomIntRange, secureRandomSample } from "@/lib/random/secure-random";

export const RANDOM_NUMBER_GENERATOR_MAX_COUNT = 1000;
export const RANDOM_NUMBER_GENERATOR_MAX_RANGE = 1_000_000_000;

export interface RandomNumberGeneratorInput {
  min: number;
  max: number;
  count: number;
  /** false => cada número sorteado só pode aparecer uma vez no resultado. */
  allowRepeat: boolean;
}

export interface RandomNumberGeneratorFieldErrors {
  min?: string;
  max?: string;
  count?: string;
}

export function validateRandomNumberGeneratorInput(
  input: RandomNumberGeneratorInput
): RandomNumberGeneratorFieldErrors {
  const errors: RandomNumberGeneratorFieldErrors = {};

  if (!Number.isFinite(input.min) || !Number.isInteger(input.min)) {
    errors.min = "Informe um número mínimo inteiro.";
  }
  if (!Number.isFinite(input.max) || !Number.isInteger(input.max)) {
    errors.max = "Informe um número máximo inteiro.";
  }
  if (
    Number.isFinite(input.min) &&
    Number.isFinite(input.max) &&
    Number.isInteger(input.min) &&
    Number.isInteger(input.max)
  ) {
    if (input.max < input.min) {
      errors.max = "O máximo deve ser maior ou igual ao mínimo.";
    } else if (input.max - input.min > RANDOM_NUMBER_GENERATOR_MAX_RANGE) {
      errors.max = "O intervalo entre mínimo e máximo é grande demais.";
    }
  }

  if (!Number.isFinite(input.count) || !Number.isInteger(input.count) || input.count < 1) {
    errors.count = "Informe uma quantidade inteira de pelo menos 1.";
  } else if (input.count > RANDOM_NUMBER_GENERATOR_MAX_COUNT) {
    errors.count = `A quantidade não pode ser maior que ${RANDOM_NUMBER_GENERATOR_MAX_COUNT}.`;
  } else if (
    !input.allowRepeat &&
    Number.isFinite(input.min) &&
    Number.isFinite(input.max) &&
    input.max >= input.min &&
    input.count > input.max - input.min + 1
  ) {
    errors.count =
      "Sem repetição, a quantidade não pode ser maior que a quantidade de números no intervalo.";
  }

  return errors;
}

export function isRandomNumberGeneratorInputValid(input: RandomNumberGeneratorInput): boolean {
  return Object.keys(validateRandomNumberGeneratorInput(input)).length === 0;
}

/** Gera os números aleatórios pedidos, respeitando a opção de repetição. */
export function generateRandomNumbers(input: RandomNumberGeneratorInput): number[] {
  const safeCount = Math.max(1, Math.trunc(input.count) || 1);

  if (!input.allowRepeat) {
    const rangeSize = input.max - input.min + 1;
    const pool = Array.from({ length: rangeSize }, (_, i) => input.min + i);
    return secureRandomSample(pool, Math.min(safeCount, rangeSize));
  }

  return Array.from({ length: safeCount }, () => secureRandomIntRange(input.min, input.max));
}
