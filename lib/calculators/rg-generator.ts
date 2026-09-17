/**
 * Geração de números de RG SINTÉTICOS para testes de formulários e
 * validações (categoria Geradores). Mantido isolado da interface (PROMPT
 * MESTRE, seção 14).
 *
 * LIMITAÇÃO CONHECIDA E IMPORTANTE: o RG não tem um padrão nacional único
 * — cada Secretaria de Segurança Pública estadual emite e numera à sua
 * própria maneira, sem um algoritmo de dígito verificador unificado (ao
 * contrário de CPF, CNPJ, PIS/PASEP, CNH ou Título de Eleitor, que são
 * cadastros e algoritmos federais). Este gerador usa como referência
 * ilustrativa o padrão de cálculo mais comumente reproduzido por
 * validadores públicos de terceiros — o mesmo formato usado pela SSP-SP —
 * apenas como ESTRUTURA plausível (8 dígitos-base + 1 dígito verificador
 * por módulo 11, que pode resultar em "X"). Não representa o padrão oficial
 * de nenhum estado específico nem de todos.
 *
 * IMPORTANTE: este arquivo NUNCA consulta nenhuma Secretaria de Segurança
 * Pública nem qualquer cadastro de pessoas — os números gerados são
 * apenas combinações no formato ilustrativo descrito acima.
 *
 * Os 8 dígitos-base são sorteados com `crypto.getRandomValues` (ver
 * lib/random/secure-random.ts), nunca com `Math.random`.
 */

import { secureRandomDigit } from "@/lib/random/secure-random";

export const RG_GENERATOR_MAX_BATCH = 100;

export interface RgGeneratorInput {
  count: number;
  /** true => "00.000.000-D"; false => "00000000D" */
  formatted: boolean;
}

export interface RgGeneratorFieldErrors {
  count?: string;
}

const CHECK_DIGIT_WEIGHTS = [2, 3, 4, 5, 6, 7, 8, 9];

/**
 * Calcula o dígito verificador (0-9 ou "X") a partir dos 8 dígitos-base,
 * pelo padrão ilustrativo descrito no cabeçalho deste arquivo.
 */
export function calculateRgCheckDigit(base8: number[]): string {
  if (base8.length !== 8 || base8.some((d) => !Number.isInteger(d) || d < 0 || d > 9)) {
    throw new Error("base8 deve conter exatamente 8 dígitos (0-9).");
  }

  let sum = 0;
  for (let i = 0; i < 8; i += 1) {
    sum += base8[i] * CHECK_DIGIT_WEIGHTS[i];
  }
  const rest = sum % 11;
  const dv = 11 - rest;
  if (dv === 11) return "0";
  if (dv === 10) return "X";
  return String(dv);
}

/** Aplica a máscara 00.000.000-D a 8 dígitos-base + 1 dígito verificador. */
export function formatGeneratedRg(base8Digits: string, checkDigit: string): string {
  return `${base8Digits.slice(0, 2)}.${base8Digits.slice(2, 5)}.${base8Digits.slice(5, 8)}-${checkDigit}`;
}

/** Gera um único RG sintético, no formato ilustrativo descrito no cabeçalho. */
export function generateRg(formatted = true): string {
  const base8 = Array.from({ length: 8 }, () => secureRandomDigit());
  const checkDigit = calculateRgCheckDigit(base8);
  const base8Digits = base8.join("");

  return formatted ? formatGeneratedRg(base8Digits, checkDigit) : `${base8Digits}${checkDigit}`;
}

export function validateRgGeneratorInput(input: RgGeneratorInput): RgGeneratorFieldErrors {
  const errors: RgGeneratorFieldErrors = {};

  if (!Number.isFinite(input.count) || !Number.isInteger(input.count) || input.count < 1) {
    errors.count = "Informe uma quantidade inteira de pelo menos 1.";
  } else if (input.count > RG_GENERATOR_MAX_BATCH) {
    errors.count = `A quantidade não pode ser maior que ${RG_GENERATOR_MAX_BATCH}.`;
  }

  return errors;
}

export function isRgGeneratorInputValid(input: RgGeneratorInput): boolean {
  return Object.keys(validateRgGeneratorInput(input)).length === 0;
}

/**
 * Gera um lote de RG sintéticos. O limite (RG_GENERATOR_MAX_BATCH) é
 * aplicado ANTES de qualquer geração, então nunca é criado um array maior
 * que o limite, mesmo que a validação seja pulada por algum chamador.
 */
export function generateRgBatch(input: RgGeneratorInput): string[] {
  const safeCount = Math.min(Math.max(1, Math.trunc(input.count) || 1), RG_GENERATOR_MAX_BATCH);

  return Array.from({ length: safeCount }, () => generateRg(input.formatted));
}
