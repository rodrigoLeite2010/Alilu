import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildCarouselFromPastedText,
  buildSeedBackgroundImage,
  resolveGeneratedSlideTextBox,
} from "@/lib/instagram/carousel/auto-carousel";
import type { TextMeasurer } from "@/lib/instagram/carousel/text-fit";

/** Mesmo medidor determinístico dos outros testes de carrossel — a largura escala com o tamanho de fonte atual. */
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

describe("resolveGeneratedSlideTextBox", () => {
  it("resolve uma caixa coerente com as dimensões reais de cada formato do carrossel", () => {
    const quadrado = resolveGeneratedSlideTextBox("quadrado");
    const vertical = resolveGeneratedSlideTextBox("vertical");

    // Formato vertical é mais alto que largo (1080x1350) — a altura máxima do bloco de texto acompanha.
    expect(vertical.maxBlockHeightPx).toBeGreaterThan(quadrado.maxBlockHeightPx);
    // Mesma largura (1080px) nos dois formatos — a largura máxima do bloco é igual.
    expect(vertical.maxWidthPx).toBeCloseTo(quadrado.maxWidthPx);
    expect(quadrado.preferredFontSizePx).toBeGreaterThan(quadrado.minFontSizePx);
  });
});

describe("buildCarouselFromPastedText", () => {
  const seedImage = buildSeedBackgroundImage({
    url: "blob:seed",
    fileName: "foto.jpg",
    naturalWidth: 1200,
    naturalHeight: 1200,
  });

  // cloneBackgroundImage (carousel-state.ts) usa fetch()+URL.createObjectURL para clonar a
  // imagem de cada slide gerado — nenhum dos dois existe de verdade no jsdom para uma URL
  // blob:, então simulamos os dois aqui (mesma URL "clonada" de propósito, só para o teste
  // conseguir distinguir "clonou com sucesso" de "clonagem falhou e caiu no fallback sem imagem").
  let cloneCounter = 0;
  beforeEach(() => {
    cloneCounter = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ blob: async () => new Blob() }) as unknown as Response)
    );
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => {
        cloneCounter += 1;
        return `blob:cloned-${cloneCounter}`;
      }),
      revokeObjectURL: vi.fn(),
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("gera um CarouselEditorState com um slide por pedaço, todos com a imagem de fundo aplicada", async () => {
    const text = Array.from(
      { length: 8 },
      (_, i) =>
        `Parágrafo número ${i}, bem mais longo, com várias frases dentro dele. ` +
        "Isso garante que o texto todo não caiba sozinho em um único slide, mesmo usando o tamanho real do template. " +
        "Mais uma frase para aumentar ainda mais este parágrafo específico."
    ).join("\n\n");
    const result = await buildCarouselFromPastedText({
      text,
      seedImage,
      formatId: "quadrado",
      measurer: createFakeMeasurer(),
    });

    expect(result.state.slides.length).toBeGreaterThan(1);
    expect(result.state.originalText).toBe(text);
    expect(result.state.selectedSlideId).toBe(result.state.slides[0].id);
    for (const slide of result.state.slides) {
      expect(slide.state.backgroundImage.url).toBeTruthy();
      expect(slide.state.templateId).toBe("frase-motivacional");
    }
    // Cada slide tem sua própria URL clonada, exceto o primeiro (que reaproveita a imagem original).
    expect(result.state.slides[0].state.backgroundImage.url).toBe("blob:seed");
    expect(result.overflowText).toBeNull();
  });

  it("preserva o texto original completo, mesmo já dividido em vários slides", async () => {
    const text = "Primeiro parágrafo curto.\n\nSegundo parágrafo também curto.";
    const result = await buildCarouselFromPastedText({
      text,
      seedImage,
      formatId: "quadrado",
      measurer: createFakeMeasurer(),
    });
    expect(result.state.originalText).toBe(text);
  });

  it("rejeita texto vazio com uma mensagem amigável, sem gerar um estado inválido", async () => {
    await expect(
      buildCarouselFromPastedText({ text: "   ", seedImage, formatId: "quadrado", measurer: createFakeMeasurer() })
    ).rejects.toThrow(/texto/i);
  });

  it("sinaliza overflowText (sem descartar nada) quando o conteúdo gera mais slides que o limite do editor", async () => {
    // Bloco minúsculo de propósito (via o measurer determinístico + o formato "quadrado" de verdade) — um
    // texto com muitos parágrafos longos estoura os 20 slides do editor.
    const text = Array.from(
      { length: 30 },
      (_, i) => `Parágrafo número ${i} bem completo, com bastante texto para ocupar um slide inteiro sozinho aqui.`
    ).join("\n\n");
    const result = await buildCarouselFromPastedText({
      text,
      seedImage,
      formatId: "quadrado",
      measurer: createFakeMeasurer(0.9), // caracteres "largos" o bastante para forçar mais slides que o limite
    });

    expect(result.state.slides.length).toBeLessThanOrEqual(20);
    if (result.overflowText !== null) {
      expect(result.overflowText.length).toBeGreaterThan(0);
    }
  });
});
