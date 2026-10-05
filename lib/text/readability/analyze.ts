import { evaluateWord } from "./complex-words";
import { calculateIndexes, type ReadabilityIndexes } from "./readability-calculator";
import {
  LEVEL_LABEL,
  aliluScore,
  interpretFlesch,
  interpretGrade,
  interpretGulpease,
  levelForScore,
  type ReadabilityLevel,
} from "./score";
import { countSyllablesPortuguese } from "./syllables-pt";
import { countLetters, countParagraphs, normalizeText, splitSentences, tokenize } from "./text-analyzer";

/**
 * Análise de legibilidade completa — determinística, sem IA, sem rede.
 * Roda igual no navegador e no servidor (POST /api/readability/analyze).
 */

export const READABILITY_MAX_CHARACTERS = 20_000;

/** Faixas de tamanho de frase (palavras) — regra única usada na tela e nas sugestões. */
export const SENTENCE_LENGTH_BANDS = { good: 15, attention: 25, long: 35 } as const;
export type SentenceBand = "BOA" | "ATENCAO" | "LONGA" | "MUITO_LONGA";

export function sentenceBand(words: number): SentenceBand {
  if (words <= SENTENCE_LENGTH_BANDS.good) return "BOA";
  if (words <= SENTENCE_LENGTH_BANDS.attention) return "ATENCAO";
  if (words <= SENTENCE_LENGTH_BANDS.long) return "LONGA";
  return "MUITO_LONGA";
}

export interface AnalyzedSentence {
  start: number;
  end: number;
  words: number;
  band: SentenceBand;
}

export interface ComplexWordHit {
  start: number;
  end: number;
  word: string;
  suggestion: string | null;
}

export interface IndexReport {
  key: keyof ReadabilityIndexes;
  label: string;
  value: number;
  explanation: string;
  interpretation: string;
}

export interface ReadabilityResult {
  characters: number;
  charactersNoSpaces: number;
  words: number;
  sentences: number;
  paragraphs: number;
  letters: number;
  syllables: number;
  averageWordsPerSentence: number;
  averageSyllablesPerWord: number;
  averageCharactersPerWord: number;
  complexWords: number;
  complexWordsPercent: number;
  longSentences: number;
  veryLongSentences: number;
  longestSentenceWords: number;
  /** null quando o texto não tem palavra/frase suficiente. */
  score: number | null;
  level: ReadabilityLevel | null;
  levelLabel: string | null;
  indexes: ReadabilityIndexes | null;
  indexReports: IndexReport[];
  sentenceSpans: AnalyzedSentence[];
  complexWordHits: ComplexWordHit[];
  summary: string;
  suggestions: string[];
}

const round = (value: number, digits = 1) => Math.round(value * 10 ** digits) / 10 ** digits;

