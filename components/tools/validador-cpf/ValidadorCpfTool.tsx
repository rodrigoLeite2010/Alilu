"use client";

import { useState, type FormEvent } from "react";
import { TextField } from "@/components/forms/TextField";
import { Button } from "@/components/ui/Button";
import { ValidatorResult } from "@/components/tools/validator-shared/ValidatorResult";
import { ValidatorPrivacyNotice } from "@/components/tools/validator-shared/ValidatorPrivacyNotice";
import { isValidCPF, onlyDigits, formatCpfCnpjMask } from "@/lib/validators/document";

/**
 * Validador de CPF (categoria Validadores). Verifica apenas se os dois
 * dígitos verificadores estão matematicamente corretos pelo algoritmo
 * oficial de módulo 11 (reaproveitando isValidCPF, já usado pelo Gerador
 * de CPF e pelo campo de CPF/CNPJ do Gerador de Recibo) — NUNCA consulta a
 * Receita Federal nem confirma que o CPF existe, está ativo ou pertence a
 * uma pessoa. Validação 100% local, nada é armazenado ou enviado.
 */
export function ValidadorCpfTool() {
  const [value, setValue] = useState("");
  const [result, setResult] = useState<boolean | null>(null);

  function runValidation(current: string) {
    if (onlyDigits(current).length === 0) {
      setResult(null);
      return;
    }
    setResult(isValidCPF(current));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runValidation(value);
  }

  function handleClear() {
    setValue("");
    setResult(null);
  }

  return (
    <div>
      <ValidatorPrivacyNotice />

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <TextField
          id="validador-cpf-input"
          label="CPF"
          placeholder="000.000.000-00"
          inputMode="numeric"
          autoComplete="off"
          maxLength={14}
          value={value}
          onChange={(event) => {
            setValue(formatCpfCnpjMask(event.target.value));
            setResult(null);
          }}
          hint="Digite com ou sem pontuação — a máscara é aplicada automaticamente."
        />

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit">Validar CPF</Button>
          <Button type="button" variant="secondary" onClick={handleClear}>
            Limpar
          </Button>
        </div>
      </form>

      {result !== null ? (
        <div className="mt-6">
          <ValidatorResult
            valid={result}
            validLabel="CPF válido"
            invalidLabel="CPF inválido"
            detail="Isso confirma apenas que os dígitos verificadores estão matematicamente corretos — não que o CPF existe, está ativo ou pertence a uma pessoa específica na Receita Federal."
          />
        </div>
      ) : null}
    </div>
  );
}
