import { describe, expect, it } from "vitest";
import { DEFAULT_FONT_ID, getFontById, isPostFontId, POST_FONTS } from "@/lib/instagram/fonts";
import { DEFAULT_COLOR_COMBO_ID, getColorComboById, isValidHexColor, POST_COLOR_COMBOS } from "@/lib/instagram/colors";

describe("lib/instagram/fonts", () => {
  it("toda fonte tem um id único e uma família válida para uso em ctx.font", () => {
    const ids = POST_FONTS.map((font) => font.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const font of POST_FONTS) {
      expect(font.family.length).toBeGreaterThan(0);
    }
  });

  it("getFontById resolve pelo id e cai para a fonte padrão quando não encontra", () => {
    expect(getFontById(DEFAULT_FONT_ID).id).toBe(DEFAULT_FONT_ID);
    expect(getFontById("fonte-inexistente").id).toBe(DEFAULT_FONT_ID);
  });

  it("isPostFontId reconhece apenas ids cadastrados", () => {
    expect(isPostFontId(DEFAULT_FONT_ID)).toBe(true);
    expect(isPostFontId("comic-sans")).toBe(false);
  });
});

describe("lib/instagram/colors", () => {
  it("toda combinação de cores tem um id único e cores em hexadecimal válido", () => {
    const ids = POST_COLOR_COMBOS.map((combo) => combo.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const combo of POST_COLOR_COMBOS) {
      expect(isValidHexColor(combo.background)).toBe(true);
      expect(isValidHexColor(combo.heading)).toBe(true);
      expect(isValidHexColor(combo.body)).toBe(true);
      expect(isValidHexColor(combo.footer)).toBe(true);
      expect(isValidHexColor(combo.accent)).toBe(true);
      expect(isValidHexColor(combo.badgeBackground)).toBe(true);
      expect(isValidHexColor(combo.badgeText)).toBe(true);
    }
  });

  it("getColorComboById resolve pelo id e cai para o padrão quando não encontra", () => {
    expect(getColorComboById(DEFAULT_COLOR_COMBO_ID).id).toBe(DEFAULT_COLOR_COMBO_ID);
    expect(getColorComboById("cor-inexistente").id).toBe(DEFAULT_COLOR_COMBO_ID);
  });

  it("isValidHexColor valida o formato #RRGGBB", () => {
    expect(isValidHexColor("#0f766e")).toBe(true);
    expect(isValidHexColor("#FFF")).toBe(false);
    expect(isValidHexColor("azul")).toBe(false);
    expect(isValidHexColor("0f766e")).toBe(false);
  });
});
