import { describe, expect, it } from "vitest";
import { getAllPageNumbers, parsePageSelection } from "@/lib/pdf/page-selection";

describe("parsePageSelection", () => {
  it("mantém a ordem informada e expande intervalos", () => {
    expect(parsePageSelection("3, 1-2, 5", 5)).toEqual({
      ok: true,
      pages: [3, 1, 2, 5],
    });
  });

  it("recusa páginas repetidas", () => {
    expect(parsePageSelection("1-3, 2", 4)).toEqual({
      ok: false,
      error: "A página 2 foi informada mais de uma vez.",
    });
  });

  it("recusa intervalos invertidos e páginas fora do documento", () => {
    expect(parsePageSelection("4-2", 4)).toMatchObject({ ok: false });
    expect(parsePageSelection("5", 4)).toMatchObject({ ok: false });
  });

  it("gera todos os números de página com base 1", () => {
    expect(getAllPageNumbers(4)).toEqual([1, 2, 3, 4]);
  });
});
