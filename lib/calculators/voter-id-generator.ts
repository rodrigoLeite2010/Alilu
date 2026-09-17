/**
 * Geração de números de Título de Eleitor SINTÉTICOS para testes de
 * formulários e validações (categoria Geradores). Mantido isolado da
 * interface (PROMPT MESTRE, seção 14).
 *
 * IMPORTANTE: este arquivo NUNCA consulta o TSE, o cadastro de eleitores
 * nem qualquer base de dados eleitoral — os números gerados apenas passam
 * na conta matemática dos dois dígitos verificadores documentados
 * publicamente, o que não indica que exista um título real com esse
 * número.
 *
 * O Título de Eleitor tem 12 dígitos: 8 dígitos de sequencial + 2 dígitos
 * de código do estado (UF de emissão) + 2 dígitos verificadores.
 *   1. DV1 = soma dos 8 dígitos do sequencial × pesos
 *      [2,3,4,5,6,7,8,9], resto da divisão por 11. Se o resto for 10,
 *      DV1 = 0.
 *   2. DV2 = (código UF × [7,8] + DV1 × 9), resto da divisão por 11. Se o
 *      resto for 10, DV2 = 0.
 *
 * LIMITAÇÃO CONHECIDA: São Paulo (01) e Minas Gerais (02) já ultrapassaram
 * 8 dígitos de sequencial no mundo real e usam uma variação de 9 dígitos —
 * este gerador não reproduz esse caso especial e usa sempre 8 dígitos de
 * sequencial para todos os estados, o que é suficiente para o propósito de
 * testar máscaras e validações de formulário (não é uma cópia bit-a-bit do
 * sistema do TSE).
 *
 * O sequencial é sorteado com `crypto.getRandomValues` (ver
 * lib/random/secure-random.ts), nunca com `Math.random`.
 */

import { secureRandomDigit, secureRandomChoice } from "@/lib/random/secure-random";

/** Quantidade máxima de títulos que podem ser gerados em um único lote. */
export const VOTER_ID_GENERATOR_MAX_BATCH = 100;

export interface VoterIdState {
  /** Código de 2 dígitos usado no próprio número do título. */
  code: string;
  uf: string;
  name: string;
}

/** Códigos oficiais de UF usados no Título de Eleitor (TSE), 01 a 28. */
export const VOTER_ID_STATES: VoterIdState[] = [
  { code: "01", uf: "SP", name: "São Paulo" },
  { code: "02", uf: "MG", name: "Minas Gerais" },
  { code: "03", uf: "RJ", name: "Rio de Janeiro" },
  { code: "04", uf: "RS", name: "Rio Grande do Sul" },
  { code: "05", uf: "BA", name: "Bahia" },
  { code: "06", uf: "PR", name: "Paraná" },
  { code: "07", uf: "CE", name: "Ceará" },
  { code: "08", uf: "PE", name: "Pernambuco" },
  { code: "09", uf: "SC", name: "Santa Catarina" },
  { code: "10", uf: "GO", name: "Goiás" },
  { code: "11", uf: "MA", name: "Maranhão" },
  { code: "12", uf: "PB", name: "Paraíba" },
  { code: "13", uf: "PA", name: "Pará" },
  { code: "14", uf: "ES", name: "Espírito Santo" },
  { code: "15", uf: "PI", name: "Piauí" },
  { code: "16", uf: "RN", name: "Rio Grande do Norte" },
  { code: "17", uf: "AL", name: "Alagoas" },
  { code: "18", uf: "MT", name: "Mato Grosso" },
  { code: "19", uf: "MS", name: "Mato Grosso do Sul" },
  { code: "20", uf: "DF", name: "Distrito Federal" },
  { code: "21", uf: "SE", name: "Sergipe" },
  { code: "22", uf: "AM", name: "Amazonas" },
  { code: "23", uf: "RO", name: "Rondônia" },
  { code: "24", uf: "AC", name: "Acre" },
  { code: "25", uf: "AP", name: "Amapá" },
  { code: "26", uf: "RR", name: "Roraima" },
  { code: "27", uf: "TO", name: "Tocantins" },
  { code: "28", uf: "ZZ", name: "Zona Exterior" },
];

export interface VoterIdGeneratorInput {
  count: number;
  /** Código de UF (ver VOTER_ID_STATES), ou "random" para sortear. */
  state: string;
  /** true => "0000 0000 0000"; false => "000000000000" */
  formatted: boolean;
}

