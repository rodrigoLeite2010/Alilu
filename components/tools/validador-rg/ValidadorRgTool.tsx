"use client";

import { useState, type FormEvent } from "react";
import { TextField } from "@/components/forms/TextField";
import { SelectField } from "@/components/forms/SelectField";
import { Button } from "@/components/ui/Button";
import { ValidatorResult } from "@/components/tools/validator-shared/ValidatorResult";
import { ValidatorPrivacyNotice } from "@/components/tools/validator-shared/ValidatorPrivacyNotice";
import { BRAZILIAN_STATES } from "@/lib/data/brazilian-states";
import { validateRg } from "@/lib/validators/rg";

/**
 * Validador de RG (categoria Validadores). O RG não tem um padrão nacional
 * único — cada Secretaria de Segurança Pública estadual define seu próprio
 * formato. Para São Paulo, aplicamos o padrão de cálculo mais comumente
 * usado por validadores públicos para o dígito verificador (reaproveitando
 * validateRg/isValidRgSP, que por sua vez reaproveita calculateRgCheckDigit
 * já usado pelo Gerador de RG). Para as demais UFs, confere-se apenas o
 * formato geral — nunca inventamos um dígito verificador para um estado
 * sem algoritmo publicamente documentado.
 */
function maskRgInput(value: string): string {
  const clean = value.trim().toUpperCase().replace(/[^0-9X]/g, "").slice(0, 9);
  const p1 = clean.slice(0, 2);
  const p2 = clean.slice(2, 5);
  const p3 = clean.slice(5, 8);
  const p4 = clean.slice(8, 9);

  let out = p1;
  if (p2) out += `.${p2}`;
  if (p3) out += `.${p3}`;
  if (p4) out += `-${p4}`;
  return out;
}

export function ValidadorRgTool() {
  const [uf, setUf] = useState("SP");
  const [value, setValue] = useState("");
  const [result, setResult] = useState<boolean | null>(null);

  function runValidation(current: string, currentUf: string) {
    if (current.replace(/[^0-9X]/gi, "").length === 0) {
      setResult(null);
      return;
    }
    setResult(validateRg(current, currentUf).valid);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runValidation(value, uf);
  }

  function handleClear() {
    setValue("");
    setResult(null);
  }

  return (
    <div>
      <ValidatorPrivacyNotice />

      <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        Não existe um algoritmo nacional único de RG. Para São Paulo,
        aplicamos o padrão de cálculo do dígito verificador mais usado por
        validadores públicos; para as demais UFs, conferimos apenas o
        formato geral do número.
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <SelectField
            id="validador-rg-uf"
            label="Estado (UF) de emissão"
            value={uf}
            onChange={(event) => {
              setUf(event.target.value);
              setResult(null);
            }}
          >
            {BRAZILIAN_STATES.map((state) => (
              <option key={state.uf} value={state.uf}>
                {state.name}
              </option>
            ))}
          </SelectField>
          <TextField
            id="validador-rg-input"
            label="Número do RG"
            placeholder="00.000.000-0"
            autoComplete="off"
            maxLength={12}
            value={value}
            onChange={(event) => {
              setValue(maskRgInput(event.target.value));
              setResult(null);
            }}
            hint="Com ou sem pontuação. O último caractere pode ser X."
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit">Validar RG</Button>
          <Button type="button" variant="secondary" onClick={handleClear}>
            Limpar
          </Button>
        </div>
      </form>

      {result !== null ? (
        <div className="mt-6">
          <ValidatorResult
            valid={result}
            validLabel="RG válido"
            invalidLabel="RG inválido"
            detail={
              uf === "SP"
                ? "Isso confirma apenas que o número segue o padrão de dígito verificador mais usado por validadores públicos para São Paulo — não é uma confirmação de um documento real junto à SSP-SP."
                : "Para esta UF, só é possível conferir o formato geral do número (não existe um algoritmo de dígito verificador público e unificado para todos os estados) — isso não confirma que o documento existe."
            }
          />
        </div>
      ) : null}
    </div>
  );
}
