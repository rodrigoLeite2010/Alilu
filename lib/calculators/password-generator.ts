/**
 * Geração de senhas aleatórias fortes (categoria Geradores). Mantido
 * isolado da interface (PROMPT MESTRE, seção 14).
 *
 * Toda a geração acontece localmente, com `crypto.getRandomValues` (ver
 * lib/random/secure-random.ts) — nenhuma senha gerada é enviada,
 * armazenada ou registrada em log pela Alilu.
 *
 * Quando mais de um conjunto de caracteres é selecionado, a senha garante
 * pelo menos 1 caractere de cada conjunto escolhido (prática comum exigida
 * por muitos formulários de cadastro), preenche o restante sorteando do
 * conjunto combinado e embaralha o resultado com amostragem sem reposição
 * (`secureRandomSample`), para não deixar os caracteres "garantidos" sempre
 * nas mesmas posições.
 */

import { secureRandomChar, secureRandomSample } from "@/lib/random/secure-random";

export const PASSWORD_MIN_LENGTH = 4;
export const PASSWORD_MAX_LENGTH = 64;

export const LOWERCASE_CHARSET = "abcdefghijklmnopqrstuvwxyz";
export const UPPERCASE_CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
export const NUMBERS_CHARSET = "0123456789";
// Sem caracteres ambíguos de digitar/ler (ex.: espaço) e sem aspas, que
// quebram cópia/colagem em alguns formulários.
export const SYMBOLS_CHARSET = "!@#$%^&*()-_=+[]{}<>?";

export interface PasswordGeneratorInput {
  length: number;
  includeUppercase: boolean;
  includeLowercase: boolean;
  includeNumbers: boolean;
  includeSymbols: boolean;
}

export interface PasswordGeneratorFieldErrors {
  length?: string;
  charset?: string;
}

export type PasswordStrength = "fraca" | "media" | "forte" | "muito-forte";

export function validatePasswordGeneratorInput(
  input: PasswordGeneratorInput
): PasswordGeneratorFieldErrors {
  const errors: PasswordGeneratorFieldErrors = {};

  if (
    !Number.isFinite(input.length) ||
    !Number.isInteger(input.length) ||
    input.length < PASSWORD_MIN_LENGTH ||
    input.length > PASSWORD_MAX_LENGTH
  ) {
    errors.length = `Informe um tamanho entre ${PASSWORD_MIN_LENGTH} e ${PASSWORD_MAX_LENGTH}.`;
  }

  if (
    !input.includeUppercase &&
    !input.includeLowercase &&
    !input.includeNumbers &&
    !input.includeSymbols
  ) {
    errors.charset = "Selecione ao menos um tipo de caractere.";
  }

  return errors;
}

export function isPasswordGeneratorInputValid(input: PasswordGeneratorInput): boolean {
  return Object.keys(validatePasswordGeneratorInput(input)).length === 0;
}

/** Gera uma senha aleatória a partir das opções informadas. */
export function generatePassword(input: PasswordGeneratorInput): string {
  const selectedCharsets: string[] = [];
  if (input.includeUppercase) selectedCharsets.push(UPPERCASE_CHARSET);
  if (input.includeLowercase) selectedCharsets.push(LOWERCASE_CHARSET);
  if (input.includeNumbers) selectedCharsets.push(NUMBERS_CHARSET);
  if (input.includeSymbols) selectedCharsets.push(SYMBOLS_CHARSET);

  if (selectedCharsets.length === 0) {
    throw new Error("Selecione ao menos um tipo de caractere.");
  }

  const length = Math.min(
    Math.max(PASSWORD_MIN_LENGTH, Math.trunc(input.length) || PASSWORD_MIN_LENGTH),
    PASSWORD_MAX_LENGTH
  );
  const combinedCharset = selectedCharsets.join("");

  // Garante 1 caractere de cada conjunto selecionado (até o tamanho pedido).
  const guaranteed = selectedCharsets
    .slice(0, length)
    .map((charset) => secureRandomChar(charset));

  const remainingLength = length - guaranteed.length;
  const filler = Array.from({ length: remainingLength }, () => secureRandomChar(combinedCharset));

  const allChars = [...guaranteed, ...filler];
  // Embaralha sem reposição para não deixar os caracteres "garantidos"
  // sempre nas primeiras posições.
  return secureRandomSample(allChars, allChars.length).join("");
}

/**
 * Estima a força da senha por uma heurística simples de entropia
 * (tamanho × log2 do tamanho do alfabeto disponível), em bits. Não é uma
 * análise de dicionário/padrões — apenas um indicador visual rápido.
 */
export function estimatePasswordStrength(input: PasswordGeneratorInput): {
  strength: PasswordStrength;
  entropyBits: number;
} {
  let alphabetSize = 0;
  if (input.includeUppercase) alphabetSize += UPPERCASE_CHARSET.length;
  if (input.includeLowercase) alphabetSize += LOWERCASE_CHARSET.length;
  if (input.includeNumbers) alphabetSize += NUMBERS_CHARSET.length;
  if (input.includeSymbols) alphabetSize += SYMBOLS_CHARSET.length;

  if (alphabetSize === 0 || input.length <= 0) {
    return { strength: "fraca", entropyBits: 0 };
  }

  const entropyBits = Math.round(input.length * Math.log2(alphabetSize));

  let strength: PasswordStrength = "fraca";
  if (entropyBits >= 80) strength = "muito-forte";
  else if (entropyBits >= 60) strength = "forte";
  else if (entropyBits >= 40) strength = "media";

  return { strength, entropyBits };
}

export const PASSWORD_STRENGTH_LABELS: Record<PasswordStrength, string> = {
  fraca: "Fraca",
  media: "Média",
  forte: "Forte",
  "muito-forte": "Muito forte",
};
