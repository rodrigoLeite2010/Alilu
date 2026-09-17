/**
 * Geração de perfis de PESSOA FÍSICA FICTÍCIOS, combinando os geradores já
 * existentes (nome, CPF, RG, CEP) com data de nascimento, telefone e
 * e-mail sintéticos (categoria Geradores). Mantido isolado da interface
 * (PROMPT MESTRE, seção 14).
 *
 * Nenhum dado é vinculado a uma pessoa real: o CPF e o RG usam os mesmos
 * geradores sintéticos já auditados (lib/calculators/cpf-generator.ts e
 * rg-generator.ts, com os mesmos avisos e limitações documentados neles),
 * o nome é sorteado de listas de nomes comuns (lib/calculators/name-generator.ts),
 * e data de nascimento, telefone e e-mail são apenas combinações
 * plausíveis, sem consulta a nenhuma base de dados real.
 */

import { secureRandomChoice, secureRandomIntRange, secureRandomDigit } from "@/lib/random/secure-random";
import { generateName, type NameGeneratorGender } from "@/lib/calculators/name-generator";
import { generateCpf } from "@/lib/calculators/cpf-generator";
import { generateRg } from "@/lib/calculators/rg-generator";
import { generateCep } from "@/lib/calculators/cep-generator";

export const PERSON_GENERATOR_MAX_BATCH = 50;

/** DDDs válidos usados apenas como exemplo plausível de telefone. */
export const PERSON_PHONE_DDDS = [
  11, 21, 31, 41, 47, 48, 51, 61, 62, 71, 81, 85, 91, 92, 95,
];

export const PERSON_EMAIL_DOMAINS = [
  "gmail.com",
  "hotmail.com",
  "outlook.com",
  "yahoo.com.br",
  "uol.com.br",
];

const MIN_AGE = 18;
const MAX_AGE = 80;

export interface GeneratedPerson {
  name: string;
  gender: Exclude<NameGeneratorGender, "aleatorio">;
  cpf: string;
  rg: string;
  birthDate: string;
  age: number;
  cep: string;
  phone: string;
  email: string;
}

export interface PersonGeneratorInput {
  count: number;
  gender: NameGeneratorGender;
}

export interface PersonGeneratorFieldErrors {
  count?: string;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Remove acentos e caracteres não alfabéticos, para montar um e-mail plausível. */
function slugifyNameForEmail(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .trim()
    .split(/\s+/)
    .join(".");
}

/** Gera um único perfil de pessoa física fictícia. */
export function generatePerson(genderInput: NameGeneratorGender): GeneratedPerson {
  const gender: Exclude<NameGeneratorGender, "aleatorio"> =
    genderInput === "aleatorio" ? secureRandomChoice(["masculino", "feminino"] as const) : genderInput;

  const name = generateName({ gender, kind: "completo", surnameCount: secureRandomChoice([1, 2] as const) });

  const age = secureRandomIntRange(MIN_AGE, MAX_AGE);
  const now = new Date();
  const birthYear = now.getFullYear() - age;
  const birthMonth = secureRandomIntRange(1, 12);
  const birthDay = secureRandomIntRange(1, daysInMonth(birthYear, birthMonth));
  const birthDate = `${String(birthDay).padStart(2, "0")}/${String(birthMonth).padStart(2, "0")}/${birthYear}`;

  const ddd = secureRandomChoice(PERSON_PHONE_DDDS);
  const phoneDigits = Array.from({ length: 8 }, () => secureRandomDigit()).join("");
  const phone = `(${ddd}) 9${phoneDigits.slice(0, 4)}-${phoneDigits.slice(4, 8)}`;

  const domain = secureRandomChoice(PERSON_EMAIL_DOMAINS);
  const emailSuffix = secureRandomIntRange(1, 99);
  const email = `${slugifyNameForEmail(name)}${emailSuffix}@${domain}`;

  return {
    name,
    gender,
    cpf: generateCpf(true),
    rg: generateRg(true),
    birthDate,
    age,
    cep: generateCep(true),
    phone,
    email,
  };
}

export function validatePersonGeneratorInput(input: PersonGeneratorInput): PersonGeneratorFieldErrors {
  const errors: PersonGeneratorFieldErrors = {};

  if (!Number.isFinite(input.count) || !Number.isInteger(input.count) || input.count < 1) {
    errors.count = "Informe uma quantidade inteira de pelo menos 1.";
  } else if (input.count > PERSON_GENERATOR_MAX_BATCH) {
    errors.count = `A quantidade não pode ser maior que ${PERSON_GENERATOR_MAX_BATCH}.`;
  }

  return errors;
}

export function isPersonGeneratorInputValid(input: PersonGeneratorInput): boolean {
  return Object.keys(validatePersonGeneratorInput(input)).length === 0;
}

/**
 * Gera um lote de pessoas fictícias. O limite (PERSON_GENERATOR_MAX_BATCH)
 * é aplicado ANTES de qualquer geração, então nunca é criado um array maior
 * que o limite, mesmo que a validação seja pulada por algum chamador.
 */
export function generatePersonBatch(input: PersonGeneratorInput): GeneratedPerson[] {
  const safeCount = Math.min(Math.max(1, Math.trunc(input.count) || 1), PERSON_GENERATOR_MAX_BATCH);

  return Array.from({ length: safeCount }, () => generatePerson(input.gender));
}
