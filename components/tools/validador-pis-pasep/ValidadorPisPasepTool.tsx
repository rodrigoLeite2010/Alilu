"use client";

import { useState, type FormEvent } from "react";
import { TextField } from "@/components/forms/TextField";
import { Button } from "@/components/ui/Button";
import { ValidatorResult } from "@/components/tools/validator-shared/ValidatorResult";
import { ValidatorPrivacyNotice } from "@/components/tools/validator-shared/ValidatorPrivacyNotice";
import { isValidPisPasep } from "@/lib/calculators/pis-pasep-generator";

/**
 * Validador de PIS/PASEP (categoria Validadores). Verifica apenas se o
 * dígito verificador está matematicamente correto pelo algoritmo oficial de
 * módulo 11 (reaproveitando isValidPisPasep, já usado pelo Gerador de
 * PIS/PASEP) — NUNCA consulta a Caixa Econômica Federal nem o eSocial.
 */
function maskPisInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  const p1 = digits.slice(0, 3);
  const p2 = digits.slice(3, 8);
  const p3 = digits.slice(8, 10);
  const p4 = digits.slice(10, 11);

  let out = p1;
  if (p2) out += `.${p2}`;
  if (p3) out += `.${p3}`;
  if (p4) out += `-${p4}`;
  return out;
}
export function ValidadorPisPasepTool() {
  const [value, setValue] = useState("");
  const [result, setResult] = useState<boolean | null>(null);

  function runValidation(current: string) {
    const digits = current.replace(/\D/g, "");
    if (digits.length === 0) {
      setResult(null);
      return;
    }
    setResult(isValidPisPasep(digits));
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
          id="validador-pis-pasep-input"
          label="PIS/PASEP"
          placeholder="000.00000.00-0"
          inputMode="numeric"
          autoComplete="off"
          maxLength={14}
          value={value}
          onChange={(event) => {
            setValue(maskPisInput(event.target.value));
            setResult(null);
          }}
          hint="11 dígitos, com ou sem pontuação."
        />

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit">Validar PIS/PASEP</Button>
          <Button type="button" variant="secondary" onClick={handleClear}>
            Limpar
          </Button>
        </div>
      </form>

      {result !== null ? (
        <div className="mt-6">
          <ValidatorResult
            valid={result}
            validLabel="PIS/PASEP válido"
            invalidLabel="PIS/PASEP inválido"
            detail="Isso confirma apenas que o dígito verificador está matematicamente correto — não que o número exista ou pertença a um trabalhador real."
          />
        </div>
      ) : null}
    </div>
  );
}
