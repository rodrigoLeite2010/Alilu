// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  OTP_CODE_LENGTH,
  generateOtpCode,
  hashOtpCode,
  isValidEmail,
  normalizeEmail,
  verifyOtpCode,
} from "@/lib/instagram/backend/otp";

describe("generateOtpCode", () => {
  it("sempre gera um código com OTP_CODE_LENGTH dígitos numéricos, com zeros à esquerda quando preciso", () => {
    for (let i = 0; i < 200; i += 1) {
      const code = generateOtpCode();
      expect(code).toMatch(/^\d+$/);
      expect(code.length).toBe(OTP_CODE_LENGTH);
    }
  });
});

describe("hashOtpCode / verifyOtpCode", () => {
  it("verifica corretamente o código original", () => {
    const code = "123456";
    const hash = hashOtpCode(code);
    expect(verifyOtpCode(code, hash)).toBe(true);
  });

  it("rejeita um código diferente", () => {
    const hash = hashOtpCode("123456");
    expect(verifyOtpCode("654321", hash)).toBe(false);
  });

  it("dois hashes do mesmo código são diferentes (sal aleatório)", () => {
    const first = hashOtpCode("123456");
    const second = hashOtpCode("123456");
    expect(first).not.toBe(second);
  });

  it("nunca lança erro para um hash em formato inválido — só retorna false", () => {
    expect(verifyOtpCode("123456", "formato-invalido")).toBe(false);
    expect(verifyOtpCode("123456", "")).toBe(false);
    expect(verifyOtpCode("123456", "abc.def.ghi")).toBe(false);
  });
});

describe("normalizeEmail", () => {
  it("remove espaços nas pontas e converte para minúsculas", () => {
    expect(normalizeEmail("  Usuario@Exemplo.COM  ")).toBe("usuario@exemplo.com");
  });
});

describe("isValidEmail", () => {
  it("aceita e-mails razoáveis", () => {
    expect(isValidEmail("nome@dominio.com")).toBe(true);
    expect(isValidEmail("nome.sobrenome@sub.dominio.com.br")).toBe(true);
  });

  it("rejeita entradas obviamente inválidas", () => {
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("nao-e-email")).toBe(false);
    expect(isValidEmail("falta@dominio")).toBe(false);
    expect(isValidEmail("tem espaco@dominio.com")).toBe(false);
    expect(isValidEmail("@dominio.com")).toBe(false);
  });
});
