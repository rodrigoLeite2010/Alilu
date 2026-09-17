import { describe, expect, it } from "vitest";
import { SYMBOLS, SYMBOL_CATEGORIES, getSymbolsByCategory, searchSymbols } from "@/lib/data/symbols";

describe("symbols", () => {
  it("todo símbolo pertence a uma categoria válida", () => {
    for (const symbol of SYMBOLS) {
      expect(SYMBOL_CATEGORIES).toContain(symbol.category);
      expect(symbol.char.length).toBeGreaterThan(0);
      expect(symbol.name.length).toBeGreaterThan(0);
    }
  });

  it("getSymbolsByCategory retorna só símbolos da categoria pedida", () => {
    const arrows = getSymbolsByCategory("Setas");
    expect(arrows.length).toBeGreaterThan(0);
    expect(arrows.every((s) => s.category === "Setas")).toBe(true);
  });

  it("searchSymbols encontra por nome (case-insensitive)", () => {
    const results = searchSymbols("seta para a direita");
    expect(results.some((s) => s.char === "→")).toBe(true);
  });

  it("searchSymbols encontra pelo próprio caractere", () => {
    const results = searchSymbols("€");
    expect(results.some((s) => s.char === "€")).toBe(true);
  });

  it("searchSymbols com busca vazia retorna todos os símbolos", () => {
    expect(searchSymbols("")).toHaveLength(SYMBOLS.length);
  });

  it("searchSymbols sem correspondência retorna lista vazia", () => {
    expect(searchSymbols("xyzxyzxyz-sem-correspondencia")).toHaveLength(0);
  });
});
