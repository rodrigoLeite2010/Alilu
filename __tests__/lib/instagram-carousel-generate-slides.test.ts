import { describe, expect, it } from "vitest";
import {
  generateSlidesFromText,
  normalizeForComparison,
  splitIntoParagraphs,
  splitIntoSentences,
} from "@/lib/instagram/carousel/generate-slides-from-text";
import type { TextBlockBox, TextMeasurer } from "@/lib/instagram/carousel/text-fit";

/** Mesmo medidor determinístico de instagram-carousel-text-fit.test.ts — a largura escala com o tamanho de fonte atual. */
function createFakeMeasurer(charWidthFactor = 0.6): TextMeasurer {
  let fontSizePx = 16;
  return {
    get font() {
      return `${fontSizePx}px fake`;
    },
    set font(value: string) {
      const match = /(\d+(?:\.\d+)?)px/.exec(value);
      if (match) fontSizePx = parseFloat(match[1]);
    },
    measureText(text: string) {
      return { width: text.length * fontSizePx * charWidthFactor };
    },
  } as TextMeasurer;
}

/** Bloco pequeno de propósito (≈25 caracteres por linha, poucas linhas) — força a divisão em vários slides com textos curtos, o que deixa os testes rápidos e fáceis de verificar. */
const SMALL_BOX: TextBlockBox = {
  maxWidthPx: 300,
  maxBlockHeightPx: 100,
  fontFamily: "fake",
  bold: false,
  preferredFontSizePx: 20,
  minFontSizePx: 10,
  lineHeight: 1,
};

function generate(text: string, box: TextBlockBox = SMALL_BOX, maxSlides = 20) {
  return generateSlidesFromText(createFakeMeasurer(), text, box, maxSlides);
}

/** Junta de volta o resultado (slides + o que sobrou, se houver) para comparar com o texto original. */
function rejoin(result: ReturnType<typeof generate>): string {
  return [...result.slides, result.overflowText ?? ""].filter(Boolean).join(" ");
}

