/**
 * Geração de nomes de pessoa FICTÍCIOS a partir de listas curadas de nomes
 * e sobrenomes comuns no Brasil (categoria Geradores). Mantido isolado da
 * interface (PROMPT MESTRE, seção 14).
 *
 * Nenhum nome é vinculado a uma pessoa real: são apenas combinações
 * aleatórias de primeiro nome + sobrenome(s), sorteadas com
 * `crypto.getRandomValues` (ver lib/random/secure-random.ts) a partir de
 * listas de nomes comuns — qualquer coincidência com uma pessoa real é
 * possível (nomes comuns se repetem), mas não intencional nem baseada em
 * nenhum cadastro real.
 */

import { secureRandomChoice, secureRandomSample } from "@/lib/random/secure-random";

export const FIRST_NAMES_MALE = [
  "João", "Pedro", "Lucas", "Gabriel", "Matheus", "Rafael", "Gustavo", "Bruno",
  "Felipe", "Rodrigo", "Carlos", "Marcelo", "André", "Ricardo", "Eduardo",
  "Fernando", "Diego", "Thiago", "Leonardo", "Vinícius", "Daniel", "Paulo",
  "Marcos", "Fábio", "Alexandre", "Renato", "Sérgio", "Antônio", "José",
  "Francisco", "Henrique", "Caio", "Igor", "Murilo", "Samuel",
];

export const FIRST_NAMES_FEMALE = [
  "Maria", "Ana", "Juliana", "Fernanda", "Camila", "Amanda", "Bruna", "Larissa",
  "Patrícia", "Aline", "Beatriz", "Carla", "Débora", "Elaine", "Gabriela",
  "Isabela", "Jéssica", "Karina", "Letícia", "Mariana", "Natália", "Priscila",
  "Renata", "Sandra", "Tatiane", "Vanessa", "Viviane", "Cristina", "Daniela",
  "Eduarda", "Flávia", "Giovana", "Helena", "Luiza", "Rafaela", "Sofia",
];

export const LAST_NAMES = [
  "Silva", "Santos", "Oliveira", "Souza", "Rodrigues", "Ferreira", "Alves",
  "Pereira", "Lima", "Gomes", "Costa", "Ribeiro", "Martins", "Carvalho",
  "Almeida", "Lopes", "Soares", "Fernandes", "Vieira", "Barbosa", "Rocha",
  "Dias", "Monteiro", "Cardoso", "Reis", "Araújo", "Castro", "Andrade",
  "Nascimento", "Moreira", "Nunes", "Marques", "Machado", "Mendes", "Freitas",
  "Correia", "Cavalcanti", "Teixeira", "Pinto", "Barros",
];

export type NameGeneratorGender = "masculino" | "feminino" | "aleatorio";
export type NameGeneratorKind = "completo" | "primeiro-nome";

export const NAME_GENERATOR_MAX_BATCH = 100;

export interface NameGeneratorInput {
  count: number;
  gender: NameGeneratorGender;
  kind: NameGeneratorKind;
  /** Quantos sobrenomes incluir (1 ou 2), quando kind === "completo". */
  surnameCount: 1 | 2;
}

export interface NameGeneratorFieldErrors {
  count?: string;
}

function pickFirstName(gender: NameGeneratorGender): string {
  const resolvedGender = gender === "aleatorio" ? secureRandomChoice(["masculino", "feminino"] as const) : gender;
  const pool = resolvedGender === "masculino" ? FIRST_NAMES_MALE : FIRST_NAMES_FEMALE;
  return secureRandomChoice(pool);
}

/** Gera um único nome fictício (primeiro nome, ou nome completo com sobrenome(s)). */
export function generateName(input: Pick<NameGeneratorInput, "gender" | "kind" | "surnameCount">): string {
  const firstName = pickFirstName(input.gender);

  if (input.kind === "primeiro-nome") {
    return firstName;
  }

  const surnames = secureRandomSample(LAST_NAMES, input.surnameCount);
  return [firstName, ...surnames].join(" ");
}

export function validateNameGeneratorInput(input: NameGeneratorInput): NameGeneratorFieldErrors {
  const errors: NameGeneratorFieldErrors = {};

  if (!Number.isFinite(input.count) || !Number.isInteger(input.count) || input.count < 1) {
    errors.count = "Informe uma quantidade inteira de pelo menos 1.";
  } else if (input.count > NAME_GENERATOR_MAX_BATCH) {
    errors.count = `A quantidade não pode ser maior que ${NAME_GENERATOR_MAX_BATCH}.`;
  }

  return errors;
}

export function isNameGeneratorInputValid(input: NameGeneratorInput): boolean {
  return Object.keys(validateNameGeneratorInput(input)).length === 0;
}

/**
 * Gera um lote de nomes fictícios. O limite (NAME_GENERATOR_MAX_BATCH) é
 * aplicado ANTES de qualquer geração, então nunca é criado um array maior
 * que o limite, mesmo que a validação seja pulada por algum chamador.
 */
export function generateNameBatch(input: NameGeneratorInput): string[] {
  const safeCount = Math.min(Math.max(1, Math.trunc(input.count) || 1), NAME_GENERATOR_MAX_BATCH);

  return Array.from({ length: safeCount }, () => generateName(input));
}
