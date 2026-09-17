import { describe, expect, it } from "vitest";
import {
  generateBankAccount,
  generateBankAccountBatch,
  validateBankAccountGeneratorInput,
  isBankAccountGeneratorInputValid,
  BANK_LABELS,
  BANK_ACCOUNT_GENERATOR_MAX_BATCH,
} from "@/lib/calculators/bank-account-generator";

describe("bank-account-generator", () => {
  it("gera agência (4 dígitos), conta (7 dígitos) e dígito (1 caractere)", () => {
    const account = generateBankAccount({ bankCode: "random", type: "corrente" });
    expect(account.agency).toMatch(/^\d{4}$/);
    expect(account.account).toMatch(/^\d{7}$/);
    expect(account.accountDigit).toMatch(/^\d$/);
  });

  it("usa o banco pedido quando um código específico é informado", () => {
    const account = generateBankAccount({ bankCode: "341", type: "corrente" });
    expect(account.bank.code).toBe("341");
    expect(account.bank.name).toBe("Itaú Unibanco");
  });

  it("sorteia um banco quando bankCode === 'random'", () => {
    for (let i = 0; i < 30; i += 1) {
      const account = generateBankAccount({ bankCode: "random", type: "poupanca" });
      expect(BANK_LABELS.map((b) => b.code)).toContain(account.bank.code);
    }
  });

  it("respeita o tipo de conta pedido", () => {
    const account = generateBankAccount({ bankCode: "random", type: "poupanca" });
    expect(account.type).toBe("poupanca");
  });

  it("gera um lote com a quantidade pedida", () => {
    const batch = generateBankAccountBatch({ count: 15, bankCode: "random", type: "corrente" });
    expect(batch).toHaveLength(15);
  });

  it("nunca gera um lote maior que BANK_ACCOUNT_GENERATOR_MAX_BATCH", () => {
    const batch = generateBankAccountBatch({ count: 99999, bankCode: "random", type: "corrente" });
    expect(batch).toHaveLength(BANK_ACCOUNT_GENERATOR_MAX_BATCH);
  });

  it("valida quantidade fora do intervalo permitido", () => {
    expect(
      validateBankAccountGeneratorInput({ count: 0, bankCode: "random", type: "corrente" }).count
    ).toBeDefined();
    expect(
      isBankAccountGeneratorInputValid({ count: 1, bankCode: "random", type: "corrente" })
    ).toBe(true);
  });
});
