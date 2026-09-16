import { describe, expect, it } from "vitest";
import {
  clampNumber,
  isNonEmptyString,
  isNonNegativeNumber,
  isPositiveNumber,
  parseLocaleNumberBRL,
} from "@/lib/validators/number";

describe("parseLocaleNumberBRL", () => {
  it("interpreta separador de milhar e vírgula decimal", () => {
    expect(parseLocaleNumberBRL("1.234,56")).toBe(1234.56);
  });

  it("interpreta números sem separador de milhar", () => {
    expect(parseLocaleNumberBRL("1234,5")).toBe(1234.5);
    expect(parseLocaleNumberBRL("10")).toBe(10);
  });

  it("interpreta números negativos", () => {
    expect(parseLocaleNumberBRL("-10,5")).toBe(-10.5);
  });

  it("retorna null para campos vazios", () => {
    expect(parseLocaleNumberBRL("")).toBeNull();
    expect(parseLocaleNumberBRL("   ")).toBeNull();
  });

  it("retorna null para valores inválidos", () => {
    expect(parseLocaleNumberBRL("abc")).toBeNull();
  });

  it("interpreta zero", () => {
    expect(parseLocaleNumberBRL("0")).toBe(0);
    expect(parseLocaleNumberBRL("0,00")).toBe(0);
  });
});

describe("isPositiveNumber", () => {
  it("é verdadeiro apenas para números maiores que zero", () => {
    expect(isPositiveNumber(1)).toBe(true);
    expect(isPositiveNumber(0)).toBe(false);
    expect(isPositiveNumber(-1)).toBe(false);
    expect(isPositiveNumber(NaN)).toBe(false);
  });
});

describe("isNonNegativeNumber", () => {
  it("aceita zero e rejeita negativos", () => {
    expect(isNonNegativeNumber(0)).toBe(true);
    expect(isNonNegativeNumber(5)).toBe(true);
    expect(isNonNegativeNumber(-0.01)).toBe(false);
  });
});

describe("isNonEmptyString", () => {
  it("rejeita strings vazias ou só com espaços", () => {
    expect(isNonEmptyString("")).toBe(false);
    expect(isNonEmptyString("   ")).toBe(false);
    expect(isNonEmptyString("ok")).toBe(true);
  });
});

describe("clampNumber", () => {
  it("limita o valor ao intervalo informado", () => {
    expect(clampNumber(5, 0, 10)).toBe(5);
    expect(clampNumber(-5, 0, 10)).toBe(0);
    expect(clampNumber(50, 0, 10)).toBe(10);
  });
});
