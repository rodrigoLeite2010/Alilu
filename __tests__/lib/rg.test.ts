import { describe, expect, it } from "vitest";
import { isValidRgSP, isRgFormatPlausible, validateRg } from "@/lib/validators/rg";
import { generateRg } from "@/lib/calculators/rg-generator";

describe("isValidRgSP", () => {
  it("aceita um RG (padrão SP) válido, com ou sem máscara", () => {
    for (let i = 0; i < 50; i += 1) {
      const rg = generateRg(false);
      expect(isValidRgSP(rg)).toBe(true);

      const formatted = generateRg(true);
      expect(isValidRgSP(formatted)).toBe(true);
    }
  });

  it("rejeita um RG com dígito verificador incorreto", () => {
    const valid = generateRg(false);
    const lastChar = valid.slice(8);
    const corruptedLastDigit = lastChar === "X" ? "0" : String((Number(lastChar) + 1) % 10);
    const corrupted = valid.slice(0, 8) + corruptedLastDigit;
    expect(isValidRgSP(corrupted)).toBe(false);
  });

  it("rejeita quantidade de dígitos incorreta", () => {
    expect(isValidRgSP("1234567")).toBe(false);
    expect(isValidRgSP("")).toBe(false);
  });

  it("rejeita caracteres inválidos", () => {
    expect(isValidRgSP("ABCDEFGH1")).toBe(false);
  });
});

describe("isRgFormatPlausible", () => {
  it("aceita formatos plausíveis para UFs sem algoritmo implementado", () => {
    expect(isRgFormatPlausible("12.345.678-9")).toBe(true);
    expect(isRgFormatPlausible("1234567")).toBe(true);
  });

  it("rejeita valores vazios ou muito curtos", () => {
    expect(isRgFormatPlausible("")).toBe(false);
    expect(isRgFormatPlausible("123")).toBe(false);
  });
});

describe("validateRg", () => {
  it("aplica o dígito verificador para SP", () => {
    const valid = generateRg(false);
    expect(validateRg(valid, "SP")).toEqual({ valid: true, scope: "sp-padrao-ilustrativo" });
  });

  it("aplica apenas verificação de formato para outras UFs", () => {
    expect(validateRg("12.345.678-9", "RJ")).toEqual({ valid: true, scope: "formato-generico" });
    expect(validateRg("12", "RJ")).toEqual({ valid: false, scope: "formato-generico" });
  });
});
