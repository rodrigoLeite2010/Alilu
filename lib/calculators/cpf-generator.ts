/**
 * Geração de CPFs SINTÉTICOS para testes de desenvolvimento e QA (ETAPA 3 da
 * categoria Geradores, ex-"Devs"). Mantido isolado da interface (PROMPT MESTRE, seção 14).
 *
 * IMPORTANTE: este arquivo NUNCA consulta a Receita Federal nem qualquer
 * base de dados de pessoas — os números gerados são aleatórios, calculados
 * apenas com o mesmo algoritmo público de dígito verificador (módulo 11)
 * usado para VALIDAR um CPF em lib/validators/document.ts. Um CPF
 * matematicamente válido não indica que ele exista ou pertença a alguém.
 *
 * Os 9 primeiros dígitos são sorteados com `crypto.getRandomValues` (fonte
 * criptograficamente segura, disponível nativamente no navegador e no
 * runtime Node/Edge), nunca com `Math.random` — ver lib/random/secure-random.ts.
 */

import { secureRandomDigit } from "@/lib/random/secure-random";

/** Quantidade máxima de CPFs que podem ser gerados em um único lote. */
export const CPF_GENERATOR_MAX_BATCH = 100;

export interface CpfGeneratorInput {
  /** Quantidade de CPFs a gerar em lote (1 a CPF_GENERATOR_MAX_BATCH). */
  count: number;
  /** true => "000.000.000-00"; false => "00000000000" */
  formatted: boolean;
}

export interface CpfGeneratorFieldErrors {
  count?: string;
}

/** Retorna true quando todos os dígitos de um CPF completo são iguais. */
function isAllSameDigit(digits: string): boolean {
  return /^(\d)\1{10}$/.test(digits);
}

/**
 * Calcula os dois dígitos verificadores de um CPF a partir dos 9 primeiros
 * dígitos, pelo algoritmo oficial de módulo 11 (mesmo algoritmo usado para
 * validação em lib/validators/document.ts).
 */
export function calculateCpfCheckDigits(base9: number[]): [number, number] {
  if (base9.length !== 9 || base9.some((d) => !Number.isInteger(d) || d < 0 || d > 9)) {
    throw new Error("base9 deve conter exatamente 9 dígitos (0-9).");
  }

  let sum = 0;
  for (let i = 0; i < 9; i += 1) {
    sum += base9[i] * (10 - i);
  }
  let firstCheck = (sum * 10) % 11;
  if (firstCheck === 10) firstCheck = 0;

  const base10 = [...base9, firstCheck];
  sum = 0;
  for (let i = 0; i < 10; i += 1) {
    sum += base10[i] * (11 - i);
  }
  let secondCheck = (sum * 10) % 11;
  if (secondCheck === 10) secondCheck = 0;

  return [firstCheck, secondCheck];
}

/** Aplica a máscara 000.000.000-00 a uma string de 11 dígitos. */
export function formatGeneratedCpf(digits: string): string {
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

/**
 * Gera um único CPF sintético, com dígitos verificadores matematicamente
 * corretos, rejeitando sequências totalmente repetidas (ex.: 111.111.111-11)
 * e sorteando novamente nesse caso raro (ETAPA 3: "Rejeitar sequências
 * repetidas, como 11111111111").
 */
export function generateCpf(formatted = true): string {
  const MAX_ATTEMPTS = 50;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const base9 = Array.from({ length: 9 }, () => secureRandomDigit());
    const [d1, d2] = calculateCpfCheckDigits(base9);
    const digits = [...base9, d1, d2].join("");

    if (!isAllSameDigit(digits)) {
      return formatted ? formatGeneratedCpf(digits) : digits;
    }
  }

  // Praticamente inatingível (chance ~1 em 10^8 por sorteio): evita loop
  // infinito em vez de travar a interface.
  throw new Error("Não foi possível gerar um CPF válido após várias tentativas.");
}

export function validateCpfGeneratorInput(input: CpfGeneratorInput): CpfGeneratorFieldErrors {
  const errors: CpfGeneratorFieldErrors = {};

  if (
    !Number.isFinite(input.count) ||
    !Number.isInteger(input.count) ||
    input.count < 1
  ) {
    errors.count = "Informe uma quantidade inteira de pelo menos 1.";
  } else if (input.count > CPF_GENERATOR_MAX_BATCH) {
    errors.count = `A quantidade não pode ser maior que ${CPF_GENERATOR_MAX_BATCH}.`;
  }

  return errors;
}

export function isCpfGeneratorInputValid(input: CpfGeneratorInput): boolean {
  return Object.keys(validateCpfGeneratorInput(input)).length === 0;
}

/**
 * Gera um lote de CPFs sintéticos. O limite (CPF_GENERATOR_MAX_BATCH) é
 * aplicado ANTES de qualquer geração, então nunca é criado um array maior
 * que o limite, mesmo que a validação seja pulada por algum chamador.
 */
export function generateCpfBatch(input: CpfGeneratorInput): string[] {
  const safeCount = Math.min(
    Math.max(1, Math.trunc(input.count) || 1),
    CPF_GENERATOR_MAX_BATCH
  );

  return Array.from({ length: safeCount }, () => generateCpf(input.formatted));
}
