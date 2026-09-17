"use client";

import { useState, type FormEvent } from "react";
import { TextField } from "@/components/forms/TextField";
import { SelectField } from "@/components/forms/SelectField";
import { Button } from "@/components/ui/Button";
import { ValidatorResult } from "@/components/tools/validator-shared/ValidatorResult";
import { ValidatorPrivacyNotice } from "@/components/tools/validator-shared/ValidatorPrivacyNotice";
import { BRAZILIAN_STATES } from "@/lib/data/brazilian-states";
import { validateStateTaxIdFormat } from "@/lib/validators/state-tax-id";

/**
 * Validador de Inscrição Estadual (categoria Validadores). Cada um dos 26
 * estados + DF define seu próprio formato e algoritmo de dígito
 * verificador, de forma independente — não existe uma Receita Estadual
 * única. Por isso esta ferramenta confere apenas o FORMATO geral (UF
 * selecionada + quantidade de dígitos compatível), nunca um dígito
 * verificador específico de UF, para não inventar um algoritmo incorreto.
 */
export function ValidadorInscricaoEstadualTool() {
  const [uf, setUf] = useState(BRAZILIAN_STATES[0].uf);
  const [value, setValue] = useState("");
  const [result, setResult] = useState<boolean | null>(null);

  function runValidation(current: string, currentUf: string) {
    if (current.replace(/\D/g, "").length === 0) {
      setResult(null);
      return;
    }
    setResult(validateStateTaxIdFormat(currentUf, current).valid);
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
        Não existe um algoritmo de dígito verificador de Inscrição Estadual
        único para todos os estados. Esta ferramenta confere apenas o
        formato geral do número para a UF selecionada.
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <SelectField
            id="validador-inscricao-estadual-uf"
            label="Estado (UF)"
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
            id="validador-inscricao-estadual-input"
            label="Inscrição Estadual"
            placeholder="000000000"
            inputMode="numeric"
            autoComplete="off"
            maxLength={16}
            value={value}
            onChange={(event) => {
              setValue(event.target.value.replace(/[^0-9./-]/g, "").slice(0, 16));
              setResult(null);
            }}
            hint="Somente números, ou com a pontuação usada pelo seu estado."
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit">Validar Inscrição Estadual</Button>
          <Button type="button" variant="secondary" onClick={handleClear}>
            Limpar
          </Button>
        </div>
      </form>

      {result !== null ? (
        <div className="mt-6">
          <ValidatorResult
            valid={result}
            validLabel="Formato de Inscrição Estadual válido"
            invalidLabel="Formato de Inscrição Estadual inválido"
            detail="Esta ferramenta confere apenas se a quantidade de dígitos é compatível com a UF selecionada — não o dígito verificador oficial de cada estado, que ainda não está implementado, nem confirma que a inscrição existe ou está ativa na Secretaria da Fazenda."
          />
        </div>
      ) : null}
    </div>
  );
}
