import { describe, expect, it } from "vitest";
import {
  isValidHexColor,
  validatePlaceholderImageInput,
  isPlaceholderImageInputValid,
  buildPlaceholderLabel,
  buildPlaceholderFileName,
  PLACEHOLDER_IMAGE_MIN_SIZE,
  PLACEHOLDER_IMAGE_MAX_SIZE,
} from "@/lib/calculators/placeholder-image-generator";

describe("placeholder-image-generator", () => {
  it("valida cor hexadecimal", () => {
    expect(isValidHexColor("#CBD5E1")).toBe(true);
    expect(isValidHexColor("#fff")).toBe(false);
    expect(isValidHexColor("cbd5e1")).toBe(false);
  });

  it("valida largura e altura dentro do intervalo permitido", () => {
    const valid = {
      width: 400,
      height: 300,
      backgroundColor: "#CBD5E1",
      textColor: "#1E293B",
      label: "",
    };
    expect(isPlaceholderImageInputValid(valid)).toBe(true);

    expect(
      validatePlaceholderImageInput({ ...valid, width: PLACEHOLDER_IMAGE_MIN_SIZE - 1 }).width
    ).toBeDefined();
    expect(
      validatePlaceholderImageInput({ ...valid, height: PLACEHOLDER_IMAGE_MAX_SIZE + 1 }).height
    ).toBeDefined();
    expect(validatePlaceholderImageInput({ ...valid, backgroundColor: "azul" }).backgroundColor).toBeDefined();
    expect(validatePlaceholderImageInput({ ...valid, textColor: "azul" }).textColor).toBeDefined();
  });

  it("usa o rótulo informado, ou '<largura> × <altura>' quando vazio", () => {
    expect(buildPlaceholderLabel(400, 300, "")).toBe("400 × 300");
    expect(buildPlaceholderLabel(400, 300, "  ")).toBe("400 × 300");
    expect(buildPlaceholderLabel(400, 300, "Meu rótulo")).toBe("Meu rótulo");
  });

  it("monta o nome de arquivo sugerido", () => {
    expect(buildPlaceholderFileName(400, 300)).toBe("placeholder-400x300.png");
  });
});
