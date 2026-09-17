import { describe, expect, it } from "vitest";
import { applyTextCase } from "@/lib/formatters/text-case";

describe("applyTextCase", () => {
  it("converte para tudo maiúsculo preservando acentos", () => {
    expect(applyTextCase("olá são paulo", "upper")).toBe("OLÁ SÃO PAULO");
  });

  it("converte para tudo minúsculo preservando acentos", () => {
    expect(applyTextCase("OLÁ SÃO PAULO", "lower")).toBe("olá são paulo");
  });

  it("converte a primeira letra do texto para maiúscula", () => {
    expect(applyTextCase("frase de teste", "capitalize-text")).toBe("Frase de teste");
  });

  it("converte a primeira letra de cada frase para maiúscula", () => {
    expect(applyTextCase("primeira frase. segunda frase! terceira frase?", "capitalize-sentences")).toBe(
      "Primeira frase. Segunda frase! Terceira frase?"
    );
  });

  it("converte para Title Case (cada palavra)", () => {
    expect(applyTextCase("são josé do rio preto", "title-case")).toBe("São José Do Rio Preto");
  });

  it("retorna string vazia para entrada vazia", () => {
    expect(applyTextCase("", "upper")).toBe("");
    expect(applyTextCase("", "capitalize-text")).toBe("");
  });
});
