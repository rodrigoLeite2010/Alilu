"use client";

import { useState, type FormEvent } from "react";
import { TextField } from "@/components/forms/TextField";
import { NumberField } from "@/components/forms/NumberField";
import { SelectField } from "@/components/forms/SelectField";
import { Button } from "@/components/ui/Button";
import { ResultHighlight } from "@/components/results/ResultHighlight";
import { centsDigitsToAmount, formatCurrencyBRL } from "@/lib/formatters/currency";
import { parseLocaleNumberBRL } from "@/lib/validators/number";
import type { CompoundInterestRateType } from "@/lib/calculators/compound-interest";
import {
  calculateSavingsGoal,
  validateSavingsGoalInput,
  type SavingsGoalFieldErrors,
  type SavingsGoalInput,
  type SavingsGoalResult,
} from "@/lib/calculators/savings-goal";

type PeriodType = "meses" | "anos";

/**
 * Componente principal de "Quanto Guardar por Mês". Reaproveita o motor de
 * juros compostos (lib/calculators/compound-interest.ts, via
 * lib/calculators/savings-goal.ts) em vez de duplicar a conversão de taxa e
 * a convenção de aporte ao final do mês (PROMPT MESTRE, "Quanto Guardar por
 * Mês": "Reaproveitar motor de juros compostos").
 */
export function SavingsGoalTool() {
  const [goalDigits, setGoalDigits] = useState("");
  const [initialDigits, setInitialDigits] = useState("");
  const [periodText, setPeriodText] = useState("");
  const [periodType, setPeriodType] = useState<PeriodType>("meses");
  const [rateText, setRateText] = useState("");
  const [rateType, setRateType] = useState<CompoundInterestRateType>("mensal");
  const [errors, setErrors] = useState<SavingsGoalFieldErrors>({});
  const [result, setResult] = useState<SavingsGoalResult | null>(null);

  function clearError(field: keyof SavingsGoalFieldErrors) {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const input: SavingsGoalInput = {
      goal: centsDigitsToAmount(goalDigits),
      initialAmount: initialDigits ? centsDigitsToAmount(initialDigits) : 0,
      period: parseLocaleNumberBRL(periodText) ?? NaN,
      periodType,
      rate: rateText ? parseLocaleNumberBRL(rateText) ?? NaN : 0,
      rateType,
    };

    const nextErrors = validateSavingsGoalInput(input);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setResult(null);
      return;
    }

    setResult(calculateSavingsGoal(input));
  }

  return (
    <div>
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <TextField
          id="savings-goal-goal"
          label="Meta financeira"
          inputMode="decimal"
          placeholder="R$ 0,00"
          value={goalDigits ? formatCurrencyBRL(centsDigitsToAmount(goalDigits)) : ""}
          onChange={(event) => {
            setGoalDigits(event.target.value.replace(/\D/g, "").slice(0, 12));
            clearError("goal");
          }}
          error={errors.goal}
        />

        <TextField
          id="savings-goal-initial"
          label="Valor já disponível"
          inputMode="decimal"
          placeholder="R$ 0,00"
          hint="Opcional"
          value={initialDigits ? formatCurrencyBRL(centsDigitsToAmount(initialDigits)) : ""}
          onChange={(event) => {
            setInitialDigits(event.target.value.replace(/\D/g, "").slice(0, 12));
            clearError("initialAmount");
          }}
          error={errors.initialAmount}
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <NumberField
            id="savings-goal-period"
            label="Prazo"
            placeholder="0"
            value={periodText}
            onChange={(event) => {
              setPeriodText(event.target.value);
              clearError("period");
            }}
            error={errors.period}
          />
          <SelectField
            id="savings-goal-period-type"
            label="Unidade do prazo"
            value={periodType}
            onChange={(event) => setPeriodType(event.target.value as PeriodType)}
          >
            <option value="meses">Meses</option>
            <option value="anos">Anos</option>
          </SelectField>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <NumberField
            id="savings-goal-rate"
            label="Rentabilidade estimada"
            suffix="%"
            hint="Opcional — deixe em branco para 0%"
            placeholder="0,00"
            value={rateText}
            onChange={(event) => {
              setRateText(event.target.value);
              clearError("rate");
            }}
            error={errors.rate}
          />
          <SelectField
            id="savings-goal-rate-type"
            label="Tipo da taxa"
            value={rateType}
            onChange={(event) => setRateType(event.target.value as CompoundInterestRateType)}
          >
            <option value="mensal">Mensal</option>
            <option value="anual">Anual</option>
          </SelectField>
        </div>

        <Button type="submit" className="w-full sm:w-auto">
          Calcular
        </Button>
      </form>

      {result ? (
        <div className="mt-8 space-y-4">
          <ResultHighlight
            label="Aporte mensal necessário"
            value={formatCurrencyBRL(result.headline)}
          />

          {result.goalAlreadyReachable ? (
            <p className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">
              Com o valor já disponível e a rentabilidade informada, a meta já é
              alcançável dentro do prazo sem novos aportes.
            </p>
          ) : null}

          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-zinc-200 p-3">
              <dt className="text-xs text-zinc-500">Total aportado</dt>
              <dd className="mt-1 text-sm font-semibold text-zinc-900">
                {formatCurrencyBRL(result.totalContributed)}
              </dd>
            </div>
            <div className="rounded-lg border border-zinc-200 p-3">
              <dt className="text-xs text-zinc-500">Rendimento estimado</dt>
              <dd className="mt-1 text-sm font-semibold text-emerald-700">
                {formatCurrencyBRL(Math.max(result.estimatedYield, 0))}
              </dd>
            </div>
            <div className="rounded-lg border border-zinc-200 p-3">
              <dt className="text-xs text-zinc-500">Prazo total</dt>
              <dd className="mt-1 text-sm font-semibold text-zinc-900">
                {result.totalMonths} {result.totalMonths === 1 ? "mês" : "meses"}
              </dd>
            </div>
          </dl>

          <p className="text-xs text-zinc-500">
            Simulação com base em rentabilidade constante e aportes mensais iguais.
            Investimentos reais têm rentabilidade variável, e o resultado real pode ser
            diferente do estimado aqui.
          </p>
        </div>
      ) : null}
    </div>
  );
}
