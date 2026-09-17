import { describe, expect, it } from "vitest";
import {
  applyFancyTextStyle,
  applyAllFancyTextStyles,
  validateFancyTextInput,
  isFancyTextInputValid,
  FANCY_TEXT_STYLES,
  FANCY_TEXT_MAX_LENGTH,
} from "@/lib/calculators/fancy-text-generator";

describe("fancy-text-generator", () => {
  it("converte para negrito (bloco Unicode matemático)", () => {
    expect(applyFancyTextStyle("Ab1", "negrito")).toBe("𝐀𝐛𝟏");
  });

  it("converte para itálico (dígitos ficam inalterados, sem bloco itálico)", () => {
    expect(applyFancyTextStyle("Ab1", "italico")).toBe("𝐴𝑏1");
  });

  it("converte para largura total (fullwidth)", () => {
    expect(applyFancyTextStyle("Ab 1", "largura-total")).toBe("Ａｂ　１");
  });

  it("converte para bolha (círculo)", () => {
    expect(applyFancyTextStyle("Ab0", "bolha")).toBe("Ⓐⓑ⓪");
  });

  it("inverte o texto (de cabeça para baixo) e a ordem dos caracteres", () => {
    expect(applyFancyTextStyle("abc", "invertido")).toBe("ɔqɐ");
  });

  it("aplica riscado inserindo o caractere combinante após cada letra", () => {
    const result = applyFancyTextStyle("ab", "riscado");
    expect(result).toBe("a̶b̶");
  });

  it("aplica sublinhado inserindo o caractere combinante após cada letra", () => {
    const result = applyFancyTextStyle("ab", "sublinhado");
    expect(result).toBe("a̲b̲");
  });

  it("é uma transformação pura (mesma entrada -> mesma saída)", () => {
    expect(applyFancyTextStyle("Teste 123", "negrito")).toBe(applyFancyTextStyle("Teste 123", "negrito"));
  });

  it("aplica todos os estilos de uma vez", () => {
    const all = applyAllFancyTextStyles("Oi");
    expect(all).toHaveLength(FANCY_TEXT_STYLES.length);
    expect(all.every((entry) => entry.value.length > 0)).toBe(true);
  });

  it("valida texto vazio", () => {
    expect(validateFancyTextInput("").text).toBeDefined();
    expect(validateFancyTextInput("   ").text).toBeDefined();
    expect(isFancyTextInputValid("Olá")).toBe(true);
  });

  it("valida texto maior que o limite", () => {
    const long = "a".repeat(FANCY_TEXT_MAX_LENGTH + 1);
    expect(validateFancyTextInput(long).text).toBeDefined();
  });
});
