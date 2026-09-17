/**
 * Geração de números de Inscrição Estadual SINTÉTICOS para testes de
 * formulários (categoria Geradores). Mantido isolado da interface (PROMPT
 * MESTRE, seção 14).
 *
 * LIMITAÇÃO CONHECIDA E IMPORTANTE (ver PROMPT MESTRE, ETAPA 4, item 16 —
 * "se não for possível implementar todos de imediato, informar limitação e
 * entregar estrutura escalável"): cada um dos 26 estados + DF define seu
 * próprio formato e algoritmo de dígito verificador de Inscrição Estadual,
 * de forma independente (não existe uma Receita Estadual única, como há
 * para CPF/CNPJ na Receita Federal). Implementar corretamente o algoritmo
 * de cada uma das 27 unidades federativas está fora do escopo desta
 * primeira entrega.
 *
 * Por isso, este gerador entrega a ESTRUTURA ESCALÁVEL pedida: um
 * seletor com as 27 UFs (lib/data/brazilian-states.ts) e uma geração
 * genérica de 9 dígitos numéricos (o comprimento mais comum entre os
 * estados) — sem aplicar o algoritmo específico de nenhuma UF. Use esta
 * ferramenta para testar campos de formulário que aceitam Inscrição
 * Estadual como texto livre, não para validar o layout exato de um estado
 * específico. Adicionar o algoritmo oficial de uma UF específica no futuro
 * é uma extensão direta deste arquivo (uma função por UF), sem qualquer
 * mudança na interface.
 *
 * Os dígitos são sorteados com `crypto.getRandomValues` (ver
 * lib/random/secure-random.ts), nunca com `Math.random`.
 */

import { secureRandomDigit, secureRandomChoice } from "@/lib/random/secure-random";
import { BRAZILIAN_STATES } from "@/lib/data/brazilian-states";

export const STATE_TAX_ID_GENERATOR_MAX_BATCH = 100;
export const STATE_TAX_ID_DIGIT_COUNT = 9;

export interface StateTaxIdGeneratorInput {
  count: number;
  /** Sigla de UF (ver BRAZILIAN_STATES), ou "random" para sortear. */
  uf: string;
}

export interface StateTaxIdGeneratorFieldErrors {
  count?: string;
}

export interface GeneratedStateTaxId {
  uf: string;
  value: string;
}

/** Gera uma única Inscrição Estadual sintética (formato genérico — ver cabeçalho). */
export function generateStateTaxId(ufInput: string): GeneratedStateTaxId {
  const uf =
    ufInput === "random" ? secureRandomChoice(BRAZILIAN_STATES).uf : ufInput;

  const digits = Array.from({ length: STATE_TAX_ID_DIGIT_COUNT }, () => secureRandomDigit()).join("");
  return { uf, value: digits };
}

export function validateStateTaxIdGeneratorInput(
  input: StateTaxIdGeneratorInput
): StateTaxIdGeneratorFieldErrors {
  const errors: StateTaxIdGeneratorFieldErrors = {};

  if (!Number.isFinite(input.count) || !Number.isInteger(input.count) || input.count < 1) {
    errors.count = "Informe uma quantidade inteira de pelo menos 1.";
  } else if (input.count > STATE_TAX_ID_GENERATOR_MAX_BATCH) {
    errors.count = `A quantidade não pode ser maior que ${STATE_TAX_ID_GENERATOR_MAX_BATCH}.`;
  }

  return errors;
}

export function isStateTaxIdGeneratorInputValid(input: StateTaxIdGeneratorInput): boolean {
  return Object.keys(validateStateTaxIdGeneratorInput(input)).length === 0;
}

/**
 * Gera um lote de Inscrições Estaduais sintéticas. O limite
 * (STATE_TAX_ID_GENERATOR_MAX_BATCH) é aplicado ANTES de qualquer geração,
 * então nunca é criado um array maior que o limite, mesmo que a validação
 * seja pulada por algum chamador.
 */
export function generateStateTaxIdBatch(
  input: StateTaxIdGeneratorInput
): GeneratedStateTaxId[] {
  const safeCount = Math.min(
    Math.max(1, Math.trunc(input.count) || 1),
    STATE_TAX_ID_GENERATOR_MAX_BATCH
  );

  return Array.from({ length: safeCount }, () => generateStateTaxId(input.uf));
}
