import { describe, expect, it } from "vitest";
import {
  documentTypeLabel,
  formatCpfCnpjMask,
  isValidCNPJ,
  isValidCPF,
  onlyDigits,
  validateOptionalCpfCnpj,
} from "@/lib/validators/document";

/**
 * Testes de validação e máscara de CPF/CNPJ (PROMPT ETAPA 2, seção 22).
 * Os algoritmos de validação usam os dígitos verificadores reais — não
 * apenas a quantidade de dígitos.
 */
describe("onlyDigits", () => {
  it("remove qualquer caractere que não seja dígito", () => {
    expect(onlyDigits("123.456.789-09")).toBe("12345678909");
    expect(onlyDigits("11.222.333/0001-81")).toBe("11222333000181");
  });
});

describe("isValidCPF", () => {
  it("aceita um CPF válido, com ou sem máscara", () => {
    expect(isValidCPF("111.444.777-35")).toBe(true);
    expect(isValidCPF("11144477735")).toBe(true);
  });

  it("rejeita um CPF com dígito verificador incorreto", () => {
    expect(isValidCPF("111.444.777-34")).toBe(false);
  });

  it("rejeita sequências de dígitos repetidos", () => {
    expect(isValidCPF("000.000.000-00")).toBe(false);
    expect(isValidCPF("111.111.111-11")).toBe(false);
  });

  it("rejeita quantidade de dígitos incorreta", () => {
    expect(isValidCPF("123456789")).toBe(false);
    expect(isValidCPF("123456789012")).toBe(false);
  });
});

describe("isValidCNPJ", () => {
  it("aceita um CNPJ válido, com ou sem máscara", () => {
    expect(isValidCNPJ("11.222.333/0001-81")).toBe(true);
    expect(isValidCNPJ("11222333000181")).toBe(true);
  });

  it("rejeita um CNPJ com dígito verificador incorreto", () => {
    expect(isValidCNPJ("11.222.333/0001-82")).toBe(false);
  });

  it("rejeita sequências de dígitos repetidos", () => {
    expect(isValidCNPJ("11.111.111/1111-11")).toBe(false);
    expect(isValidCNPJ("00.000.000/0000-00")).toBe(false);
  });

  it("rejeita quantidade de dígitos incorreta", () => {
    expect(isValidCNPJ("1122233300018")).toBe(false);
  });
});

describe("formatCpfCnpjMask", () => {
  it("formata 11 dígitos como CPF", () => {
    expect(formatCpfCnpjMask("12345678909")).toBe("123.456.789-09");
  });

  it("formata 14 dígitos como CNPJ", () => {
    expect(formatCpfCnpjMask("11222333000181")).toBe("11.222.333/0001-81");
  });

  it("formata progressivamente enquanto o usuário digita", () => {
    expect(formatCpfCnpjMask("123")).toBe("123");
    expect(formatCpfCnpjMask("1234")).toBe("123.4");
    expect(formatCpfCnpjMask("123456789")).toBe("123.456.789");
  });

  it("aceita colagem já formatada (idempotente)", () => {
    expect(formatCpfCnpjMask("123.456.789-09")).toBe("123.456.789-09");
  });
});

describe("documentTypeLabel", () => {
  it("identifica CPF (11 dígitos) e CNPJ (14 dígitos)", () => {
    expect(documentTypeLabel("123.456.789-09")).toBe("CPF");
    expect(documentTypeLabel("11.222.333/0001-81")).toBe("CNPJ");
  });

  it("retorna null para quantidade de dígitos incompleta", () => {
    expect(documentTypeLabel("123")).toBeNull();
  });
});

describe("validateOptionalCpfCnpj", () => {
  it("trata campo vazio como válido (opcional)", () => {
    expect(validateOptionalCpfCnpj("")).toEqual({ valid: true, type: null });
  });

  it("valida CPF preenchido", () => {
    expect(validateOptionalCpfCnpj("111.444.777-35")).toEqual({
      valid: true,
      type: "cpf",
    });
    expect(validateOptionalCpfCnpj("111.444.777-34")).toEqual({
      valid: false,
      type: "cpf",
    });
  });

  it("valida CNPJ preenchido", () => {
    expect(validateOptionalCpfCnpj("11.222.333/0001-81")).toEqual({
      valid: true,
      type: "cnpj",
    });
    expect(validateOptionalCpfCnpj("11.222.333/0001-82")).toEqual({
      valid: false,
      type: "cnpj",
    });
  });

  it("rejeita quantidade de dígitos que não corresponde a CPF nem CNPJ", () => {
    expect(validateOptionalCpfCnpj("123456")).toEqual({
      valid: false,
      type: null,
    });
  });
});