function buildIndexReports(indexes: ReadabilityIndexes): IndexReport[] {
  return [
    { key: "flesch", label: "Flesch (português)", value: indexes.flesch, explanation: "Mede a facilidade pelo tamanho das frases e das palavras. Quanto maior, mais fácil (0 a 100).", interpretation: interpretFlesch(indexes.flesch) },
    { key: "gulpease", label: "Gulpease", value: indexes.gulpease, explanation: "Usa letras e frases, sem contar sílabas. Quanto maior, mais fácil (0 a 100).", interpretation: interpretGulpease(indexes.gulpease) },
    { key: "fleschKincaid", label: "Flesch-Kincaid", value: indexes.fleschKincaid, explanation: "Estima os anos de estudo necessários. Quanto menor, mais fácil.", interpretation: interpretGrade(indexes.fleschKincaid) },
    { key: "gunningFog", label: "Gunning Fog", value: indexes.gunningFog, explanation: "Considera frases longas e palavras pouco comuns. Quanto menor, mais fácil.", interpretation: interpretGrade(indexes.gunningFog) },
    { key: "ari", label: "ARI", value: indexes.ari, explanation: "Usa caracteres por palavra e palavras por frase. Quanto menor, mais fácil.", interpretation: interpretGrade(indexes.ari) },
    { key: "colemanLiau", label: "Coleman-Liau", value: indexes.colemanLiau, explanation: "Usa letras e frases a cada 100 palavras. Quanto menor, mais fácil.", interpretation: interpretGrade(indexes.colemanLiau) },
  ];
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

export function buildSuggestions(result: Pick<ReadabilityResult, "longSentences" | "veryLongSentences" | "complexWords" | "averageWordsPerSentence" | "complexWordHits" | "words" | "sentences">): string[] {
  const suggestions: string[] = [];
  if (result.longSentences > 0) {
    suggestions.push(`Encurte ${plural(result.longSentences, "frase longa", "frases longas")} (mais de ${SENTENCE_LENGTH_BANDS.attention} palavras). Divida em duas ou tire o que não é essencial.`);
  }
  const withSuggestion = result.complexWordHits.filter((hit) => hit.suggestion).length;
  if (withSuggestion > 0) suggestions.push(`Troque ${plural(withSuggestion, "palavra", "palavras")} por termos mais simples (veja as sugestões ao tocar na palavra destacada).`);
  if (result.complexWords - withSuggestion > 0) {
    suggestions.push(`Revise ${plural(result.complexWords - withSuggestion, "palavra pouco comum", "palavras pouco comuns")}: use termos do dia a dia quando possível.`);
  }
  if (result.averageWordsPerSentence > SENTENCE_LENGTH_BANDS.good) {
    suggestions.push(`Reduza a média de palavras por frase (hoje ${result.averageWordsPerSentence}). O ideal é até ${SENTENCE_LENGTH_BANDS.good}.`);
  }
  if (result.veryLongSentences > 0) suggestions.push("Evite explicações muito longas numa frase só: uma ideia por frase.");
  if (suggestions.length === 0 && result.words > 0) suggestions.push("Seu texto já está claro. Mantenha frases curtas e palavras do dia a dia.");
  return suggestions;
}

function buildSummary(level: ReadabilityLevel | null, longSentences: number, complexWords: number): string {
  if (!level) return "Digite um texto com pelo menos uma frase completa para analisar.";
  const base: Record<ReadabilityLevel, string> = {
    MUITO_FACIL: "Seu texto está muito fácil de entender.",
    FACIL: "Seu texto está fácil de entender.",
    MODERADO: "Seu texto é razoável, mas pode ficar mais simples.",
    DIFICIL: "Seu texto está difícil para boa parte dos leitores.",
    MUITO_DIFICIL: "Seu texto está muito difícil de entender.",
  };
  const parts = [base[level]];
  if (longSentences > 0) parts.push(`Há ${plural(longSentences, "frase que pode", "frases que podem")} ser encurtada${longSentences === 1 ? "" : "s"}.`);
  if (complexWords > 0) parts.push("Algumas palavras podem ser substituídas por termos mais simples.");
  return parts.join(" ");
}

export function analyzeReadability(input: string): ReadabilityResult {
  const text = normalizeText(input);
  const sentenceSpans = splitSentences(text);
  const tokens = tokenize(text, sentenceSpans);
  // URL e e-mail não contam como palavra para a legibilidade.
  const counted = tokens.filter((token) => token.kind !== "url" && token.kind !== "email");

  let syllables = 0;
  let letters = 0;
  let characters = 0;
  const complexWordHits: ComplexWordHit[] = [];
  const wordsPerSentence = new Array<number>(sentenceSpans.length).fill(0);
  for (const token of counted) {
    wordsPerSentence[token.sentenceIndex] += 1;
    const tokenLetters = countLetters(token.text);
    letters += tokenLetters;
    characters += (token.text.match(/[\p{L}\p{N}]/gu) ?? []).length;
    syllables += token.kind === "number" ? 2 : countSyllablesPortuguese(token.text);
    const evaluation = evaluateWord(token);
    if (evaluation.complex) complexWordHits.push({ start: token.start, end: token.end, word: token.text, suggestion: evaluation.suggestion });
  }

  const sentences: AnalyzedSentence[] = sentenceSpans
    .map((span, index) => ({ start: span.start, end: span.end, words: wordsPerSentence[index], band: sentenceBand(wordsPerSentence[index]) }))
    .filter((sentence) => sentence.words > 0);
  const words = counted.length;
  const sentenceCount = sentences.length;
  const longSentences = sentences.filter((s) => s.band === "LONGA" || s.band === "MUITO_LONGA").length;
  const veryLongSentences = sentences.filter((s) => s.band === "MUITO_LONGA").length;
  const indexes = calculateIndexes({ words, sentences: sentenceCount, syllables, letters, characters, complexWords: complexWordHits.length });
  const score = indexes ? aliluScore(indexes) : null;
  const level = score === null ? null : levelForScore(score);
  const averageWordsPerSentence = sentenceCount ? round(words / sentenceCount) : 0;

  const partial = {
    words,
    sentences: sentenceCount,
    longSentences,
    veryLongSentences,
    complexWords: complexWordHits.length,
    averageWordsPerSentence,
    complexWordHits,
  };
  return {
    characters: text.length,
    charactersNoSpaces: text.replace(/\s/g, "").length,
    words,
    sentences: sentenceCount,
    paragraphs: countParagraphs(text),
    letters,
    syllables,
    averageWordsPerSentence,
    averageSyllablesPerWord: words ? round(syllables / words, 2) : 0,
    averageCharactersPerWord: words ? round(characters / words, 2) : 0,
    complexWords: complexWordHits.length,
    complexWordsPercent: words ? round((complexWordHits.length / words) * 100) : 0,
    longSentences,
    veryLongSentences,
    longestSentenceWords: sentences.reduce((max, s) => Math.max(max, s.words), 0),
    score,
    level,
    levelLabel: level ? LEVEL_LABEL[level] : null,
    indexes,
    indexReports: indexes ? buildIndexReports(indexes) : [],
    sentenceSpans: sentences,
    complexWordHits,
    summary: buildSummary(level, longSentences, complexWordHits.length),
    suggestions: words ? buildSuggestions(partial) : [],
  };
}
