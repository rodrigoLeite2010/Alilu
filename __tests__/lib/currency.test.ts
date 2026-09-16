import { describe, expect, it } from "vitest";
import {
  formatCurrencyBRL,
  formatNumberBRL,
  formatPercentage,
} from "@/lib/formatters/currency";

describe("formatCurrencyBRL", () => {
  it("formata valores positivos no padrão brasileiro", () => {
    expect(formatCurrencyBRL(1234.5)).toBe("R$ 1.234,50");
  });

  it("formata zero corretamente", () => {
    expect(formatCurrencyBRL(0)).toBe("R$ 0,00");
  });

  it("formata valores negativos", () => {
    expect(formatCurrencyBRL(-50)).toBe("-R$ 50,00");
  });

  it("trata valores não finitos como zero", () => {
    expect(formatCurrencyBRL(NaN)).toBe("R$ 0,00");
    expect(formatCurrencyBRL(Infinity)).toBe("R$ 0,00");
  });

  it("arredonda para duas casas decimais", () => {
    expect(formatCurrencyBRL(10.005)).toBe("R$ 10,01");
  });
});

describe("formatNumberBRL", () => {
  it("usa vírgula como separador decimal e ponto como milhar", () => {
    expect(formatNumberBRL(1234567.891, 2)).toBe("1.234.567,89");
  });

  it("respeita o número de casas decimais informado", () => {
    expect(formatNumberBRL(10, 0)).toBe("10");
    expect(formatNumberBRL(10, 3)).toBe("10,000");
  });

  it("trata valores não finitos como zero", () => {
    expect(formatNumberBRL(NaN)).toBe("0,00");
  });
});

describe("formatPercentage", () => {
  it("formata percentuais com o símbolo %", () => {
    expect(formatPercentage(12.5)).toBe("12,5%");
  });

  it("formata zero por cento", () => {
    expect(formatPercentage(0)).toBe("0,0%");
  });
});
