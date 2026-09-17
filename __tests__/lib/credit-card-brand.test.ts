import { describe, expect, it } from "vitest";
import { detectCardBrand } from "@/lib/validators/credit-card-brand";
import { isValidLuhn } from "@/lib/calculators/credit-card-generator";

describe("detectCardBrand", () => {
  it("identifica Visa pelo prefixo 4", () => {
    expect(detectCardBrand("4242424242424242")).toBe("visa");
    expect(isValidLuhn("4242424242424242")).toBe(true);
  });

  it("identifica Mastercard pelo prefixo 51-55", () => {
    expect(detectCardBrand("5555555555554444")).toBe("mastercard");
  });

  it("identifica American Express pelo prefixo 34/37 e 15 dígitos", () => {
    expect(detectCardBrand("378282246310005")).toBe("amex");
  });

  it("identifica Elo por um BIN conhecido", () => {
    expect(detectCardBrand("6362970000457013")).toBe("elo");
  });

  it("identifica Hipercard pelo BIN 606282", () => {
    expect(detectCardBrand("6062821234567890")).toBe("hipercard");
  });

  it("retorna null para um número sem padrão de bandeira reconhecido", () => {
    expect(detectCardBrand("9999999999999999")).toBeNull();
  });

  it("retorna null para valor não numérico ou vazio", () => {
    expect(detectCardBrand("abc")).toBeNull();
    expect(detectCardBrand("")).toBeNull();
  });
});
