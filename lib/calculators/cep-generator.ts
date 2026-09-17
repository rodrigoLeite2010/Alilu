/**
 * Geração de CEPs SINTÉTICOS para testes de formulários e validações
 * (categoria Geradores). Mantido isolado da interface (PROMPT MESTRE,
 * seção 14).
 *
 * IMPORTANTE: este arquivo NUNCA consulta os Correios nem qualquer base de
 * endereços real — gera apenas 8 dígitos aleatórios no formato de CEP. Não
 * há dígito verificador em um CEP (é só uma numeração administrativa dos
 * Correios), então nenhum "algoritmo de validade" é aplicado aqui — só o
 * formato.
 *
 * Sorteado com `crypto.getRandomValues` (ver lib/random/secure-random.ts),
 * nunca com `Math.random`.
 */

import { secureRandomDigit } from "@/lib/random/secure-random";

export const CEP_GENERATOR_MAX_BATCH = 100;

export interface CepGeneratorInput {
  count: number;
  /** true => "00000-000"; false => "00000000" */
  formatted: boolean;
}

export interface CepGeneratorFieldErrors {
  count?: string;
}

/** Aplica a máscara 00000-000 a uma string de 8 dígitos. */
export function formatGeneratedCep(digits: string): string {
  return `${digits.slice(0, 5)}-${digits.slice(5, 8)}`;
}

/** Gera um único CEP sintético (8 dígitos aleatórios, sem consulta real). */
export function generateCep(formatted = true): string {
  const digits = Array.from({ length: 8 }, () => secureRandomDigit()).join("");
  return formatted ? formatGeneratedCep(digits) : digits;
}

export function validateCepGeneratorInput(input: CepGeneratorInput): CepGeneratorFieldErrors {
  const errors: CepGeneratorFieldErrors = {};

  if (!Number.isFinite(input.count) || !Number.isInteger(input.count) || input.count < 1) {
    errors.count = "Informe uma quantidade inteira de pelo menos 1.";
  } else if (input.count > CEP_GENERATOR_MAX_BATCH) {
    errors.count = `A quantidade não pode ser maior que ${CEP_GENERATOR_MAX_BATCH}.`;
  }

  return errors;
}

export function isCepGeneratorInputValid(input: CepGeneratorInput): boolean {
  return Object.keys(validateCepGeneratorInput(input)).length === 0;
}

/**
 * Gera um lote de CEPs sintéticos. O limite (CEP_GENERATOR_MAX_BATCH) é
 * aplicado ANTES de qualquer geração, então nunca é criado um array maior
 * que o limite, mesmo que a validação seja pulada por algum chamador.
 */
export function generateCepBatch(input: CepGeneratorInput): string[] {
  const safeCount = Math.min(Math.max(1, Math.trunc(input.count) || 1), CEP_GENERATOR_MAX_BATCH);

  return Array.from({ length: safeCount }, () => generateCep(input.formatted));
}
