"use client";

import { useState, type FormEvent } from "react";
import { NumberField } from "@/components/forms/NumberField";
import { SelectField } from "@/components/forms/SelectField";
import { Button } from "@/components/ui/Button";
import { parseLocaleNumberBRL } from "@/lib/validators/number";
import {
  calculatePercentage,
  validatePercentageInput,
  type PercentageFieldErrors,
  type PercentageInput,
  type PercentageMode,
  type PercentageResult,
} from "@/lib/calculators/percentage";

const MODE_LABELS: Record<PercentageMode, string> = {
  "percent-of": "X% de Y",
  "what-percent": "X é quantos % de Y",
  increase: "Aumentar Y em X%",
  decrease: "Reduzir Y em X%",
  variation: "Variação percentual entre dois valores",
};

/**
 * Formulário da Calculadora de Porcentagem. Todo o cálculo acontece no
 * navegador (lib/calculators/percentage.ts) — nenhum valor digitado é
 * enviado para servidor, salvo em cookies ou em localStorage/sessionStorage.
 */
export function PercentageForm({
  onCalculate,
}: {
  onCalculate: (result: PercentageResult) => void;
}) {
  const [mode, setMode] = useState<PercentageMode>("percent-of");
  const [percentText, setPercentText] = useState("");
  const [baseText, setBaseText] = useState("");
  const [partText, setPartText] = useState("");
  const [fromText, setFromText] = useState("");
  const [toText, setToText] = useState("");
  const [errors, setErrors] = useState<PercentageFieldErrors>({});

  function clearError(field: keyof PercentageFieldErrors) {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const input: PercentageInput = {
      mode,
      percent: parseLocaleNumberBRL(percentText) ?? NaN,
      base: parseLocaleNumberBRL(baseText) ?? NaN,
      part: parseLocaleNumberBRL(partText) ?? NaN,
      fromValue: parseLocaleNumberBRL(fromText) ?? NaN,
      toValue: parseLocaleNumberBRL(toText) ?? NaN,
    };

    const nextErrors = validatePercentageInput(input);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    onCalculate(calculatePercentage(input));
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <SelectField
        id="percentage-mode"
        label="O que você quer calcular?"
        value={mode}
        onChange={(event) => {
          setMode(event.target.value as PercentageMode);
          setErrors({});
        }}
      >
        {Object.entries(MODE_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </SelectField>

      {(mode === "percent-of" || mode === "increase" || mode === "decrease") && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <NumberField
            id="percentage-percent"
            label="Percentual (X)"
            suffix="%"
            placeholder="0"
            value={percentText}
            onChange={(event) => {
              setPercentText(event.target.value);
              clearError("percent");
            }}
            error={errors.percent}
          />
          <NumberField
            id="percentage-base"
            label="Valor (Y)"
            placeholder="0"
            value={baseText}
            onChange={(event) => {
              setBaseText(event.target.value);
              clearError("base");
            }}
            error={errors.base}
          />
        </div>
      )}

      {mode === "what-percent" && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <NumberField
            id="percentage-part"
            label="Valor (X)"
            placeholder="0"
            value={partText}
            onChange={(event) => {
              setPartText(event.target.value);
              clearError("part");
            }}
            error={errors.part}
          />
          <NumberField
            id="percentage-base-2"
            label="Valor de referência (Y)"
            placeholder="0"
            value={baseText}
            onChange={(event) => {
              setBaseText(event.target.value);
              clearError("base");
            }}
            error={errors.base}
          />
        </div>
      )}

      {mode === "variation" && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <NumberField
            id="percentage-from"
            label="Valor inicial"
            placeholder="0"
            value={fromText}
            onChange={(event) => {
              setFromText(event.target.value);
              clearError("fromValue");
            }}
            error={errors.fromValue}
          />
          <NumberField
            id="percentage-to"
            label="Valor final"
            placeholder="0"
            value={toText}
            onChange={(event) => {
              setToText(event.target.value);
              clearError("toValue");
            }}
            error={errors.toValue}
          />
        </div>
      )}

      <Button type="submit" className="w-full sm:w-auto">
        Calcular
      </Button>
    </form>
  );
}
