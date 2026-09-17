/**
 * Geração de apelidos/nicknames FICTÍCIOS para jogos, redes sociais e
 * testes de cadastro (categoria Geradores). Mantido isolado da interface
 * (PROMPT MESTRE, seção 14).
 *
 * Combina uma palavra de uma lista de adjetivos com uma palavra de uma
 * lista de substantivos, com número opcional — não consulta nenhuma base
 * real de usuários e não garante que o nick esteja disponível em nenhuma
 * plataforma.
 */

import { secureRandomChoice, secureRandomIntRange } from "@/lib/random/secure-random";

export const NICKNAME_GENERATOR_MAX_BATCH = 100;

export const NICKNAME_ADJECTIVES = [
  "Dark", "Silent", "Fire", "Shadow", "Ghost", "Mystic", "Turbo", "Alpha",
  "Neo", "Cyber", "Frost", "Crimson", "Iron", "Golden", "Silver", "Wild",
  "Swift", "Savage", "Royal", "Toxic",
];

export const NICKNAME_NOUNS = [
  "Wolf", "Dragon", "Phoenix", "Ninja", "Hunter", "Falcon", "Viper",
  "Storm", "Knight", "Reaper", "Tiger", "Raven", "Titan", "Blade",
  "Fox", "Hawk", "Panther", "Warrior", "Samurai", "Spirit",
];

export type NicknameSeparator = "nenhum" | "underline" | "ponto";

export interface NicknameGeneratorInput {
  count: number;
  separator: NicknameSeparator;
  includeNumber: boolean;
}

export interface NicknameGeneratorFieldErrors {
  count?: string;
}

function joinParts(parts: string[], separator: NicknameSeparator): string {
  if (separator === "underline") return parts.join("_");
  if (separator === "ponto") return parts.join(".");
  return parts.join("");
}

/** Gera um único nickname fictício. */
export function generateNickname(input: Pick<NicknameGeneratorInput, "separator" | "includeNumber">): string {
  const adjective = secureRandomChoice(NICKNAME_ADJECTIVES);
  const noun = secureRandomChoice(NICKNAME_NOUNS);
  const parts = [adjective, noun];

  if (input.includeNumber) {
    parts.push(String(secureRandomIntRange(1, 999)));
  }

  return joinParts(parts, input.separator);
}

export function validateNicknameGeneratorInput(input: NicknameGeneratorInput): NicknameGeneratorFieldErrors {
  const errors: NicknameGeneratorFieldErrors = {};

  if (!Number.isFinite(input.count) || !Number.isInteger(input.count) || input.count < 1) {
    errors.count = "Informe uma quantidade inteira de pelo menos 1.";
  } else if (input.count > NICKNAME_GENERATOR_MAX_BATCH) {
    errors.count = `A quantidade não pode ser maior que ${NICKNAME_GENERATOR_MAX_BATCH}.`;
  }

  return errors;
}

export function isNicknameGeneratorInputValid(input: NicknameGeneratorInput): boolean {
  return Object.keys(validateNicknameGeneratorInput(input)).length === 0;
}

/**
 * Gera um lote de nicknames fictícios. O limite (NICKNAME_GENERATOR_MAX_BATCH)
 * é aplicado ANTES de qualquer geração, então nunca é criado um array maior
 * que o limite, mesmo que a validação seja pulada por algum chamador.
 */
export function generateNicknameBatch(input: NicknameGeneratorInput): string[] {
  const safeCount = Math.min(Math.max(1, Math.trunc(input.count) || 1), NICKNAME_GENERATOR_MAX_BATCH);

  return Array.from({ length: safeCount }, () => generateNickname(input));
}
