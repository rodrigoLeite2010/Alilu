"use client";

import { useState, type FormEvent } from "react";
import { TextField } from "@/components/forms/TextField";
import { Button } from "@/components/ui/Button";
import { ValidatorResult } from "@/components/tools/validator-shared/ValidatorResult";
import { ValidatorPrivacyNotice } from "@/components/tools/validator-shared/ValidatorPrivacyNotice";
import { isValidCNPJ, onlyDigits, formatCpfCnpjMask } from "@/lib/validators/document";

/**
 * Validador de CNPJ (categoria Validadores). Verifica apenas se os dois
 * dígitos verificadores estão matematicamente corretos (reaproveitando
 * isValidCNPJ, já usado pelo Gerador de CNPJ) — NUNCA consulta a Receita
 * Federal nem confirma que o CNPJ existe, está ativo ou pertence a uma
 * empresa específica. Validação 100% local, nada é armazenado ou enviado.
 */
export function ValidadorCnpjTool() {
  const [value, setValue] = useState("");
  const [result, setResult] = useState<boolean | null>(null);

  function runValidation(current: string) {
    if (onlyDigits(current).length === 0) {
      setResult(null);
      return;
    }
    setResult(isValidCNPJ(current));
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
          id="validador-cnpj-input"
          label="CNPJ"
          placeholder="00.000.000/0000-00"
          inputMode="numeric"
          autoComplete="off"
          maxLength={18}
          value={value}
          onChange={(event) => {
            setValue(formatCpfCnpjMask(event.target.value));
            setResult(null);
          }}
          hint="Digite com ou sem pontuação — a máscara é aplicada automaticamente."
        />

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit">Validar CNPJ</Button>
          <Button type="button" variant="secondary" onClick={handleClear}>
            Limpar
          </Button>
        </div>
      </form>

      {result !== null ? (
        <div className="mt-6">
          <ValidatorResult
            valid={result}
            validLabel="CNPJ válido"
            invalidLabel="CNPJ inválido"
            detail="Isso confirma apenas que os dígitos verificadores estão matematicamente corretos — não que o CNPJ existe, está ativo ou pertence a uma empresa específica na Receita Federal."
          />
        </div>
      ) : null}
    </div>
  );
}
