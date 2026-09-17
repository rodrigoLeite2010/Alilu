/**
 * Geração de perfis de PESSOA JURÍDICA FICTÍCIOS, combinando os geradores
 * já existentes (CNPJ, Inscrição Estadual, CEP) com nome fantasia, razão
 * social, telefone e e-mail sintéticos (categoria Geradores). Mantido
 * isolado da interface (PROMPT MESTRE, seção 14).
 *
 * Nenhum dado é vinculado a uma empresa real: o CNPJ usa o mesmo gerador
 * sintético já auditado (lib/calculators/cnpj-generator.ts), e o nome
 * fantasia é uma combinação aleatória de palavras genéricas — qualquer
 * semelhança com uma empresa real é coincidência, não intencional.
 */

import { secureRandomChoice, secureRandomDigit } from "@/lib/random/secure-random";
import { generateCnpj } from "@/lib/calculators/cnpj-generator";
import { generateStateTaxId, type GeneratedStateTaxId } from "@/lib/calculators/state-tax-id-generator";
import { generateCep } from "@/lib/calculators/cep-generator";

export const COMPANY_GENERATOR_MAX_BATCH = 50;

const COMPANY_NAME_WORDS = [
  "Alfa", "Prisma", "Horizonte", "Vértice", "Nexus", "Zênite", "Aurora",
  "Bússola", "Nova", "Central", "União", "Vanguarda", "Ápice", "Matriz",
  "Ponto", "Origem", "Plena", "Fórmula", "Trilha", "Cimo",
];

const COMPANY_SEGMENT_LABELS = [
  "Tecnologia", "Comércio", "Serviços", "Alimentação", "Construção",
  "Saúde", "Educação", "Consultoria", "Logística", "Design",
] as const;

const LEGAL_SUFFIXES = ["Ltda", "S.A.", "EIRELI", "ME"] as const;

export interface GeneratedCompany {
  fantasyName: string;
  legalName: string;
  segment: string;
  cnpj: string;
  stateTaxId: GeneratedStateTaxId;
  cep: string;
  phone: string;
  email: string;
}

export interface CompanyGeneratorInput {
  count: number;
}

export interface CompanyGeneratorFieldErrors {
  count?: string;
}

/** Remove acentos e caracteres não alfabéticos, para montar um e-mail plausível. */
function slugifyForEmail(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

/** Gera um único perfil de empresa fictícia. */
export function generateCompany(): GeneratedCompany {
  const segment = secureRandomChoice(COMPANY_SEGMENT_LABELS);
  const namePart = secureRandomChoice(COMPANY_NAME_WORDS);
  const fantasyName = `${namePart} ${segment}`;
  const legalName = `${fantasyName} ${secureRandomChoice(LEGAL_SUFFIXES)}`;

  const phoneDigits = Array.from({ length: 8 }, () => secureRandomDigit()).join("");

  return {
    fantasyName,
    legalName,
    segment,
    cnpj: generateCnpj("numeric", true),
    stateTaxId: generateStateTaxId("random"),
    cep: generateCep(true),
    phone: `(${secureRandomChoice([11, 21, 31, 41, 51, 61, 71, 81, 85])}) ${phoneDigits.slice(0, 4)}-${phoneDigits.slice(4, 8)}`,
    email: `contato@${slugifyForEmail(namePart)}.com.br`,
  };
}

export function validateCompanyGeneratorInput(input: CompanyGeneratorInput): CompanyGeneratorFieldErrors {
  const errors: CompanyGeneratorFieldErrors = {};

  if (!Number.isFinite(input.count) || !Number.isInteger(input.count) || input.count < 1) {
    errors.count = "Informe uma quantidade inteira de pelo menos 1.";
  } else if (input.count > COMPANY_GENERATOR_MAX_BATCH) {
    errors.count = `A quantidade não pode ser maior que ${COMPANY_GENERATOR_MAX_BATCH}.`;
  }

  return errors;
}

export function isCompanyGeneratorInputValid(input: CompanyGeneratorInput): boolean {
  return Object.keys(validateCompanyGeneratorInput(input)).length === 0;
}

/**
 * Gera um lote de empresas fictícias. O limite (COMPANY_GENERATOR_MAX_BATCH)
 * é aplicado ANTES de qualquer geração, então nunca é criado um array maior
 * que o limite, mesmo que a validação seja pulada por algum chamador.
 */
export function generateCompanyBatch(input: CompanyGeneratorInput): GeneratedCompany[] {
  const safeCount = Math.min(Math.max(1, Math.trunc(input.count) || 1), COMPANY_GENERATOR_MAX_BATCH);

  return Array.from({ length: safeCount }, () => generateCompany());
}
