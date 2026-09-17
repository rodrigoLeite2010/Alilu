/**
 * Geração de números de "matrícula" SINTÉTICOS, no comprimento usado pelo
 * registro civil brasileiro (nascimento, casamento e óbito), para testar
 * formulários que pedem esse número como texto (categoria Geradores).
 * Mantido isolado da interface (PROMPT MESTRE, seção 14).
 *
 * LIMITAÇÃO CONHECIDA E IMPORTANTE (mesmo espírito do aviso em
 * lib/calculators/rg-generator.ts e state-tax-id-generator.ts): a
 * matrícula de registro civil do CNJ é popularmente conhecida como um
 * número de 32 dígitos. Esta ferramenta gera 32 dígitos aleatórios NESSE
 * COMPRIMENTO TOTAL, mas não reproduz a divisão oficial exata em blocos
 * (código do cartório, ano, tipo de livro/acervo, número do livro, folha,
 * termo e dígito verificador) nem calcula nenhum dígito verificador
 * oficial — a formatação em grupos usada aqui é só para leitura, não
 * corresponde a uma fonte oficial verificada. Use esta ferramenta para
 * testar campos de formulário que aceitam o valor como texto livre de 32
 * dígitos, não para validar o layout exato de uma certidão real.
 *
 * IMPORTANTE: este arquivo NUNCA consulta a Central Nacional de
 * Informações do Registro Civil (CRC Nacional) nem qualquer cartório real
 * — os números gerados não representam nenhum registro existente, e esta
 * ferramenta NÃO gera nem simula uma imagem ou documento de certidão, só o
 * número de matrícula em texto.
 *
 * Os dígitos são sorteados com `crypto.getRandomValues` (ver
 * lib/random/secure-random.ts), nunca com `Math.random`.
 */

import { secureRandomDigit } from "@/lib/random/secure-random";

export const CERTIFICATE_REGISTRY_GENERATOR_MAX_BATCH = 100;
export const CERTIFICATE_REGISTRY_DIGIT_COUNT = 32;

export type CertificateRegistryType = "nascimento" | "casamento" | "obito";

export const CERTIFICATE_REGISTRY_TYPE_LABELS: Record<CertificateRegistryType, string> = {
  nascimento: "Certidão de Nascimento",
  casamento: "Certidão de Casamento",
  obito: "Certidão de Óbito",
};

export interface CertificateRegistryGeneratorInput {
  count: number;
  type: CertificateRegistryType;
}

export interface CertificateRegistryGeneratorFieldErrors {
  count?: string;
}

export interface GeneratedCertificateRegistry {
  type: CertificateRegistryType;
  /** 32 dígitos, sem formatação. */
  value: string;
  /** 32 dígitos agrupados só para leitura (ver limitação no cabeçalho). */
  formatted: string;
}

/** Agrupa os 32 dígitos em blocos de 4, apenas para leitura. */
function formatRegistryDigits(digits: string): string {
  return digits.match(/.{1,4}/g)?.join("-") ?? digits;
}

/** Gera um único número de matrícula sintético (ver limitação no cabeçalho). */
export function generateCertificateRegistry(type: CertificateRegistryType): GeneratedCertificateRegistry {
  const value = Array.from({ length: CERTIFICATE_REGISTRY_DIGIT_COUNT }, () => secureRandomDigit()).join("");

  return {
    type,
    value,
    formatted: formatRegistryDigits(value),
  };
}

export function validateCertificateRegistryGeneratorInput(
  input: CertificateRegistryGeneratorInput
): CertificateRegistryGeneratorFieldErrors {
  const errors: CertificateRegistryGeneratorFieldErrors = {};

  if (!Number.isFinite(input.count) || !Number.isInteger(input.count) || input.count < 1) {
    errors.count = "Informe uma quantidade inteira de pelo menos 1.";
  } else if (input.count > CERTIFICATE_REGISTRY_GENERATOR_MAX_BATCH) {
    errors.count = `A quantidade não pode ser maior que ${CERTIFICATE_REGISTRY_GENERATOR_MAX_BATCH}.`;
  }

  return errors;
}

export function isCertificateRegistryGeneratorInputValid(input: CertificateRegistryGeneratorInput): boolean {
  return Object.keys(validateCertificateRegistryGeneratorInput(input)).length === 0;
}

/**
 * Gera um lote de números de matrícula sintéticos. O limite
 * (CERTIFICATE_REGISTRY_GENERATOR_MAX_BATCH) é aplicado ANTES de qualquer
 * geração, então nunca é criado um array maior que o limite, mesmo que a
 * validação seja pulada por algum chamador.
 */
export function generateCertificateRegistryBatch(
  input: CertificateRegistryGeneratorInput
): GeneratedCertificateRegistry[] {
  const safeCount = Math.min(
    Math.max(1, Math.trunc(input.count) || 1),
    CERTIFICATE_REGISTRY_GENERATOR_MAX_BATCH
  );

  return Array.from({ length: safeCount }, () => generateCertificateRegistry(input.type));
}
