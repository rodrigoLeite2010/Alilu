"use client";

import { useState, type FormEvent } from "react";
import { TextField } from "@/components/forms/TextField";
import { SelectField } from "@/components/forms/SelectField";
import { Button } from "@/components/ui/Button";
import { ValidatorResult } from "@/components/tools/validator-shared/ValidatorResult";
import { ValidatorPrivacyNotice } from "@/components/tools/validator-shared/ValidatorPrivacyNotice";
import { BANK_LABELS } from "@/lib/calculators/bank-account-generator";
import {
  validateBankAccountFormat,
  type BankAccountValidationErrors,
} from "@/lib/validators/bank-account";

/**
 * Validador de Conta Bancária (categoria Validadores). Cada banco usa um
 * algoritmo próprio (não público) para o dígito verificador da conta — por
 * isso esta ferramenta NÃO inventa um cálculo de dígito verificador,
 * apenas confere formato, campos obrigatórios e caracteres permitidos
 * (reaproveitando BANK_LABELS, já usado pelo Gerador de Conta Bancária).
 */
export function ValidadorContaBancariaTool() {
  const [bankCode, setBankCode] = useState(BANK_LABELS[0].code);
  const [agency, setAgency] = useState("");
  const [account, setAccount] = useState("");
  const [accountDigit, setAccountDigit] = useState("");
  const [errors, setErrors] = useState<BankAccountValidationErrors>({});
  const [result, setResult] = useState<boolean | null>(null);

  function runValidation() {
    const validation = validateBankAccountFormat({ bankCode, agency, account, accountDigit });
    setErrors(validation.errors);
    setResult(validation.valid);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runValidation();
  }

  function handleClear() {
    setBankCode(BANK_LABELS[0].code);
    setAgency("");
    setAccount("");
    setAccountDigit("");
    setErrors({});
    setResult(null);
  }

  return (
    <div>
      <ValidatorPrivacyNotice />

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <SelectField
          id="validador-conta-bancaria-banco"
          label="Banco"
          value={bankCode}
          onChange={(event) => {
            setBankCode(event.target.value);
            setResult(null);
          }}
          error={errors.bankCode}
        >
          {BANK_LABELS.map((bank) => (
            <option key={bank.code} value={bank.code}>
              {bank.name}
            </option>
          ))}
        </SelectField>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <TextField
            id="validador-conta-bancaria-agencia"
            label="Agência"
            placeholder="0001"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            value={agency}
            onChange={(event) => {
              setAgency(event.target.value.replace(/\D/g, "").slice(0, 6));
              setResult(null);
            }}
            error={errors.agency}
          />
          <TextField
            id="validador-conta-bancaria-conta"
            label="Conta"
            placeholder="1234567"
            inputMode="numeric"
            autoComplete="off"
            maxLength={13}
            value={account}
            onChange={(event) => {
              setAccount(event.target.value.replace(/\D/g, "").slice(0, 13));
              setResult(null);
            }}
            error={errors.account}
          />
          <TextField
            id="validador-conta-bancaria-digito"
            label="Dígito"
            placeholder="0"
            autoComplete="off"
            maxLength={2}
            value={accountDigit}
            onChange={(event) => {
              setAccountDigit(event.target.value.toUpperCase().slice(0, 2));
              setResult(null);
            }}
            error={errors.accountDigit}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit">Validar conta</Button>
          <Button type="button" variant="secondary" onClick={handleClear}>
            Limpar
          </Button>
        </div>
      </form>

      {result !== null ? (
        <div className="mt-6">
          <ValidatorResult
            valid={result}
            validLabel="Formato de conta válido"
            invalidLabel="Formato de conta inválido"
            detail="A validação completa do dígito da conta pode variar conforme a instituição financeira: esta ferramenta confere apenas se banco, agência, conta e dígito foram preenchidos em um formato compatível — não confirma que a conta exista ou esteja ativa."
          />
        </div>
      ) : null}
    </div>
  );
}
