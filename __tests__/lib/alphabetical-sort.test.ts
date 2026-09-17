import { describe, expect, it } from "vitest";
import {
  sortLinesAlphabetically,
  DEFAULT_ALPHABETICAL_SORT_OPTIONS,
} from "@/lib/formatters/alphabetical-sort";

describe("sortLinesAlphabetically", () => {
  it("ordena em ordem crescente (A-Z) por padrão", () => {
    expect(sortLinesAlphabetically("banana\nabacaxi\nmaçã", DEFAULT_ALPHABETICAL_SORT_OPTIONS)).toEqual([
      "abacaxi",
      "banana",
      "maçã",
    ]);
  });

  it("ordena em ordem decrescente (Z-A)", () => {
    expect(
      sortLinesAlphabetically("banana\nabacaxi\nmaçã", { ...DEFAULT_ALPHABETICAL_SORT_OPTIONS, direction: "desc" })
    ).toEqual(["maçã", "banana", "abacaxi"]);
  });

  it("trata acentos corretamente na ordenação (é perto de e, não no fim)", () => {
    expect(sortLinesAlphabetically("éster\nesther\nfabio", DEFAULT_ALPHABETICAL_SORT_OPTIONS)).toEqual([
      "éster",
      "esther",
      "fabio",
    ]);
  });

  it("ignora maiúsculas/minúsculas quando caseInsensitive é true", () => {
    expect(
      sortLinesAlphabetically("banana\nAbacaxi", { ...DEFAULT_ALPHABETICAL_SORT_OPTIONS, caseInsensitive: true })
    ).toEqual(["Abacaxi", "banana"]);
  });

  it("remove duplicados quando removeDuplicates é true", () => {
    expect(
      sortLinesAlphabetically("banana\nBanana\nabacaxi", {
        ...DEFAULT_ALPHABETICAL_SORT_OPTIONS,
        removeDuplicates: true,
        caseInsensitive: true,
      })
    ).toEqual(["abacaxi", "banana"]);
  });

  it("ignora linhas vazias quando skipEmptyLines é true", () => {
    expect(sortLinesAlphabetically("banana\n\n\nabacaxi", DEFAULT_ALPHABETICAL_SORT_OPTIONS)).toEqual([
      "abacaxi",
      "banana",
    ]);
  });

  it("mantém linhas vazias quando skipEmptyLines é false", () => {
    expect(
      sortLinesAlphabetically("banana\n\nabacaxi", { ...DEFAULT_ALPHABETICAL_SORT_OPTIONS, skipEmptyLines: false })
    ).toHaveLength(3);
  });

  it("retorna array vazio para texto vazio (com skipEmptyLines)", () => {
    expect(sortLinesAlphabetically("", DEFAULT_ALPHABETICAL_SORT_OPTIONS)).toEqual([]);
  });
});
