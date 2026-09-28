import { describe, expect, it } from "vitest";
import { fitTextBlock, resolveTextBlockBox, wrapMeasuredLines, type TextMeasurer } from "@/lib/instagram/carousel/text-fit";

/**
 * Medidor determinístico: a largura de cada caractere escala com o
 * tamanho de fonte atualmente definido em `ctx.font` (como uma fonte de
 * verdade) — assim o encolhimento dentro de `fitTextBlock` realmente muda
 * quanto texto cabe por linha, em vez de ser um número fixo e alheio ao
 * tamanho da fonte.
 */
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

describe("wrapMeasuredLines", () => {
  it("quebra por parágrafo (\\n) e depois por palavra, sem estourar a largura máxima", () => {
    const ctx = createFakeMeasurer();
    ctx.font = "20px fake"; // 12px por caractere (0.6 * 20)
    const lines = wrapMeasuredLines(ctx, "uma linha\noutra linha bem mais longa que precisa quebrar", 120);
    expect(lines[0]).toBe("uma linha");
    expect(lines.length).toBeGreaterThan(2);
    for (const line of lines) {
      expect(ctx.measureText(line).width).toBeLessThanOrEqual(120 + 0.001);
    }
  });

  it("preserva uma linha em branco entre parágrafos", () => {
    const ctx = createFakeMeasurer();
    ctx.font = "20px fake";
    const lines = wrapMeasuredLines(ctx, "a\n\nb", 200);
    expect(lines).toEqual(["a", "", "b"]);
  });
});

describe("fitTextBlock", () => {
  const box = {
    maxWidthPx: 300,
    maxBlockHeightPx: 100,
    fontFamily: "fake",
    bold: false,
    preferredFontSizePx: 24,
    minFontSizePx: 10,
    lineHeight: 1,
  };

  it("mantém o tamanho preferido quando o texto é curto o suficiente", () => {
    const ctx = createFakeMeasurer();
    const result = fitTextBlock(ctx, "texto curto", box);
    expect(result.fontSizePx).toBe(24);
    expect(result.fits).toBe(true);
  });

  it("encolhe a fonte (nunca abaixo do piso) quando o texto não cabe no tamanho preferido", () => {
    const ctx = createFakeMeasurer();
    const longText = Array.from({ length: 30 }, (_, i) => `palavra${i}`).join(" ");
    const result = fitTextBlock(ctx, longText, box);
    expect(result.fontSizePx).toBeLessThan(24);
    expect(result.fontSizePx).toBeGreaterThanOrEqual(box.minFontSizePx);
  });

  it("sinaliza fits:false (sem cortar o texto) quando nem no piso mínimo cabe tudo", () => {
    const ctx = createFakeMeasurer();
    const veryLongText = Array.from({ length: 500 }, (_, i) => `palavra${i}`).join(" ");
    const result = fitTextBlock(ctx, veryLongText, box);
    expect(result.fontSizePx).toBe(box.minFontSizePx);
    expect(result.fits).toBe(false);
    // Nunca corta: todas as palavras originais continuam presentes nas linhas.
    expect(result.lines.join(" ")).toContain("palavra0");
    expect(result.lines.join(" ")).toContain("palavra499");
  });
});

describe("resolveTextBlockBox", () => {
  it("resolve as mesmas contas de resolveFontSizePx/TEXT_SLOT_MAX_BLOCK_HEIGHT_FRAC usadas pelo motor de desenho", () => {
    const box = resolveTextBlockBox({
      maxWidthFrac: 0.78,
      fontSizeFrac: 0.062,
      fontWeight: "bold",
      lineHeight: 1.35,
      fontFamily: "Georgia",
      canvasWidth: 1080,
      canvasHeight: 1080,
    });

    expect(box.maxWidthPx).toBeCloseTo(0.78 * 1080);
    expect(box.bold).toBe(true);
    expect(box.preferredFontSizePx).toBeGreaterThan(box.minFontSizePx);
    expect(box.maxBlockHeightPx).toBeLessThan(1080);
  });
});
