/**
 * Sorteador de números dentro de um intervalo — foco em sorteios/rifas, com
 * resultado sem repetição por padrão (categoria Geradores). Mantido
 * isolado da interface (PROMPT MESTRE, seção 14).
 *
 * Tecnicamente reaproveita as mesmas primitivas de aleatoriedade segura do
 * Gerador de Números Aleatórios (`lib/random/secure-random.ts`), mas com
 * limites e validações voltados a sorteios (lotes menores, sem repetição
 * como padrão) — por isso tem seu próprio arquivo, assim como cada
 * ferramenta do catálogo.
 */

import { secureRandomIntRange, secureRandomSample } from "@/lib/random/secure-random";

export const NUMBER_DRAW_MAX_COUNT = 100;
export const NUMBER_DRAW_MAX_RANGE = 1_000_000;

export interface NumberDrawInput {
  min: number;
  max: number;
  count: number;
  /** false (padrão) => cada número sorteado só pode aparecer uma vez. */
  allowRepeat: boolean;
}

export interface NumberDrawFieldErrors {
  min?: string;
  max?: string;
  count?: string;
}

export function validateNumberDrawInput(input: NumberDrawInput): NumberDrawFieldErrors {
  const errors: NumberDrawFieldErrors = {};

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
    } else if (input.max - input.min > NUMBER_DRAW_MAX_RANGE) {
      errors.max = "O intervalo entre mínimo e máximo é grande demais.";
    }
  }

  if (!Number.isFinite(input.count) || !Number.isInteger(input.count) || input.count < 1) {
    errors.count = "Informe uma quantidade inteira de pelo menos 1.";
  } else if (input.count > NUMBER_DRAW_MAX_COUNT) {
    errors.count = `A quantidade não pode ser maior que ${NUMBER_DRAW_MAX_COUNT}.`;
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

export function isNumberDrawInputValid(input: NumberDrawInput): boolean {
  return Object.keys(validateNumberDrawInput(input)).length === 0;
}

/** Sorteia os números pedidos, respeitando a opção de repetição. */
export function drawNumbers(input: NumberDrawInput): number[] {
  const safeCount = Math.max(1, Math.trunc(input.count) || 1);

  if (!input.allowRepeat) {
    const rangeSize = input.max - input.min + 1;
    const pool = Array.from({ length: rangeSize }, (_, i) => input.min + i);
    return secureRandomSample(pool, Math.min(safeCount, rangeSize));
  }

  return Array.from({ length: safeCount }, () => secureRandomIntRange(input.min, input.max));
}
