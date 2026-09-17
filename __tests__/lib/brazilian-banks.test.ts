import { describe, expect, it } from "vitest";
import { BRAZILIAN_BANKS, searchBrazilianBanks } from "@/lib/data/brazilian-banks";

describe("BRAZILIAN_BANKS", () => {
  it("não tem códigos duplicados", () => {
    const codes = BRAZILIAN_BANKS.map((bank) => bank.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("todo código tem 3 dígitos", () => {
    for (const bank of BRAZILIAN_BANKS) {
      expect(bank.code).toMatch(/^\d{3}$/);
    }
  });
});

describe("searchBrazilianBanks", () => {
  it("retorna a lista completa para busca vazia", () => {
    expect(searchBrazilianBanks("")).toEqual(BRAZILIAN_BANKS);
  });

  it("encontra um banco pelo código exato", () => {
    const results = searchBrazilianBanks("341");
    expect(results.some((bank) => bank.name.includes("Itaú"))).toBe(true);
  });

  it("encontra um banco pelo nome, ignorando acentos e caixa", () => {
    const results = searchBrazilianBanks("itau");
    expect(results.some((bank) => bank.code === "341")).toBe(true);
  });

  it("encontra um banco pelo nome curto (shortName)", () => {
    const results = searchBrazilianBanks("nubank");
    expect(results.some((bank) => bank.code === "260")).toBe(true);
  });

  it("retorna lista vazia quando nada corresponde", () => {
    expect(searchBrazilianBanks("banco inexistente xyz")).toEqual([]);
  });
});
