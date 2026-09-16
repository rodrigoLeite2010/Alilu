"use client";

import { useState, type FormEvent } from "react";
import { TextField } from "@/components/forms/TextField";
import { NumberField } from "@/components/forms/NumberField";
import { SelectField } from "@/components/forms/SelectField";
import { Button } from "@/components/ui/Button";
import {
  centsDigitsToAmount,
  formatCurrencyBRL,
} from "@/lib/formatters/currency";
import { parseLocaleNumberBRL } from "@/lib/validators/number";
import {
  calculateCompoundInterest,
  validateCompoundInterestInput,
  type CompoundInterestFieldErrors,
  type CompoundInterestInput,
  type CompoundInterestPeriodType,
  type CompoundInterestRateType,
  type CompoundInterestResult,
} from "@/lib/calculators/compound-interest";

/**
 * Formulário da Calculadora de Juros Compostos. Todo o cálculo acontece no
 * navegador (lib/calculators/compound-interest.ts) — nenhum valor digitado
 * é enviado para servidor, salvo em cookies ou em localStorage/sessionStorage.
 */
export function CompoundInterestForm({
  onCalculate,
}: {
  onCalculate: (result: CompoundInterestResult) => void;
}) {
  const [initialAmountDigits, setInitialAmountDigits] = useState("");
  const [contributionDigits, setContributionDigits] = useState("");
  const [rateText, setRateText] = useState("");
  const [rateType, setRateType] = useState<CompoundInterestRateType>("mensal");
  const [periodText, setPeriodText] = useState("");
  const [periodType, setPeriodType] =
    useState<CompoundInterestPeriodType>("meses");
  const [errors, setErrors] = useState<CompoundInterestFieldErrors>({});

  function clearError(field: keyof CompoundInterestFieldErrors) {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const input: CompoundInterestInput = {
      initialAmount: centsDigitsToAmount(initialAmountDigits),
      monthlyContribution: centsDigitsToAmount(contributionDigits),
      rate: parseLocaleNumberBRL(rateText) ?? NaN,
      rateType,
      period: parseLocaleNumberBRL(periodText) ?? NaN,
      periodType,
    };

    const nextErrors = validateCompoundInterestInput(input);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    onCalculate(calculateCompoundInterest(input));
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <TextField
        id="compound-interest-initial-amount"
        label="Valor inicial"
        inputMode="decimal"
        placeholder="R$ 0,00"
        hint={!errors.initialAmount ? "Pode ser zero se houver aporte mensal" : undefined}
        value={
          initialAmountDigits
            ? formatCurrencyBRL(centsDigitsToAmount(initialAmountDigits))
            : ""
        }
        onChange={(event) => {
          setInitialAmountDigits(
            event.target.value.replace(/\D/g, "").slice(0, 12)
          );
          clearError("initialAmount");
        }}
        error={errors.initialAmount}
      />

      <TextField
        id="compound-interest-contribution"
        label="Aporte mensal"
        inputMode="decimal"
        placeholder="R$ 0,00"
        hint="Opcional"
        value={
          contributionDigits
            ? formatCurrencyBRL(centsDigitsToAmount(contributionDigits))
            : ""
        }
        onChange={(event) => {
          setContributionDigits(
            event.target.value.replace(/\D/g, "").slice(0, 12)
          );
          clearError("monthlyContribution");
        }}
        error={errors.monthlyContribution}
      />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <NumberField
          id="compound-interest-rate"
          label="Taxa de juros"
          suffix="%"
          placeholder="0,00"
          value={rateText}
          onChange={(event) => {
            setRateText(event.target.value);
            clearError("rate");
          }}
          error={errors.rate}
        />

        <SelectField
          id="compound-interest-rate-type"
          label="Tipo da taxa"
          value={rateType}
          onChange={(event) =>
            setRateType(event.target.value as CompoundInterestRateType)
          }
        >
          <option value="mensal">Mensal</option>
          <option value="anual">Anual</option>
        </SelectField>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <NumberField
          id="compound-interest-period"
          label="Período"
          suffix={periodType === "meses" ? "meses" : "anos"}
          placeholder="0"
          value={periodText}
          onChange={(event) => {
            setPeriodText(event.target.value);
            clearError("period");
          }}
          error={errors.period}
        />

        <SelectField
          id="compound-interest-period-type"
          label="Tipo do período"
          value={periodType}
          onChange={(event) =>
            setPeriodType(event.target.value as CompoundInterestPeriodType)
          }
        >
          <option value="meses">Meses</option>
          <option value="anos">Anos</option>
        </SelectField>
      </div>

      <Button type="submit" className="w-full sm:w-auto">
        Calcular
      </Button>
    </form>
  );
}
