/**
 * Geração de CNPJs SINTÉTICOS para testes de desenvolvimento e QA (ETAPA 4
 * da categoria Geradores, ex-"Devs"). Mantido isolado da interface (PROMPT MESTRE, seção
 * 14). NUNCA consulta cadastros empresariais da Receita Federal — os
 * números são apenas matematicamente válidos, o que não comprova cadastro
 * ou existência de empresa alguma.
 *
 * Suporta os dois formatos oficiais:
 *  - "numeric": CNPJ tradicional (12 dígitos + 2 dígitos verificadores).
 *  - "alphanumeric": novo CNPJ alfanumérico da Receita Federal (12
 *    caracteres alfanuméricos + 2 dígitos verificadores, sempre numéricos).
 *
 * O algoritmo dos dígitos verificadores foi confirmado antes da
 * implementação em três fontes oficiais/independentes (Receita Federal —
 * "Manual de Cálculo do DV do CNPJ" e Instrução Normativa RFB nº
 * 2.229/2024; e Serpro — "Cálculo dos dígitos verificadores de CNPJ
 * alfanumérico"), incluindo verificação manual do exemplo numérico oficial
 * ("12.ABC.345/01DE-35") reproduzido nos testes automatizados deste
 * módulo — ver ETAPA 4: "não reutilize cegamente o algoritmo do CNPJ
 * numérico". O cálculo real é:
 *
 *  1. Cada um dos 12 primeiros caracteres (dígito 0-9 ou letra maiúscula
 *     A-Z) é convertido para um valor numérico = código ASCII do caractere
 *     menos 48 (assim, '0'..'9' => 0..9 e 'A'..'Z' => 17..42).
 *  2. 1º dígito verificador: soma dos 12 valores × pesos
 *     [5,4,3,2,9,8,7,6,5,4,3,2]; resto = soma % 11; DV = resto < 2 ? 0 : 11
 *     - resto.
 *  3. 2º dígito verificador: mesmo processo, mas sobre as 13 posições
 *     (as 12 originais + o 1º DV), com pesos
 *     [6,5,4,3,2,9,8,7,6,5,4,3,2].
 *  4. Os dois dígitos verificadores são sempre numéricos (0-9), mesmo
 *     quando os 12 caracteres-base incluem letras.
 *
 * Como o valor de cada dígito 0-9 sob essa fórmula (código ASCII - 48) é
 * idêntico ao valor do próprio dígito, o mesmo cálculo é retrocompatível
 * com o CNPJ numérico tradicional — por isso uma única função de cálculo
 * (`calculateCnpjCheckDigits`) cobre os dois formatos.
 */

import { secureRandomInt } from "@/lib/random/secure-random";

/** Quantidade máxima de CNPJs que podem ser gerados em um único lote. */
export const CNPJ_GENERATOR_MAX_BATCH = 100;

export type CnpjGeneratorFormat = "numeric" | "alphanumeric";

export interface CnpjGeneratorInput {
  /** Quantidade de CNPJs a gerar em lote (1 a CNPJ_GENERATOR_MAX_BATCH). */
  count: number;
  format: CnpjGeneratorFormat;
  /** true => "00.000.000/0001-00"; false => "00000000000100" */
  formatted: boolean;
}

export interface CnpjGeneratorFieldErrors {
  count?: string;
}

const NUMERIC_CHARSET = "0123456789";
const ALPHANUMERIC_CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Converte um único caractere (0-9 ou A-Z) para seu valor na fórmula do DV. */
function charValue(char: string): number {
  return char.charCodeAt(0) - 48;
}

/**
 * Calcula os dois dígitos verificadores de um CNPJ a partir dos 12
 * primeiros caracteres (numéricos ou alfanuméricos, sempre maiúsculos).
 * Ver o cabeçalho deste arquivo para a fonte oficial do algoritmo.
 */
export function calculateCnpjCheckDigits(base12: string): [number, number] {
  if (base12.length !== 12 || !/^[0-9A-Z]{12}$/.test(base12)) {
    throw new Error(
      "base12 deve conter exatamente 12 caracteres (dígitos 0-9 ou letras maiúsculas A-Z)."
    );
  }

  const weightsFirst = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weightsSecond = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const calcDigit = (chars: string, weights: number[]): number => {
    let sum = 0;
    for (let i = 0; i < chars.length; i += 1) {
      sum += charValue(chars[i]) * weights[i];
    }
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const firstCheck = calcDigit(base12, weightsFirst);
  const secondCheck = calcDigit(base12 + String(firstCheck), weightsSecond);

  return [firstCheck, secondCheck];
}

/** Aplica a máscara 00.000.000/0000-00 a uma string de 14 caracteres. */
export function formatGeneratedCnpj(raw: string): string {
  return `${raw.slice(0, 2)}.${raw.slice(2, 5)}.${raw.slice(5, 8)}/${raw.slice(8, 12)}-${raw.slice(12, 14)}`;
}

/**
 * Gera um único CNPJ sintético no formato pedido, com dígitos
 * verificadores matematicamente corretos.
 */
export function generateCnpj(format: CnpjGeneratorFormat, formatted = true): string {
  const charset = format === "alphanumeric" ? ALPHANUMERIC_CHARSET : NUMERIC_CHARSET;

  let base12 = "";
  for (let i = 0; i < 12; i += 1) {
    base12 += charset[secureRandomInt(charset.length)];
  }

  const [d1, d2] = calculateCnpjCheckDigits(base12);
  const raw = `${base12}${d1}${d2}`;

  return formatted ? formatGeneratedCnpj(raw) : raw;
}

export function validateCnpjGeneratorInput(input: CnpjGeneratorInput): CnpjGeneratorFieldErrors {
  const errors: CnpjGeneratorFieldErrors = {};

  if (
    !Number.isFinite(input.count) ||
    !Number.isInteger(input.count) ||
    input.count < 1
  ) {
    errors.count = "Informe uma quantidade inteira de pelo menos 1.";
  } else if (input.count > CNPJ_GENERATOR_MAX_BATCH) {
    errors.count = `A quantidade não pode ser maior que ${CNPJ_GENERATOR_MAX_BATCH}.`;
  }

  return errors;
}

export function isCnpjGeneratorInputValid(input: CnpjGeneratorInput): boolean {
  return Object.keys(validateCnpjGeneratorInput(input)).length === 0;
}

/**
 * Gera um lote de CNPJs sintéticos. O limite (CNPJ_GENERATOR_MAX_BATCH) é
 * aplicado ANTES de qualquer geração, então nunca é criado um array maior
 * que o limite, mesmo que a validação seja pulada por algum chamador.
 */
export function generateCnpjBatch(input: CnpjGeneratorInput): string[] {
  const safeCount = Math.min(
    Math.max(1, Math.trunc(input.count) || 1),
    CNPJ_GENERATOR_MAX_BATCH
  );

  return Array.from({ length: safeCount }, () =>
    generateCnpj(input.format, input.formatted)
  );
}
