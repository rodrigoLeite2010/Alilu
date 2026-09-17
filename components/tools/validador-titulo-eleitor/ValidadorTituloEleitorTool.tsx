"use client";

import { useState, type FormEvent } from "react";
import { TextField } from "@/components/forms/TextField";
import { Button } from "@/components/ui/Button";
import { ValidatorResult } from "@/components/tools/validator-shared/ValidatorResult";
import { ValidatorPrivacyNotice } from "@/components/tools/validator-shared/ValidatorPrivacyNotice";
import { isValidVoterId, VOTER_ID_STATES } from "@/lib/calculators/voter-id-generator";

/**
 * Validador de Título de Eleitor (categoria Validadores). Verifica apenas
 * se os dois dígitos verificadores estão matematicamente corretos
 * (reaproveitando isValidVoterId e VOTER_ID_STATES, já usados pelo Gerador
 * de Título de Eleitor) — NUNCA consulta o TSE nem o cadastro de
 * eleitores. O código de UF já faz parte dos 12 dígitos do próprio número,
 * por isso não é preciso selecionar o estado à parte.
 */
function maskVoterIdInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 12);
  return [digits.slice(0, 4), digits.slice(4, 8), digits.slice(8, 12)]
    .filter(Boolean)
    .join(" ");
}
export function ValidadorTituloEleitorTool() {
  const [value, setValue] = useState("");
  const [result, setResult] = useState<boolean | null>(null);
  const [detectedState, setDetectedState] = useState<string | null>(null);

  function runValidation(current: string) {
    const digits = current.replace(/\D/g, "");
    if (digits.length === 0) {
      setResult(null);
      setDetectedState(null);
      return;
    }
    const valid = isValidVoterId(digits);
    setResult(valid);

    if (valid && digits.length === 12) {
      const stateCode = digits.slice(8, 10);
      const state = VOTER_ID_STATES.find((s) => s.code === stateCode);
      setDetectedState(state ? `${state.name} (${state.uf})` : null);
    } else {
      setDetectedState(null);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runValidation(value);
  }

  function handleClear() {
    setValue("");
    setResult(null);
    setDetectedState(null);
  }

  return (
    <div>
      <ValidatorPrivacyNotice />

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <TextField
          id="validador-titulo-eleitor-input"
          label="Número do Título de Eleitor"
          placeholder="0000 0000 0000"
          inputMode="numeric"
          autoComplete="off"
          maxLength={14}
          value={value}
          onChange={(event) => {
            setValue(maskVoterIdInput(event.target.value));
            setResult(null);
            setDetectedState(null);
          }}
          hint="12 dígitos, com ou sem espaços."
        />

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit">Validar Título de Eleitor</Button>
          <Button type="button" variant="secondary" onClick={handleClear}>
            Limpar
          </Button>
        </div>
      </form>

      {result !== null ? (
        <div className="mt-6">
          <ValidatorResult
            valid={result}
            validLabel="Título de Eleitor válido"
            invalidLabel="Título de Eleitor inválido"
            detail={
              result
                ? `Isso confirma apenas que os dígitos verificadores estão matematicamente corretos — não que o título existe ou está ativo no TSE.${
                    detectedState ? ` UF identificada pelo código do número: ${detectedState}.` : ""
                  }`
                : "Confira se o número tem 12 dígitos completos (sequencial + código da UF + dois dígitos verificadores)."
            }
          />
        </div>
      ) : null}
    </div>
  );
}
