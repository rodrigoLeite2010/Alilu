/**
 * Validação de dados bancários (Banco / Agência / Conta / Dígito) —
 * categoria Validadores.
 *
 * LIMITAÇÃO CONHECIDA E IMPORTANTE (mesmo espírito do aviso em
 * lib/calculators/bank-account-generator.ts): cada banco brasileiro usa um
 * algoritmo próprio, não público, para calcular o dígito verificador da
 * conta — não existe uma fórmula única confiável para todos os bancos.
 * Por isso este arquivo NÃO inventa nem reproduz um cálculo de dígito
 * verificador: valida apenas formato, campos obrigatórios e caracteres
 * permitidos, com aviso explícito na interface sobre essa limitação.
 *
 * Este arquivo NUNCA consulta nenhum banco, gateway de pagamento ou
 * cadastro de correntistas.
 */

import { onlyDigits } from "@/lib/validators/document";

export interface BankAccountValidationInput {
  bankCode: string;
  agency: string;
  account: string;
  accountDigit: string;
}

export interface BankAccountValidationErrors {
  bankCode?: string;
  agency?: string;
  account?: string;
  accountDigit?: string;
}

export interface BankAccountValidationResult {
  valid: boolean;
  errors: BankAccountValidationErrors;
}

/** Dígito verificador de conta pode ser numérico ou, em alguns bancos, "X". */
function isValidAccountDigit(value: string): boolean {
  const normalized = value.trim().toUpperCase();
  return /^[0-9X]{1,2}$/.test(normalized);
}

/**
 * Valida apenas o FORMATO dos dados bancários informados — nunca confirma
 * que a conta existe ou está ativa (ver aviso no cabeçalho deste arquivo).
 */
export function validateBankAccountFormat(
  input: BankAccountValidationInput
): BankAccountValidationResult {
  const errors: BankAccountValidationErrors = {};

  if (!input.bankCode || input.bankCode.trim().length === 0) {
    errors.bankCode = "Selecione o banco.";
  }

  const agencyDigits = onlyDigits(input.agency);
  if (!agencyDigits || agencyDigits.length < 1 || agencyDigits.length > 6) {
    errors.agency = "Informe uma agência com 1 a 6 dígitos.";
  }

  const accountDigits = onlyDigits(input.account);
  if (!accountDigits || accountDigits.length < 1 || accountDigits.length > 13) {
    errors.account = "Informe uma conta com 1 a 13 dígitos.";
  }

  if (!input.accountDigit || !isValidAccountDigit(input.accountDigit)) {
    errors.accountDigit = "Informe o dígito da conta (1 a 2 caracteres, número ou X).";
  }

  return { valid: Object.keys(errors).length === 0, errors };
}
