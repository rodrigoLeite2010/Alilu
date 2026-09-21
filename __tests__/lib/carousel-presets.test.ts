import { describe, expect, it } from "vitest";
import {
  assertPresetTemplatesExist,
  buildSlidesFromPreset,
  CAROUSEL_PRESETS,
  getCarouselPresetById,
} from "@/lib/instagram/carousel/carousel-presets";
import { DEFAULT_CAROUSEL_FORMAT_ID } from "@/lib/instagram/carousel/carousel-state";

describe("carousel-presets — modelos de carrossel (ETAPA 7)", () => {
  it("existem exatamente os 5 modelos previstos no prompt", () => {
    const ids = CAROUSEL_PRESETS.map((preset) => preset.id);
    expect(ids).toEqual(["educativo", "dicas", "produtos", "passo-a-passo", "frases"]);
  });

  it("todo template referenciado pelos modelos existe de fato no catálogo de templates", () => {
    expect(() => assertPresetTemplatesExist()).not.toThrow();
  });

  it("cada modelo tem nome e descrição não vazios, e ao menos um slide", () => {
    for (const preset of CAROUSEL_PRESETS) {
      expect(preset.name.length).toBeGreaterThan(0);
      expect(preset.description.length).toBeGreaterThan(0);
      expect(preset.slidePlan.length).toBeGreaterThan(0);
    }
  });

  it("getCarouselPresetById retorna undefined para um id inexistente", () => {
    expect(getCarouselPresetById("nao-existe")).toBeUndefined();
  });

  it("buildSlidesFromPreset gera um slide por posição do plano, com ids únicos e no formato informado", () => {
    const preset = getCarouselPresetById("educativo")!;
    const slides = buildSlidesFromPreset(preset, DEFAULT_CAROUSEL_FORMAT_ID);

    expect(slides).toHaveLength(preset.slidePlan.length);
    const ids = slides.map((slide) => slide.id);
    expect(new Set(ids).size).toBe(ids.length);
    slides.forEach((slide) => expect(slide.state.formatId).toBe(DEFAULT_CAROUSEL_FORMAT_ID));
  });

  it("buildSlidesFromPreset aplica os textos de exemplo de cada posição do plano", () => {
    const preset = getCarouselPresetById("dicas")!;
    const slides = buildSlidesFromPreset(preset, DEFAULT_CAROUSEL_FORMAT_ID);

    expect(slides[0].state.texts.heading.value).toContain("Dicas rápidas");
    expect(slides[1].state.texts.heading.value).toBe("Primeira dica");
  });

  it("nenhum modelo usa sintaxe de variável com chaves visível ao usuário (ex.: {assunto})", () => {
    for (const preset of CAROUSEL_PRESETS) {
      for (const entry of preset.slidePlan) {
        for (const value of Object.values(entry.texts ?? {})) {
          expect(value ?? "").not.toMatch(/[{}]/);
        }
      }
    }
  });

  it("nenhum modelo inventa preço, desconto, data ou depoimento (ETAPA 9: não pode prometer o que o usuário não informou)", () => {
    const forbiddenPatterns = [/r\$\s?\d/i, /\d+%/, /desconto/i, /\bhoje\b/i, /\d{1,2}\/\d{1,2}/];
    for (const preset of CAROUSEL_PRESETS) {
      for (const entry of preset.slidePlan) {
        for (const value of Object.values(entry.texts ?? {})) {
          for (const pattern of forbiddenPatterns) {
            expect(pattern.test(value ?? "")).toBe(false);
          }
        }
      }
    }
  });
});