describe("generateSlidesFromText", () => {
  it("1. texto pequeno vira um único slide", () => {
    const result = generate("Um dia de cada vez.");
    expect(result.slides).toHaveLength(1);
    expect(result.slides[0]).toBe("Um dia de cada vez.");
    expect(result.overflowText).toBeNull();
  });

  it("2. texto com muitos parágrafos gera vários slides, sem perder nenhum parágrafo", () => {
    const paragraphs = Array.from({ length: 8 }, (_, i) => `Parágrafo número ${i} com um pouco mais de conteúdo dentro dele.`);
    const text = paragraphs.join("\n\n");
    const result = generate(text);
    expect(result.slides.length).toBeGreaterThan(1);
    expect(normalizeForComparison(rejoin(result))).toBe(normalizeForComparison(text));
  });

  it("3. texto muito longo gera vários slides sem perder conteúdo", () => {
    const text = Array.from({ length: 40 }, (_, i) => `Frase número ${i} do texto bem longo que estamos testando aqui.`).join(" ");
    const result = generate(text);
    expect(result.slides.length).toBeGreaterThan(3);
    expect(normalizeForComparison(rejoin(result))).toBe(normalizeForComparison(text));
  });

  it("4. frase extremamente longa (sem pontuação) quebra por palavra e preserva todo o conteúdo", () => {
    const text = Array.from({ length: 60 }, (_, i) => `palavra${i}`).join(" ");
    const result = generate(text);
    expect(result.slides.length).toBeGreaterThan(1);
    expect(normalizeForComparison(rejoin(result))).toBe(normalizeForComparison(text));
    // Nenhuma linha ficou maior que a caixa permitia (não há corte no meio de uma palavra).
    for (const slide of result.slides) {
      expect(slide.split(" ").every((word) => word.startsWith("palavra"))).toBe(true);
    }
  });

  it("5. texto sem nenhuma quebra de parágrafo ainda assim é dividido corretamente", () => {
    const text = Array.from(
      { length: 12 },
      (_, i) => `Frase número ${i} bem completa dentro de um único parágrafo enorme sem nenhuma linha em branco.`
    ).join(" ");
    expect(splitIntoParagraphs(text)).toHaveLength(1);
    const result = generate(text);
    expect(result.slides.length).toBeGreaterThan(1);
    expect(normalizeForComparison(rejoin(result))).toBe(normalizeForComparison(text));
  });

  it("6. preserva emojis", () => {
    const text = "Bom dia! 🌞☕️\n\nVamos com tudo hoje 🚀💪, sem desculpas.";
    const result = generate(text);
    expect(normalizeForComparison(rejoin(result))).toBe(normalizeForComparison(text));
    expect(result.slides.join(" ")).toContain("🌞☕️");
    expect(result.slides.join(" ")).toContain("🚀💪");
  });

  it("7. preserva acentuação", () => {
    const text = "Não é sempre fácil, mas é possível.\n\nAção, atenção e organização todos os dias — é assim que a mudança acontece.";
    const result = generate(text);
    expect(normalizeForComparison(rejoin(result))).toBe(normalizeForComparison(text));
    expect(result.slides.join(" ")).toContain("Não é sempre fácil");
    expect(result.slides.join(" ")).toContain("Ação, atenção e organização");
  });

  it("8. quebra dupla de linha separa parágrafos em slides diferentes quando não cabem juntos", () => {
    const paragraphOne = Array.from(
      { length: 6 },
      (_, i) => `Frase ${i} do primeiro parágrafo, com bastante conteúdo para ocupar praticamente todo o espaço disponível.`
    ).join(" ");
    const paragraphTwo = Array.from(
      { length: 6 },
      (_, i) => `Frase ${i} do segundo parágrafo, também com bastante conteúdo, que não deve caber junto do primeiro.`
    ).join(" ");
    const text = `${paragraphOne}\n\n${paragraphTwo}`;
    const result = generate(text);
    expect(result.slides.length).toBeGreaterThanOrEqual(2);
    expect(normalizeForComparison(rejoin(result))).toBe(normalizeForComparison(text));
  });

  it("9. prioriza a quebra entre parágrafos: dois parágrafos curtos que cabem juntos ficam no mesmo slide", () => {
    const text = "Parágrafo curto um.\n\nParágrafo curto dois.";
    const result = generate(text);
    expect(result.slides).toHaveLength(1);
    expect(result.slides[0]).toBe("Parágrafo curto um.\n\nParágrafo curto dois.");
  });

  it("10. regenerar o mesmo texto produz exatamente o mesmo resultado (determinístico)", () => {
    const text = Array.from({ length: 12 }, (_, i) => `Parágrafo ${i}, com um pouco de texto cada um.`).join("\n\n");
    const first = generate(text);
    const second = generate(text);
    expect(second.slides).toEqual(first.slides);
  });

  it("11. nenhuma perda de texto, em todos os cenários acima combinados", () => {
    const fixtures = [
      "Texto único bem curto.",
      Array.from({ length: 15 }, (_, i) => `Parágrafo ${i} de teste.`).join("\n\n"),
      Array.from({ length: 25 }, (_, i) => `palavra-${i}`).join(" "),
    ];
    for (const text of fixtures) {
      const result = generate(text);
      expect(normalizeForComparison(rejoin(result))).toBe(normalizeForComparison(text));
    }
  });

  it("12. nenhuma duplicação de texto: a contagem de palavras do resultado bate exatamente com a do original", () => {
    const text = Array.from({ length: 20 }, (_, i) => `Parágrafo ${i} com algumas palavras diferentes cada vez.`).join("\n\n");
    const result = generate(text);
    const originalWordCount = normalizeForComparison(text).split(" ").length;
    const resultWordCount = normalizeForComparison(rejoin(result)).split(" ").length;
    expect(resultWordCount).toBe(originalWordCount);
  });

  it("respeita maxSlides: corta no limite e devolve o restante em overflowText, sem descartar nada", () => {
    const text = Array.from({ length: 20 }, (_, i) => `Parágrafo ${i} com bastante texto para forçar vários slides diferentes aqui.`).join("\n\n");
    const result = generate(text, SMALL_BOX, 3);
    expect(result.slides).toHaveLength(3);
    expect(result.overflowText).not.toBeNull();
    expect(normalizeForComparison(rejoin(result))).toBe(normalizeForComparison(text));
  });

  it("texto vazio não gera nenhum slide", () => {
    const result = generate("   \n\n  ");
    expect(result.slides).toEqual([]);
    expect(result.overflowText).toBeNull();
  });

  it("splitIntoSentences corta em ./!/?/… seguidos de espaço, preservando o conteúdo", () => {
    const sentences = splitIntoSentences("Primeira frase. Segunda frase! Terceira frase? Quarta frase…");
    expect(sentences).toEqual(["Primeira frase.", "Segunda frase!", "Terceira frase?", "Quarta frase…"]);
  });
});
