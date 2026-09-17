/**
 * Geração de placas de veículo SINTÉTICAS para testes de formulários e
 * validações (categoria Geradores). Mantido isolado da interface (PROMPT
 * MESTRE, seção 14).
 *
 * IMPORTANTE: este arquivo NUNCA consulta o DETRAN, a Base Índice Nacional
 * de Veículos (BIN) nem qualquer cadastro de veículos — as placas geradas
 * são combinações aleatórias de letras e números dentro do formato oficial,
 * o que não indica que exista um veículo real com essa placa.
 *
 * Suporta os dois formatos oficiais brasileiros:
 *  - "mercosul": padrão LLL0L00 (3 letras, 1 número, 1 letra, 2 números),
 *    em vigor desde 2018, sem separador.
 *  - "antiga": padrão LLL-0000 (3 letras, 4 números), com hífen.
 *
 * Todos os caracteres são sorteados com `crypto.getRandomValues` (ver
 * lib/random/secure-random.ts), nunca com `Math.random`.
 */

import { secureRandomChar } from "@/lib/random/secure-random";

/** Quantidade máxima de placas que podem ser geradas em um único lote. */
export const LICENSE_PLATE_GENERATOR_MAX_BATCH = 100;

export type LicensePlateFormat = "mercosul" | "antiga";

export interface LicensePlateGeneratorInput {
  count: number;
  format: LicensePlateFormat;
}

export interface LicensePlateGeneratorFieldErrors {
  count?: string;
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS = "0123456789";

/** Gera uma única placa sintética no formato pedido, já formatada. */
export function generateLicensePlate(format: LicensePlateFormat): string {
  const letter = () => secureRandomChar(LETTERS);
  const digit = () => secureRandomChar(DIGITS);

  if (format === "mercosul") {
    return `${letter()}${letter()}${letter()}${digit()}${letter()}${digit()}${digit()}`;
  }

  return `${letter()}${letter()}${letter()}-${digit()}${digit()}${digit()}${digit()}`;
}

export function validateLicensePlateGeneratorInput(
  input: LicensePlateGeneratorInput
): LicensePlateGeneratorFieldErrors {
  const errors: LicensePlateGeneratorFieldErrors = {};

  if (!Number.isFinite(input.count) || !Number.isInteger(input.count) || input.count < 1) {
    errors.count = "Informe uma quantidade inteira de pelo menos 1.";
  } else if (input.count > LICENSE_PLATE_GENERATOR_MAX_BATCH) {
    errors.count = `A quantidade não pode ser maior que ${LICENSE_PLATE_GENERATOR_MAX_BATCH}.`;
  }

  return errors;
}

export function isLicensePlateGeneratorInputValid(input: LicensePlateGeneratorInput): boolean {
  return Object.keys(validateLicensePlateGeneratorInput(input)).length === 0;
}

/**
 * Gera um lote de placas sintéticas. O limite
 * (LICENSE_PLATE_GENERATOR_MAX_BATCH) é aplicado ANTES de qualquer geração,
 * então nunca é criado um array maior que o limite, mesmo que a validação
 * seja pulada por algum chamador.
 */
export function generateLicensePlateBatch(input: LicensePlateGeneratorInput): string[] {
  const safeCount = Math.min(
    Math.max(1, Math.trunc(input.count) || 1),
    LICENSE_PLATE_GENERATOR_MAX_BATCH
  );

  return Array.from({ length: safeCount }, () => generateLicensePlate(input.format));
}
