/**
 * Geração de dados bancários SINTÉTICOS (agência, conta e dígito) para
 * testes de formulários (categoria Geradores). Mantido isolado da
 * interface (PROMPT MESTRE, seção 14).
 *
 * IMPORTANTE: cada banco tem seu próprio algoritmo interno (não público) de
 * cálculo do dígito verificador da conta — por isso este gerador NÃO
 * reproduz o padrão oficial de nenhum banco específico. Os nomes de banco
 * abaixo servem apenas como RÓTULO de exemplo (para testar campos "banco"
 * de um formulário) — não há qualquer relação com o número gerado, que é
 * inteiramente aleatório e fictício.
 *
 * Todos os valores são sorteados com `crypto.getRandomValues` (ver
 * lib/random/secure-random.ts), nunca com `Math.random`.
 */

import { secureRandomDigit, secureRandomChoice, secureRandomChar } from "@/lib/random/secure-random";

export const BANK_ACCOUNT_GENERATOR_MAX_BATCH = 100;

export interface BankLabel {
  code: string;
  name: string;
}

/** Bancos populares usados apenas como RÓTULO — ver aviso no cabeçalho. */
export const BANK_LABELS: BankLabel[] = [
  { code: "001", name: "Banco do Brasil" },
  { code: "033", name: "Santander" },
  { code: "104", name: "Caixa Econômica Federal" },
  { code: "237", name: "Bradesco" },
  { code: "341", name: "Itaú Unibanco" },
  { code: "260", name: "Nubank" },
  { code: "077", name: "Banco Inter" },
  { code: "336", name: "C6 Bank" },
  { code: "212", name: "Banco Original" },
  { code: "290", name: "PagBank" },
];

export type BankAccountType = "corrente" | "poupanca";

export interface GeneratedBankAccount {
  bank: BankLabel;
  agency: string;
  account: string;
  accountDigit: string;
  type: BankAccountType;
}

export interface BankAccountGeneratorInput {
  count: number;
  /** Código do banco (ver BANK_LABELS), ou "random" para sortear. */
  bankCode: string;
  type: BankAccountType;
}

export interface BankAccountGeneratorFieldErrors {
  count?: string;
}

function randomDigits(length: number): string {
  return Array.from({ length }, () => secureRandomDigit()).join("");
}

/** Gera um único conjunto de dados bancários sintéticos. */
export function generateBankAccount(input: Pick<BankAccountGeneratorInput, "bankCode" | "type">): GeneratedBankAccount {
  const bank =
    input.bankCode === "random"
      ? secureRandomChoice(BANK_LABELS)
      : (BANK_LABELS.find((b) => b.code === input.bankCode) ?? BANK_LABELS[0]);

  return {
    bank,
    agency: randomDigits(4),
    account: randomDigits(7),
    accountDigit: secureRandomChar("0123456789"),
    type: input.type,
  };
}

export function validateBankAccountGeneratorInput(
  input: BankAccountGeneratorInput
): BankAccountGeneratorFieldErrors {
  const errors: BankAccountGeneratorFieldErrors = {};

  if (!Number.isFinite(input.count) || !Number.isInteger(input.count) || input.count < 1) {
    errors.count = "Informe uma quantidade inteira de pelo menos 1.";
  } else if (input.count > BANK_ACCOUNT_GENERATOR_MAX_BATCH) {
    errors.count = `A quantidade não pode ser maior que ${BANK_ACCOUNT_GENERATOR_MAX_BATCH}.`;
  }

  return errors;
}

export function isBankAccountGeneratorInputValid(input: BankAccountGeneratorInput): boolean {
  return Object.keys(validateBankAccountGeneratorInput(input)).length === 0;
}

/**
 * Gera um lote de contas bancárias sintéticas. O limite
 * (BANK_ACCOUNT_GENERATOR_MAX_BATCH) é aplicado ANTES de qualquer geração,
 * então nunca é criado um array maior que o limite, mesmo que a validação
 * seja pulada por algum chamador.
 */
export function generateBankAccountBatch(
  input: BankAccountGeneratorInput
): GeneratedBankAccount[] {
  const safeCount = Math.min(
    Math.max(1, Math.trunc(input.count) || 1),
    BANK_ACCOUNT_GENERATOR_MAX_BATCH
  );

  return Array.from({ length: safeCount }, () => generateBankAccount(input));
}
