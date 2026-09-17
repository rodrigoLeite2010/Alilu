/**
 * Validação de Inscrição Estadual — categoria Validadores.
 *
 * LIMITAÇÃO CONHECIDA E IMPORTANTE (mesmo espírito do aviso em
 * lib/calculators/state-tax-id-generator.ts): cada um dos 26 estados + DF
 * define seu próprio formato e algoritmo de dígito verificador de
 * Inscrição Estadual, de forma independente — não existe uma Receita
 * Estadual única, como há para CPF/CNPJ na Receita Federal. Implementar
 * corretamente o algoritmo de cada uma das 27 unidades federativas está
 * fora do escopo desta primeira entrega, e um algoritmo incorreto seria
 * pior do que nenhum algoritmo.
 *
 * Por isso este arquivo valida apenas o FORMATO geral (UF selecionada +
 * valor só com dígitos, dentro de um intervalo de tamanho compatível com a
 * maioria dos estados) — nunca um dígito verificador específico de UF. A
 * estrutura (uma função central, com a UF como parâmetro) já está pronta
 * para receber, no futuro, o algoritmo oficial de uma UF por vez, sem
 * qualquer mudança na interface.
 *
 * Este arquivo NUNCA consulta nenhuma Secretaria da Fazenda estadual.
 */

import { onlyDigits } from "@/lib/validators/document";
import { BRAZILIAN_STATES } from "@/lib/data/brazilian-states";

export interface StateTaxIdValidationResult {
  valid: boolean;
  /** true quando a UF informada não está na lista de UFs conhecidas. */
  unknownUf: boolean;
}

/**
 * Valida apenas o FORMATO de uma Inscrição Estadual para a UF informada —
 * ver limitação detalhada no cabeçalho deste arquivo. Aceita de 8 a 14
 * dígitos (intervalo que cobre o comprimento usado pela grande maioria dos
 * estados), com ou sem pontuação/barra na digitação.
 */
export function validateStateTaxIdFormat(
  uf: string,
  value: string
): StateTaxIdValidationResult {
  const knownUf = BRAZILIAN_STATES.some((state) => state.uf === uf);
  const digits = onlyDigits(value);

  return {
    valid: knownUf && digits.length >= 8 && digits.length <= 14,
    unknownUf: !knownUf,
  };
}
