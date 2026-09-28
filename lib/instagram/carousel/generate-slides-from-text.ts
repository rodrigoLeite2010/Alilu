/**
 * Núcleo do "Carrossel automático" (PROMPT — Fase 2, ETAPA 8): recebe o
 * texto colado inteiro e devolve os pedaços (um por slide) que cabem
 * visualmente, na ordem, sem perder nem duplicar nenhuma palavra —
 * ver generateSlidesFromText.test.ts para as garantias testadas.
 *
 * Estratégia de quebra, na ordem de prioridade pedida:
 *   1. Entre parágrafos (linha em branco no texto colado).
 *   2. Entre frases (., !, ?, … seguidos de espaço).
 *   3. Entre palavras — só quando nem uma frase inteira cabe sozinha.
 *
 * O empacotamento é guloso (greedy) e recursivo: tenta encaixar cada
 * unidade (parágrafo/frase/palavra) no slide atual; se não couber,
 * fecha o slide atual e tenta a unidade sozinha num slide novo; se nem
 * sozinha ela couber, quebra essa unidade em unidades menores (parágrafo
 * → frases → palavras) e continua a partir daí. Como o conteúdo que
 * "sobra" de uma quebra sempre continua tentando ser preenchido pelo
 * próximo parágrafo (em vez de sempre fechar o slide), a maior parte dos
 * slides já sai naturalmente bem preenchida — sem precisar de uma
 * segunda passagem de "rebalanceamento".
 */

import { fitTextBlock, type TextBlockBox, type TextMeasurer } from "./text-fit";

/** Quebra o texto colado em parágrafos — uma ou mais linhas em branco separam parágrafos; espaços nas pontas de cada parágrafo são removidos. */
export function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n+/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

/** Quebra um parágrafo em frases — manter simples de propósito (não é um tokenizador de linguagem natural): corta depois de ./!/?/… seguido de espaço. */
export function splitIntoSentences(paragraph: string): string[] {
  const sentences = paragraph
    .split(/(?<=[.!?…])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
  return sentences.length > 0 ? sentences : [paragraph.trim()].filter(Boolean);
}

function splitIntoWords(sentence: string): string[] {
  const words = sentence.split(/\s+/).filter(Boolean);
  return words.length > 0 ? words : [sentence];
}

/**
 * Quebra uma unidade que não coube sozinha num slide em unidades menores
 * já prontas para (re)empacotar — parágrafo vira frases, frase vira
 * palavras. Uma palavra sozinha é sempre aceita como está (mesmo que,
 * em teoria, ainda "não caiba" verticalmente — na prática isso nunca
 * acontece com uma única linha de texto — para sempre garantir que a
 * recursão termina).
 */
function breakDownUnit(unit: string, level: "paragraph" | "sentence"): { units: string[]; joiner: string } {
  if (level === "paragraph") {
    return { units: splitIntoSentences(unit), joiner: " " };
  }
  return { units: splitIntoWords(unit), joiner: " " };
}

/**
 * Empacota uma lista de unidades (parágrafos, ou frases dentro de um
 * parágrafo) em slides, gulosamente: cresce o slide atual enquanto o
 * resultado ainda cabe; quando uma unidade não cabe mais, fecha o slide
 * atual e recomeça com essa unidade — quebrando-a em unidades menores se
 * nem sozinha ela couber.
 */
function packUnits(
  ctx: TextMeasurer,
  box: TextBlockBox,
  units: string[],
  joiner: string,
  level: "paragraph" | "sentence" | "word"
): string[] {
  const slides: string[] = [];
  let current: string[] = [];

  for (const unit of units) {
    const attempt = [...current, unit];
    if (fitTextBlock(ctx, attempt.join(joiner), box).fits) {
      current = attempt;
      continue;
    }

    if (current.length > 0) {
      slides.push(current.join(joiner));
      current = [];
    }

    if (level === "word") {
      // Uma única palavra: sempre aceita, para garantir que a recursão termina
      // (na prática uma palavra isolada nunca deixa de caber verticalmente).
      current = [unit];
      continue;
    }

    if (fitTextBlock(ctx, unit, box).fits) {
      current = [unit];
      continue;
    }

    // Nem sozinha a unidade coube: quebra em unidades menores e empacota
    // recursivamente — o resultado dessa quebra vira os próximos slides,
    // exceto o último pedaço, que continua tentando ser preenchido pelo
    // que vier a seguir (evita slides "órfãos" com uma linha só).
    const nextLevel = level === "paragraph" ? "sentence" : "word";
    const { units: smallerUnits, joiner: smallerJoiner } = breakDownUnit(unit, level === "paragraph" ? "paragraph" : "sentence");
    const subSlides = packUnits(ctx, box, smallerUnits, smallerJoiner, nextLevel);
    slides.push(...subSlides.slice(0, -1));
    current = subSlides.length > 0 ? [subSlides[subSlides.length - 1]] : [];
  }

  if (current.length > 0) slides.push(current.join(joiner));
  return slides;
}

export interface GenerateSlidesResult {
  /** Um pedaço de texto por slide, na ordem — nunca mais que `maxSlides`. */
  slides: string[];
  /**
   * Texto que sobrou sem virar slide porque `maxSlides` foi atingido —
   * `null` quando tudo coube. Nunca descartado silenciosamente (PROMPT:
   * "Não simplesmente cortar e perder o texto") — quem chama decide o
   * que fazer (reduzir o texto, ou usar isso para começar outro
   * carrossel).
   */
  overflowText: string | null;
}

/**
 * Ponto de entrada: divide `text` em pedaços que cabem em `box`, na
 * ordem, respeitando o limite de `maxSlides` slides.
 */
export function generateSlidesFromText(
  ctx: TextMeasurer,
  text: string,
  box: TextBlockBox,
  maxSlides: number
): GenerateSlidesResult {
  const paragraphs = splitIntoParagraphs(text);
  if (paragraphs.length === 0) return { slides: [], overflowText: null };

  const allSlides = packUnits(ctx, box, paragraphs, "\n\n", "paragraph");

  if (allSlides.length <= maxSlides) {
    return { slides: allSlides, overflowText: null };
  }

  const overflowText = allSlides.slice(maxSlides).join("\n\n");
  return { slides: allSlides.slice(0, maxSlides), overflowText };
}

/** Concatena os pedaços de volta, normalizando espaços — usado pelos testes de "nenhuma perda/duplicação de texto" para comparar com o texto original. */
export function normalizeForComparison(text: string): string {
  return text.split(/\s+/).filter(Boolean).join(" ");
}
