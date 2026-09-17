/**
 * Validação de RG (Registro Geral) — categoria Validadores.
 *
 * LIMITAÇÃO CONHECIDA E IMPORTANTE (mesmo espírito do aviso em
 * lib/calculators/rg-generator.ts): o RG não tem um padrão nacional único
 * — cada Secretaria de Segurança Pública estadual define seu próprio
 * formato e algoritmo de dígito verificador, sem um cadastro/algoritmo
 * federal único (ao contrário de CPF, CNPJ, PIS/PASEP, CNH ou Título de
 * Eleitor).
 *
 * Por isso este arquivo reaproveita — em vez de duplicar — o único cálculo
 * de dígito verificador já existente no projeto para RG
 * (`calculateRgCheckDigit`, em lib/calculators/rg-generator.ts): o padrão
 * ilustrativo mais comumente reproduzido por validadores públicos de
 * terceiros para o RG de São Paulo (8 dígitos-base + 1 dígito verificador
 * por módulo 11). Esse arquivo já documenta que este NÃO é comprovadamente
 * o algoritmo oficial atual da SSP-SP, apenas o padrão de estrutura mais
 * usado — por isso a validação aqui é apresentada com a mesma ressalva,
 * nunca como confirmação de um RG real.
 *
 * Para os demais estados (que não publicam um algoritmo de dígito
 * verificador unificado), só é verificado o FORMATO geral (quantidade de
 * dígitos), nunca um dígito verificador inventado.
 *
 * Este arquivo NUNCA consulta nenhuma Secretaria de Segurança Pública nem
 * qualquer cadastro de pessoas.
 */

import { onlyDigits } from "@/lib/validators/document";
import { calculateRgCheckDigit } from "@/lib/calculators/rg-generator";

export type RgValidationScope = "sp-padrao-ilustrativo" | "formato-generico";

export interface RgValidationResult {
  valid: boolean;
  /** Indica qual verificação foi de fato aplicada (ver aviso no cabeçalho). */
  scope: RgValidationScope;
}

/**
 * Limpa o valor digitado (remove pontuação) e normaliza o dígito
 * verificador final ("x" -> "X").
 */
function normalizeRg(value: string): string {
  const trimmed = value.trim().toUpperCase();
  const digitsAndX = trimmed.replace(/[^0-9X]/g, "");
  return digitsAndX;
}

/**
 * Valida um RG pelo padrão ilustrativo de São Paulo (ver aviso no
 * cabeçalho deste arquivo): 8 dígitos-base + 1 dígito verificador (0-9 ou
 * "X") calculado por módulo 11, reaproveitando `calculateRgCheckDigit`.
 */
export function isValidRgSP(value: string): boolean {
  const normalized = normalizeRg(value);
  if (!/^\d{8}[0-9X]$/.test(normalized)) {
    return false;
  }

  const base8 = normalized
    .slice(0, 8)
    .split("")
    .map(Number);
  const providedCheckDigit = normalized.slice(8);

  return calculateRgCheckDigit(base8) === providedCheckDigit;
}

/**
 * Verifica apenas se o valor tem um formato plausível de RG (7 a 9 dígitos,
 * podendo terminar em "X") — usado para UFs sem algoritmo de dígito
 * verificador publicamente unificado. NUNCA afirma que o dígito
 * verificador está correto, só que o formato é compatível.
 */
export function isRgFormatPlausible(value: string): boolean {
  const normalized = normalizeRg(value);
  return /^\d{6,9}[0-9X]?$/.test(normalized) && onlyDigits(normalized).length >= 7;
}

/**
 * Valida um RG de acordo com a UF selecionada. Para "SP", aplica o
 * dígito verificador (ver isValidRgSP); para as demais UFs, valida apenas
 * o formato geral (ver aviso no cabeçalho — nenhuma UF além de SP tem
 * algoritmo de dígito verificador implementado aqui).
 */
export function validateRg(value: string, uf: string): RgValidationResult {
  if (uf === "SP") {
    return { valid: isValidRgSP(value), scope: "sp-padrao-ilustrativo" };
  }
  return { valid: isRgFormatPlausible(value), scope: "formato-generico" };
}
