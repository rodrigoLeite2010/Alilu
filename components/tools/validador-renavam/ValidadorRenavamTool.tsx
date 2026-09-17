"use client";

import { useState, type FormEvent } from "react";
import { TextField } from "@/components/forms/TextField";
import { Button } from "@/components/ui/Button";
import { ValidatorResult } from "@/components/tools/validator-shared/ValidatorResult";
import { ValidatorPrivacyNotice } from "@/components/tools/validator-shared/ValidatorPrivacyNotice";
import { isValidRenavam, formatGeneratedRenavam } from "@/lib/calculators/renavam-generator";

/**
 * Validador de RENAVAM (categoria Validadores). Verifica apenas se o
 * dígito verificador está matematicamente correto (reaproveitando
 * isValidRenavam e formatGeneratedRenavam, já usados pelo Gerador de
 * RENAVAM) — NUNCA consulta o DETRAN nem a Base Índice Nacional de
 * Veículos (BIN).
 */
export function ValidadorRenavamTool() {
  const [value, setValue] = useState("");
  const [result, setResult] = useState<boolean | null>(null);

  function runValidation(current: string) {
    const digits = current.replace(/\D/g, "");
    if (digits.length === 0) {
      setResult(null);
      return;
    }
    setResult(isValidRenavam(digits));
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
          id="validador-renavam-input"
          label="RENAVAM"
          placeholder="0000000000-0"
          inputMode="numeric"
          autoComplete="off"
          maxLength={12}
          value={value}
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, "").slice(0, 11);
            setValue(digits.length > 10 ? formatGeneratedRenavam(digits) : digits);
            setResult(null);
          }}
          hint="11 dígitos. Se o formato não for compatível, mostramos uma mensagem clara."
        />

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit">Validar RENAVAM</Button>
          <Button type="button" variant="secondary" onClick={handleClear}>
            Limpar
          </Button>
        </div>
      </form>

      {result !== null ? (
        <div className="mt-6">
          <ValidatorResult
            valid={result}
            validLabel="RENAVAM válido"
            invalidLabel="RENAVAM inválido"
            detail={
              result
                ? "Isso confirma apenas que o dígito verificador está matematicamente correto — não que o veículo existe ou está regularizado no DETRAN."
                : "Confira se o número tem 11 dígitos. O RENAVAM não tem um formato compatível diferente disso — sem 11 dígitos, o dígito verificador não pode ser conferido."
            }
          />
        </div>
      ) : null}
    </div>
  );
}
