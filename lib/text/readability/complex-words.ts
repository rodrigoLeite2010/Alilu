import { COMMON_WORDS_PT } from "./common-words-pt";
import { countSyllablesPortuguese } from "./syllables-pt";
import { SUBSTITUTIONS_PT, stripAccents } from "./substitutions-pt";
import type { Token } from "./text-analyzer";

/**
 * Palavra complexa (sem IA): pouco frequente E de tamanho relevante.
 * Nunca é complexa: número, URL, e-mail, hashtag, menção, sigla ou nome
 * próprio detectável (maiúscula fora do início da frase). Palavras com
 * troca simples conhecida ("utilizar" → "usar") são sempre sinalizadas,
 * com a sugestão — mesmo que sejam comuns.
 */

export const COMPLEX_WORD_MIN_LETTERS = 7;
export const COMPLEX_WORD_MIN_SYLLABLES = 3;

/** Sufixos removidos para comparar por radical (plural, feminino, verbos, advérbios). Ordem: mais longos primeiro. */
const SUFFIXES = [
  "amente", "emente", "mente", "acoes", "icoes", "acao", "icao", "ariam", "eriam", "iriam", "assem", "essem", "issem",
  "ando", "endo", "indo", "aram", "eram", "iram", "avam", "aria", "eria", "iria", "asse", "esse", "isse", "ados", "adas",
  "idos", "idas", "ado", "ada", "ido", "ida", "ava", "oes", "aes", "ais", "eis", "ois", "ar", "er", "ir", "ou", "eu", "iu",
  "am", "em", "es", "os", "as", "o", "a", "e", "s",
];

export function wordKey(word: string): string {
  return stripAccents(word.toLowerCase());
}

export function stemPortuguese(word: string): string {
  const key = wordKey(word);
  for (const suffix of SUFFIXES) {
    if (key.endsWith(suffix) && key.length - suffix.length >= 4) return key.slice(0, -suffix.length);
  }
  return key;
}

let commonStems: Set<string> | null = null;
function getCommonStems(): Set<string> {
  // Cache em memória: monta uma vez por processo/aba.
  if (!commonStems) commonStems = new Set(COMMON_WORDS_PT.map(stemPortuguese));
  return commonStems;
}

export function isCommonWord(word: string): boolean {
  return getCommonStems().has(stemPortuguese(word));
}

let substitutionStems: Map<string, string> | null = null;
/** Troca simples pela forma exata ou pelo radical ("efetuem" → efetuar → "fazer"). */
export function substitutionFor(word: string): string | null {
  const exact = SUBSTITUTIONS_PT.get(wordKey(word));
  if (exact) return exact;
  if (!substitutionStems) substitutionStems = new Map([...SUBSTITUTIONS_PT].map(([from, to]) => [stemPortuguese(from), to]));
  return substitutionStems.get(stemPortuguese(word)) ?? null;
}

function looksLikeProperNoun(token: Token): boolean {
  const first = token.text.charAt(0);
  const isUpper = first !== first.toLowerCase() && first === first.toUpperCase();
  if (!isUpper) return false;
  // Sigla (tudo maiúsculo) ou maiúscula no meio da frase.
  if (token.text.length > 1 && token.text === token.text.toUpperCase()) return true;
  return !token.sentenceStart;
}

export interface ComplexWordResult {
  complex: boolean;
  suggestion: string | null;
}

export function evaluateWord(token: Token): ComplexWordResult {
  if (token.kind !== "word") return { complex: false, suggestion: null };
  if (looksLikeProperNoun(token)) return { complex: false, suggestion: null };
  const suggestion = substitutionFor(token.text);
  if (suggestion) return { complex: true, suggestion };
  const letters = token.text.replace(/[^\p{L}]/gu, "");
  if (letters.length < COMPLEX_WORD_MIN_LETTERS) return { complex: false, suggestion: null };
  if (countSyllablesPortuguese(letters) < COMPLEX_WORD_MIN_SYLLABLES) return { complex: false, suggestion: null };
  if (token.text.includes("-")) {
    // Composta ("segunda-feira"): complexa só se alguma parte for.
    const parts = token.text.split("-").filter(Boolean);
    const complexPart = parts.some((part) => part.length >= COMPLEX_WORD_MIN_LETTERS && !isCommonWord(part));
    return { complex: complexPart, suggestion: null };
  }
  return { complex: !isCommonWord(token.text), suggestion: null };
}
