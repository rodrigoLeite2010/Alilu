import { describe, expect, it } from "vitest";
import {
  buildPostFileName,
  clamp,
  clampDragOffset,
  clampFraction,
  computeCoverRect,
  hexToRgba,
  resolveFontSizePx,
  shadeHexColor,
} from "@/lib/instagram/layout-math";

describe("computeCoverRect (recorte 'cover', sem distorcer a imagem)", () => {
  it("corta as laterais quando a imagem é mais larga que a caixa", () => {
    // Caixa quadrada (100x100), imagem bem mais larga (400x100).
    const rect = computeCoverRect(100, 100, 400, 100);
    expect(rect.sHeight).toBe(100);
    expect(rect.sWidth).toBe(100); // 100 (boxRatio 1) * imageHeight(100) = 100
    expect(rect.sx).toBeGreaterThanOrEqual(0);
    expect(rect.sx + rect.sWidth).toBeLessThanOrEqual(400 + 0.001);
  });

  it("corta em cima/embaixo quando a imagem é mais alta que a caixa", () => {
    const rect = computeCoverRect(100, 100, 100, 400);
    expect(rect.sWidth).toBe(100);
    expect(rect.sHeight).toBe(100);
    expect(rect.sy).toBeGreaterThanOrEqual(0);
    expect(rect.sy + rect.sHeight).toBeLessThanOrEqual(400 + 0.001);
  });

  it("não corta nada quando a imagem já tem exatamente a proporção da caixa", () => {
    const rect = computeCoverRect(200, 100, 400, 200);
    expect(rect.sWidth).toBeCloseTo(400);
    expect(rect.sHeight).toBeCloseTo(200);
    expect(rect.sx).toBeCloseTo(0);
    expect(rect.sy).toBeCloseTo(0);
  });

  it("respeita o ponto de enquadramento (focus) ao decidir o que cortar", () => {
    const centered = computeCoverRect(100, 100, 400, 100, 0.5, 0.5);
    const leftAligned = computeCoverRect(100, 100, 400, 100, 0, 0.5);
    const rightAligned = computeCoverRect(100, 100, 400, 100, 1, 0.5);

    expect(leftAligned.sx).toBeLessThan(centered.sx);
    expect(rightAligned.sx).toBeGreaterThan(centered.sx);
    expect(leftAligned.sx).toBeCloseTo(0);
    expect(rightAligned.sx).toBeCloseTo(400 - rightAligned.sWidth);
  });
});

describe("clamp / clampFraction / clampDragOffset", () => {
  it("clamp limita um valor entre min e max", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(50, 0, 10)).toBe(10);
  });

  it("clampFraction sempre devolve um valor entre 0 e 1, com 0.5 como padrão para valores inválidos", () => {
    expect(clampFraction(0.3)).toBe(0.3);
    expect(clampFraction(-1)).toBe(0);
    expect(clampFraction(2)).toBe(1);
    expect(clampFraction(Number.NaN)).toBe(0.5);
  });

  it("clampDragOffset impede que o texto seja arrastado para muito longe da posição original", () => {
    expect(clampDragOffset(0.1)).toBe(0.1);
    expect(clampDragOffset(5)).toBeLessThanOrEqual(0.32);
    expect(clampDragOffset(-5)).toBeGreaterThanOrEqual(-0.32);
  });
});

describe("resolveFontSizePx", () => {
  it("calcula o tamanho em pixels a partir da fração e da menor dimensão do canvas", () => {
    expect(resolveFontSizePx(0.1, 1, 1080, 1080)).toBe(108);
    expect(resolveFontSizePx(0.1, 1, 1080, 1920)).toBe(108); // usa a menor dimensão (1080)
  });

  it("aplica a escala definida pelo usuário, dentro de limites razoáveis", () => {
    const base = resolveFontSizePx(0.1, 1, 1080, 1080);
    const bigger = resolveFontSizePx(0.1, 1.5, 1080, 1080);
    expect(bigger).toBeGreaterThan(base);
  });

  it("nunca retorna um tamanho de fonte menor que 8px", () => {
    expect(resolveFontSizePx(0.001, 0.5, 100, 100)).toBeGreaterThanOrEqual(8);
  });
});

describe("shadeHexColor / hexToRgba", () => {
  it("clareia uma cor com percentual positivo", () => {
    expect(shadeHexColor("#000000", 0.5)).toBe("#808080");
  });

  it("escurece uma cor com percentual negativo", () => {
    expect(shadeHexColor("#ffffff", -0.5)).toBe("#808080");
  });

  it("hexToRgba converte para o formato rgba() com o alfa informado", () => {
    expect(hexToRgba("#ffffff", 0.5)).toBe("rgba(255, 255, 255, 0.5)");
  });
});

describe("buildPostFileName", () => {
  it("gera o nome de arquivo sugerido pela ETAPA 6", () => {
    expect(buildPostFileName("png")).toBe("alilu-instagram-post.png");
    expect(buildPostFileName("jpg")).toBe("alilu-instagram-post.jpg");
  });
});
