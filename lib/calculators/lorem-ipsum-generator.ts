/**
 * Geração de texto "Lorem Ipsum" para preencher protótipos e layouts
 * (categoria Geradores). Mantido isolado da interface (PROMPT MESTRE,
 * seção 14).
 *
 * As palavras são sorteadas de um banco de palavras do latim clássico
 * (o texto Lorem Ipsum tradicional) com `crypto.getRandomValues` (ver
 * lib/random/secure-random.ts), nunca com `Math.random`.
 */

import { secureRandomChoice, secureRandomIntRange } from "@/lib/random/secure-random";

export const LOREM_WORDS = [
  "lorem", "ipsum", "dolor", "sit", "amet", "consectetur", "adipiscing",
  "elit", "sed", "do", "eiusmod", "tempor", "incididunt", "ut", "labore",
  "et", "dolore", "magna", "aliqua", "enim", "ad", "minim", "veniam",
  "quis", "nostrud", "exercitation", "ullamco", "laboris", "nisi",
  "aliquip", "ex", "ea", "commodo", "consequat", "duis", "aute", "irure",
  "in", "reprehenderit", "voluptate", "velit", "esse", "cillum", "fugiat",
  "nulla", "pariatur", "excepteur", "sint", "occaecat", "cupidatat",
  "non", "proident", "sunt", "culpa", "qui", "officia", "deserunt",
  "mollit", "anim", "id", "est", "laborum",
];

export const LOREM_IPSUM_MAX_COUNT = 50;

export type LoremIpsumUnit = "palavras" | "frases" | "paragrafos";

export interface LoremIpsumGeneratorInput {
  unit: LoremIpsumUnit;
  count: number;
  startWithLorem: boolean;
}

export interface LoremIpsumGeneratorFieldErrors {
  count?: string;
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function generateWords(count: number): string[] {
  return Array.from({ length: count }, () => secureRandomChoice(LOREM_WORDS));
}

/** Gera uma única frase (primeira letra maiúscula, ponto final). */
function generateSentence(): string {
  const wordCount = secureRandomIntRange(6, 14);
  const words = generateWords(wordCount);
  return `${capitalize(words[0])} ${words.slice(1).join(" ")}.`;
}

/** Gera um único parágrafo (3 a 6 frases). */
function generateParagraph(): string {
  const sentenceCount = secureRandomIntRange(3, 6);
  return Array.from({ length: sentenceCount }, () => generateSentence()).join(" ");
}

export function validateLoremIpsumGeneratorInput(
  input: LoremIpsumGeneratorInput
): LoremIpsumGeneratorFieldErrors {
  const errors: LoremIpsumGeneratorFieldErrors = {};

  if (!Number.isFinite(input.count) || !Number.isInteger(input.count) || input.count < 1) {
    errors.count = "Informe uma quantidade inteira de pelo menos 1.";
  } else if (input.count > LOREM_IPSUM_MAX_COUNT) {
    errors.count = `A quantidade não pode ser maior que ${LOREM_IPSUM_MAX_COUNT}.`;
  }

  return errors;
}

export function isLoremIpsumGeneratorInputValid(input: LoremIpsumGeneratorInput): boolean {
  return Object.keys(validateLoremIpsumGeneratorInput(input)).length === 0;
}

/**
 * Gera o texto Lorem Ipsum pedido. O limite (LOREM_IPSUM_MAX_COUNT) é
 * aplicado ANTES de qualquer geração, então nunca é gerada uma quantidade
 * maior que o limite, mesmo que a validação seja pulada por algum
 * chamador.
 */
export function generateLoremIpsum(input: LoremIpsumGeneratorInput): string {
  const safeCount = Math.min(Math.max(1, Math.trunc(input.count) || 1), LOREM_IPSUM_MAX_COUNT);

  let result: string;

  if (input.unit === "palavras") {
    const words = generateWords(safeCount);
    if (input.startWithLorem) {
      words[0] = "lorem";
      if (safeCount > 1) words[1] = "ipsum";
    }
    result = `${capitalize(words[0])} ${words.slice(1).join(" ")}`;
  } else if (input.unit === "frases") {
    const sentences = Array.from({ length: safeCount }, () => generateSentence());
    if (input.startWithLorem) {
      sentences[0] = `Lorem ipsum dolor sit amet, consectetur adipiscing elit.`;
    }
    result = sentences.join(" ");
  } else {
    const paragraphs = Array.from({ length: safeCount }, () => generateParagraph());
    if (input.startWithLorem) {
      paragraphs[0] = `Lorem ipsum dolor sit amet, consectetur adipiscing elit. ${paragraphs[0]}`;
    }
    result = paragraphs.join("\n\n");
  }

  return result;
}
