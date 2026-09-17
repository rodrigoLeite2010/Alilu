/**
 * Validação de número de matrícula de Certidão (nascimento, casamento ou
 * óbito) — categoria Validadores.
 *
 * LIMITAÇÃO CONHECIDA E IMPORTANTE (mesmo espírito do aviso em
 * lib/calculators/certificate-registry-generator.ts): a matrícula de
 * registro civil do CNJ é popularmente conhecida como um número de 32
 * dígitos, mas este projeto não tem acesso à especificação oficial exata
 * da divisão em blocos (código do cartório, ano, tipo de livro/acervo,
 * número do livro, folha, termo) nem ao cálculo do dígito verificador
 * oficial — reproduzi-los sem uma fonte confirmada seria inventar um
 * algoritmo incorreto, o que este projeto explicitamente evita.
 *
 * Por isso esta ferramenta verifica APENAS se o valor tem o comprimento de
 * 32 dígitos numéricos (com ou sem separadores de digitação) — nunca o
 * dígito verificador ou a estrutura interna dos blocos.
 *
 * Este arquivo NUNCA consulta a Central Nacional de Informações do
 * Registro Civil (CRC Nacional) nem qualquer cartório real.
 */

import { onlyDigits } from "@/lib/validators/document";

export const CERTIFICATE_REGISTRY_VALIDATOR_DIGIT_COUNT = 32;

/**
 * Verifica apenas se o valor tem exatamente 32 dígitos numéricos — ver
 * limitação detalhada no cabeçalho deste arquivo.
 */
export function isCertificateRegistryFormatValid(value: string): boolean {
  const digits = onlyDigits(value);
  return digits.length === CERTIFICATE_REGISTRY_VALIDATOR_DIGIT_COUNT;
}

/** Agrupa os dígitos digitados em blocos de 4, apenas para leitura durante a digitação. */
export function formatCertificateRegistryInput(value: string): string {
  const digits = onlyDigits(value).slice(0, CERTIFICATE_REGISTRY_VALIDATOR_DIGIT_COUNT);
  return digits.match(/.{1,4}/g)?.join("-") ?? digits;
}
