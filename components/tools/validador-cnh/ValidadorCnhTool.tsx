"use client";

import { useState, type FormEvent } from "react";
import { TextField } from "@/components/forms/TextField";
import { Button } from "@/components/ui/Button";
import { ValidatorResult } from "@/components/tools/validator-shared/ValidatorResult";
import { ValidatorPrivacyNotice } from "@/components/tools/validator-shared/ValidatorPrivacyNotice";
import { isValidCnh, formatGeneratedCnh } from "@/lib/calculators/cnh-generator";

/**
 * Validador de CNH (categoria Validadores). Verifica apenas se os dois
 * dígitos verificadores estão matematicamente corretos pelo algoritmo do
 * DENATRAN (reaproveitando isValidCnh e formatGeneratedCnh, já usados pelo
 * Gerador de CNH) — NUNCA consulta o DETRAN nem confirma a situação da CNH.
 */
export function ValidadorCnhTool() {
  const [value, setValue] = useState("");
  const [result, setResult] = useState<boolean | null>(null);

  function runValidation(current: string) {
    const digits = current.replace(/\D/g, "");
    if (digits.length === 0) {
      setResult(null);
      return;
    }
    setResult(isValidCnh(digits));
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

      <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        Esta ferramenta verifica apenas a estrutura do número informado e não
        consulta a situação da CNH junto ao DETRAN.
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <TextField
          id="validador-cnh-input"
          label="Número da CNH"
          placeholder="00000000000"
          inputMode="numeric"
          autoComplete="off"
          maxLength={12}
          value={value}
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, "").slice(0, 11);
            setValue(digits.length > 9 ? formatGeneratedCnh(digits) : digits);
            setResult(null);
          }}
          hint="11 dígitos, com ou sem hífen."
        />

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit">Validar CNH</Button>
          <Button type="button" variant="secondary" onClick={handleClear}>
            Limpar
          </Button>
        </div>
      </form>

      {result !== null ? (
        <div className="mt-6">
          <ValidatorResult
            valid={result}
            validLabel="CNH válida"
            invalidLabel="CNH inválida"
            detail="Isso confirma apenas que os dígitos verificadores estão matematicamente corretos — não a situação da habilitação (ativa, suspensa, cassada etc.) junto ao DETRAN."
          />
        </div>
      ) : null}
    </div>
  );
}
