"use client";

import { useState, type FormEvent } from "react";
import { TextField } from "@/components/forms/TextField";
import { NumberField } from "@/components/forms/NumberField";
import { SelectField } from "@/components/forms/SelectField";
import { Button } from "@/components/ui/Button";
import { ResultHighlight } from "@/components/results/ResultHighlight";
import { formatCurrencyBRL, centsDigitsToAmount, formatPercentage } from "@/lib/formatters/currency";
import { parseLocaleNumberBRL } from "@/lib/validators/number";
import {
  calculateEstimatedCet,
  validateEstimatedCetInput,
  type EstimatedCetFieldErrors,
  type EstimatedCetInput,
  type EstimatedCetResult,
  type FinancingRateType,
} from "@/lib/calculators/vehicle-financing";

/**
 * "CET estimado" (cluster Financiamento de Veículos). Reaproveita o solver
 * por bisseção já usado em "Descobrir taxa de juros"
 * (calculateImplicitMonthlyRate): o CET é a taxa que iguala o valor
 * efetivamente recebido (financiado menos tarifas cobradas na entrada) ao
 * valor presente de tudo que sai do bolso todo mês (parcela + seguro).
 */
export function CetEstimadoFinanciamentoTool() {
  const [financedAmountDigits, setFinancedAmountDigits] = useState("");
  const [rateText, setRateText] = useState("");
  const [rateType, setRateType] = useState<FinancingRateType>("mensal");
  const [installmentsText, setInstallmentsText] = useState("");
  const [upfrontFeesDigits, setUpfrontFeesDigits] = useState("");
  const [monthlyInsuranceDigits, setMonthlyInsuranceDigits] = useState("");
  const [errors, setErrors] = useState<EstimatedCetFieldErrors>({});
  const [result, setResult] = useState<EstimatedCetResult | null>(null);

  function clearError(field: keyof EstimatedCetFieldErrors) {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function handleClear() {
    setFinancedAmountDigits("");
    setRateText("");
    setRateType("mensal");
    setInstallmentsText("");
    setUpfrontFeesDigits("");
    setMonthlyInsuranceDigits("");
    setErrors({});
    setResult(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const input: EstimatedCetInput = {
      financedAmount: centsDigitsToAmount(financedAmountDigits),
      rate: parseLocaleNumberBRL(rateText) ?? NaN,
      rateType,
      installments: parseLocaleNumberBRL(installmentsText) ?? NaN,
      upfrontFees: upfrontFeesDigits ? centsDigitsToAmount(upfrontFeesDigits) : 0,
      monthlyInsurance: monthlyInsuranceDigits ? centsDigitsToAmount(monthlyInsuranceDigits) : 0,
    };

    const nextErrors = validateEstimatedCetInput(input);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setResult(null);
      return;
    }

    setResult(calculateEstimatedCet(input));
  }

  return (
    <div>
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <TextField
          id="cet-valor-financiado"
          label="Valor financiado"
          inputMode="decimal"
          placeholder="R$ 0,00"
          value={financedAmountDigits ? formatCurrencyBRL(centsDigitsToAmount(financedAmountDigits)) : ""}
          onChange={(event) => {
            setFinancedAmountDigits(event.target.value.replace(/\D/g, "").slice(0, 12));
            clearError("financedAmount");
          }}
          error={errors.financedAmount}
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <NumberField
            id="cet-taxa"
            label="Taxa de juros nominal"
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
            id="cet-taxa-tipo"
            label="Tipo da taxa"
            value={rateType}
            onChange={(event) => setRateType(event.target.value as FinancingRateType)}
          >
            <option value="mensal">Mensal</option>
            <option value="anual">Anual</option>
          </SelectField>
        </div>

        <NumberField
          id="cet-prazo"
          label="Prazo (número de parcelas)"
          placeholder="0"
          value={installmentsText}
          onChange={(event) => {
            setInstallmentsText(event.target.value);
            clearError("installments");
          }}
          error={errors.installments}
        />

        <TextField
          id="cet-tarifas"
          label="Tarifas cobradas na contratação (ex.: TAC)"
          inputMode="decimal"
          placeholder="R$ 0,00"
          hint="Opcional"
          value={upfrontFeesDigits ? formatCurrencyBRL(centsDigitsToAmount(upfrontFeesDigits)) : ""}
          onChange={(event) => {
            setUpfrontFeesDigits(event.target.value.replace(/\D/g, "").slice(0, 12));
            clearError("upfrontFees");
          }}
          error={errors.upfrontFees}
        />

        <TextField
          id="cet-seguro"
          label="Seguro (ou outro custo) cobrado junto da parcela"
          inputMode="decimal"
          placeholder="R$ 0,00"
          hint="Opcional"
          value={monthlyInsuranceDigits ? formatCurrencyBRL(centsDigitsToAmount(monthlyInsuranceDigits)) : ""}
          onChange={(event) => {
            setMonthlyInsuranceDigits(event.target.value.replace(/\D/g, "").slice(0, 12));
            clearError("monthlyInsurance");
          }}
          error={errors.monthlyInsurance}
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
            label="CET estimado (mensal)"
            value={`${formatPercentage(result.cetMonthlyPercent)} ao mês`}
          />

          <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
            Este é um CET estimado, calculado apenas com os dados informados aqui. O CET oficial —
            que pode incluir outros custos — deve ser informado pela instituição financeira antes da
            contratação, conforme exigido por lei.
          </p>

          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-zinc-200 p-3">
              <dt className="text-xs text-zinc-500">CET estimado (ano)</dt>
              <dd className="mt-1 text-sm font-semibold text-zinc-900">
                {formatPercentage(result.cetAnnualPercent)}
              </dd>
            </div>
            <div className="rounded-lg border border-zinc-200 p-3">
              <dt className="text-xs text-zinc-500">Taxa de juros nominal (mês)</dt>
              <dd className="mt-1 text-sm font-semibold text-zinc-900">
                {formatPercentage(result.nominalMonthlyRatePercent)}
              </dd>
            </div>
            <div className="rounded-lg border border-zinc-200 p-3">
              <dt className="text-xs text-zinc-500">Saída mensal total (parcela + seguro)</dt>
              <dd className="mt-1 text-sm font-semibold text-zinc-900">
                {formatCurrencyBRL(result.totalMonthlyOutflow)}
              </dd>
            </div>
            <div className="rounded-lg border border-zinc-200 p-3">
              <dt className="text-xs text-zinc-500">Valor líquido recebido</dt>
              <dd className="mt-1 text-sm font-semibold text-zinc-900">
                {formatCurrencyBRL(result.netAmountReceived)}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}
    </div>
  );
}
