"use client";

import { useState, type FormEvent } from "react";
import { TextField } from "@/components/forms/TextField";
import { NumberField } from "@/components/forms/NumberField";
import { Button } from "@/components/ui/Button";
import { ResultHighlight } from "@/components/results/ResultHighlight";
import { formatCurrencyBRL, centsDigitsToAmount } from "@/lib/formatters/currency";
import { parseLocaleNumberBRL } from "@/lib/validators/number";
import {
  calculateMaxInstallmentByIncome,
  validateMaxInstallmentByIncomeInput,
  type MaxInstallmentByIncomeFieldErrors,
  type MaxInstallmentByIncomeInput,
  type MaxInstallmentByIncomeResult,
} from "@/lib/calculators/vehicle-financing";

/**
 * "Parcela máxima pela renda" (cluster Financiamento de Veículos). Aplica a
 * regra prática de orçamento (renda x percentual comprometido, descontando
 * outras dívidas já existentes) para sugerir um teto de parcela — NUNCA uma
 * aprovação de crédito, que depende de análise da instituição financeira e
 * de critérios que esta calculadora não conhece.
 */
export function ParcelaMaximaPelaRendaTool() {
  const [monthlyIncomeDigits, setMonthlyIncomeDigits] = useState("");
  const [commitmentPercentText, setCommitmentPercentText] = useState("30");
  const [otherDebtsDigits, setOtherDebtsDigits] = useState("");
  const [errors, setErrors] = useState<MaxInstallmentByIncomeFieldErrors>({});
  const [result, setResult] = useState<MaxInstallmentByIncomeResult | null>(null);

  function clearError(field: keyof MaxInstallmentByIncomeFieldErrors) {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function handleClear() {
    setMonthlyIncomeDigits("");
    setCommitmentPercentText("30");
    setOtherDebtsDigits("");
    setErrors({});
    setResult(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const input: MaxInstallmentByIncomeInput = {
      monthlyIncome: centsDigitsToAmount(monthlyIncomeDigits),
      commitmentPercent: parseLocaleNumberBRL(commitmentPercentText) ?? NaN,
      otherMonthlyDebts: otherDebtsDigits ? centsDigitsToAmount(otherDebtsDigits) : 0,
    };

    const nextErrors = validateMaxInstallmentByIncomeInput(input);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setResult(null);
      return;
    }

    setResult(calculateMaxInstallmentByIncome(input));
  }

  return (
    <div>
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <TextField
          id="parcela-max-renda"
          label="Renda mensal"
          inputMode="decimal"
          placeholder="R$ 0,00"
          value={monthlyIncomeDigits ? formatCurrencyBRL(centsDigitsToAmount(monthlyIncomeDigits)) : ""}
          onChange={(event) => {
            setMonthlyIncomeDigits(event.target.value.replace(/\D/g, "").slice(0, 12));
            clearError("monthlyIncome");
          }}
          error={errors.monthlyIncome}
        />

        <NumberField
          id="parcela-max-percentual"
          label="Percentual da renda a comprometer"
          suffix="%"
          placeholder="30"
          hint="Referência comum: entre 20% e 30% da renda mensal"
          value={commitmentPercentText}
          onChange={(event) => {
            setCommitmentPercentText(event.target.value);
            clearError("commitmentPercent");
          }}
          error={errors.commitmentPercent}
        />

        <TextField
          id="parcela-max-outras-dividas"
          label="Outras dívidas/parcelas mensais já comprometidas"
          inputMode="decimal"
          placeholder="R$ 0,00"
          hint="Opcional"
          value={otherDebtsDigits ? formatCurrencyBRL(centsDigitsToAmount(otherDebtsDigits)) : ""}
          onChange={(event) => {
            setOtherDebtsDigits(event.target.value.replace(/\D/g, "").slice(0, 12));
            clearError("otherMonthlyDebts");
          }}
          error={errors.otherMonthlyDebts}
        />

        <div className="flex flex-wrap gap-3">
          <Button type="submit">Calcular</Button>
          <Button type="button" variant="secondary" onClick={handleClear}>
            Limpar
          </Button>
        </div>
      </form>

      {result ? (
        <div className="mt-8 space-y-6">
          <ResultHighlight
            label="Parcela máxima recomendada"
            value={formatCurrencyBRL(result.maxInstallment)}
          />

          {result.debtsExceedBudget ? (
            <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
              Suas outras dívidas mensais já consomem todo (ou mais que todo) o orçamento
              considerado saudável para o percentual informado — por isso a parcela recomendada
              para o carro ficou em R$ 0,00. Considere reduzir o percentual comprometido com
              outras dívidas antes de assumir um novo financiamento.
            </p>
          ) : (
            <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
              Este é um valor de referência com base numa regra prática de orçamento — não é uma
              aprovação de crédito. A aprovação e o valor real da parcela dependem de análise da
              instituição financeira.
            </p>
          )}

          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-zinc-200 p-3">
              <dt className="text-xs text-zinc-500">Orçamento antes de outras dívidas</dt>
              <dd className="mt-1 text-sm font-semibold text-zinc-900">
                {formatCurrencyBRL(result.budgetBeforeDebts)}
              </dd>
            </div>
            <div className="rounded-lg border border-zinc-200 p-3">
              <dt className="text-xs text-zinc-500">Parcela máxima recomendada</dt>
              <dd className="mt-1 text-sm font-semibold text-zinc-900">
                {formatCurrencyBRL(result.maxInstallment)}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}
    </div>
  );
}
