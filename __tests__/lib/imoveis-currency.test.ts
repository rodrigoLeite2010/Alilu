import { describe, expect, it } from "vitest";
import {
  formatPropertyAmount,
  parsePropertyAmount,
} from "@/lib/imoveis/currency";

describe("valores monetários dos imóveis", () => {
  it.each<[string, number]>([
    ["2.659.574,47", 2659574.47],
    ["2659574,47", 2659574.47],
    ["2659574.47", 2659574.47],
    ["R$ 2.659.574,47", 2659574.47],
    ["2.659.574", 2659574],
    ["2.659", 2659],
    ["930", 930],
    ["930,50", 930.5],
    ["3.000,75", 3000.75],
    ["0,01", 0.01],
    ["", 0],
  ])("interpreta %s sem alterar a escala", (text, expected) => {
    expect(parsePropertyAmount(text)).toBe(expected);
  });
  it.each([
    "2,65957447",
    "2.65957447",
    "1.234,567",
    "1,2,3",
    "1e6",
    "-20",
    "R$ abc",
    "1.000.000.000.000,01",
  ])("recusa valor inválido ou ambíguo: %s", (text) => {
    expect(parsePropertyAmount(text)).toBeNull();
  });
  it("formata com milhar e duas casas decimais", () => {
    expect(formatPropertyAmount(2659574.47)).toBe("2.659.574,47");
    expect(formatPropertyAmount(930)).toBe("930,00");
    expect(formatPropertyAmount(3000.75)).toBe("3.000,75");
    expect(formatPropertyAmount(0)).toBe("0,00");
  });
});