export interface VoterIdGeneratorFieldErrors {
  count?: string;
}

function calcDV1(sequence8: number[]): number {
  const weights = [2, 3, 4, 5, 6, 7, 8, 9];
  let sum = 0;
  for (let i = 0; i < 8; i += 1) {
    sum += sequence8[i] * weights[i];
  }
  const rest = sum % 11;
  return rest === 10 ? 0 : rest;
}

function calcDV2(stateCode: [number, number], dv1: number): number {
  const sum = stateCode[0] * 7 + stateCode[1] * 8 + dv1 * 9;
  const rest = sum % 11;
  return rest === 10 ? 0 : rest;
}

/**
 * Calcula os dois dígitos verificadores a partir do sequencial (8 dígitos)
 * e do código de UF (2 dígitos) — ver cabeçalho deste arquivo.
 */
export function calculateVoterIdCheckDigits(
  sequence8: number[],
  stateCode: [number, number]
): [number, number] {
  if (sequence8.length !== 8 || sequence8.some((d) => !Number.isInteger(d) || d < 0 || d > 9)) {
    throw new Error("sequence8 deve conter exatamente 8 dígitos (0-9).");
  }

  const dv1 = calcDV1(sequence8);
  const dv2 = calcDV2(stateCode, dv1);
  return [dv1, dv2];
}

/** Valida um Título de Eleitor completo (12 dígitos) pelo mesmo algoritmo. */
export function isValidVoterId(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 12) return false;

  const nums = digits.split("").map(Number);
  const sequence8 = nums.slice(0, 8);
  const stateCode: [number, number] = [nums[8], nums[9]];
  const [dv1, dv2] = calculateVoterIdCheckDigits(sequence8, stateCode);
  return dv1 === nums[10] && dv2 === nums[11];
}

/** Aplica a máscara "0000 0000 0000" a uma string de 12 dígitos. */
export function formatGeneratedVoterId(digits: string): string {
  return `${digits.slice(0, 4)} ${digits.slice(4, 8)} ${digits.slice(8, 12)}`;
}

/** Gera um único Título de Eleitor sintético para a UF pedida (ou sorteada). */
export function generateVoterId(stateCodeInput: string, formatted = true): string {
  const state =
    stateCodeInput === "random"
      ? secureRandomChoice(VOTER_ID_STATES)
      : (VOTER_ID_STATES.find((s) => s.code === stateCodeInput) ?? VOTER_ID_STATES[0]);

  const sequence8 = Array.from({ length: 8 }, () => secureRandomDigit());
  const stateCode: [number, number] = [Number(state.code[0]), Number(state.code[1])];
  const [dv1, dv2] = calculateVoterIdCheckDigits(sequence8, stateCode);
  const digits = [...sequence8, ...stateCode, dv1, dv2].join("");

  return formatted ? formatGeneratedVoterId(digits) : digits;
}

export function validateVoterIdGeneratorInput(
  input: VoterIdGeneratorInput
): VoterIdGeneratorFieldErrors {
  const errors: VoterIdGeneratorFieldErrors = {};

  if (!Number.isFinite(input.count) || !Number.isInteger(input.count) || input.count < 1) {
    errors.count = "Informe uma quantidade inteira de pelo menos 1.";
  } else if (input.count > VOTER_ID_GENERATOR_MAX_BATCH) {
    errors.count = `A quantidade não pode ser maior que ${VOTER_ID_GENERATOR_MAX_BATCH}.`;
  }

  return errors;
}

export function isVoterIdGeneratorInputValid(input: VoterIdGeneratorInput): boolean {
  return Object.keys(validateVoterIdGeneratorInput(input)).length === 0;
}

/**
 * Gera um lote de Títulos de Eleitor sintéticos. O limite
 * (VOTER_ID_GENERATOR_MAX_BATCH) é aplicado ANTES de qualquer geração,
 * então nunca é criado um array maior que o limite, mesmo que a validação
 * seja pulada por algum chamador.
 */
export function generateVoterIdBatch(input: VoterIdGeneratorInput): string[] {
  const safeCount = Math.min(
    Math.max(1, Math.trunc(input.count) || 1),
    VOTER_ID_GENERATOR_MAX_BATCH
  );

  return Array.from({ length: safeCount }, () => generateVoterId(input.state, input.formatted));
}
