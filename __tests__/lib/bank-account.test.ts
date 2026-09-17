import { describe, expect, it } from "vitest";
import { validateBankAccountFormat } from "@/lib/validators/bank-account";

describe("validateBankAccountFormat", () => {
  it("aceita dados preenchidos corretamente", () => {
    const result = validateBankAccountFormat({
      bankCode: "001",
      agency: "1234",
      account: "1234567",
      accountDigit: "8",
    });
    expect(result).toEqual({ valid: true, errors: {} });
  });

  it("aceita dígito da conta alfanumérico (X)", () => {
    const result = validateBankAccountFormat({
      bankCode: "001",
      agency: "1234",
      account: "1234567",
      accountDigit: "X",
    });
    expect(result.valid).toBe(true);
  });

  it("rejeita campos vazios", () => {
    const result = validateBankAccountFormat({
      bankCode: "",
      agency: "",
      account: "",
      accountDigit: "",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.bankCode).toBeDefined();
    expect(result.errors.agency).toBeDefined();
    expect(result.errors.account).toBeDefined();
    expect(result.errors.accountDigit).toBeDefined();
  });

  it("rejeita agência/conta com caracteres inválidos (sem dígitos suficientes)", () => {
    const result = validateBankAccountFormat({
      bankCode: "001",
      agency: "abcd",
      account: "abcdefg",
      accountDigit: "8",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.agency).toBeDefined();
    expect(result.errors.account).toBeDefined();
  });
});
