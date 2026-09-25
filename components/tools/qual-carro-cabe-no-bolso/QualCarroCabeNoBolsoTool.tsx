"use client";

import { useState, type FormEvent } from "react";
import { TextField } from "@/components/forms/TextField";
import { NumberField } from "@/components/forms/NumberField";
import { SelectField } from "@/components/forms/SelectField";
import { Button } from "@/components/ui/Button";
import { ResultHighlight } from "@/components/results/ResultHighlight";
import { centsDigitsToAmount, formatCurrencyBRL } from "@/lib/formatters/currency";
import { parseLocaleNumberBRL } from "@/lib/validators/number";
import {
  calculateAffordability,
  validateAffordabilityInput,
  type AffordabilityFieldErrors,
  type AffordabilityInput,
  type AffordabilityResult,
  type FinancingRateType,
} from "@/lib/calculators/vehicle-financing";

/**
 * "Qual carro cabe no meu bolso?" (cluster Financiamento de Veículos).
 * Reaproveita o motor de cálculo de lib/calculators/vehicle-financing.ts
 * (que por sua vez reaproveita a fórmula da Tabela Price de
 * lib/calculators/financing.ts — nunca duplicada). Pergunta: dada a
 * entrada e a parcela máxima que a pessoa pode pagar, qual o valor
 * aproximado do carro que cabe no orçamento.
 */
export function QualCarroCabeNoBolsoTool() {
  const [downPaymentDigits, setDownPaymentDigits] = useState("");
  const [maxInstallmentDigits, setMaxInstallmentDigits] = useState("");
  const [rateText, setRateText] = useState("");
  const [rateType, setRateType] = useState<FinancingRateType>("mensal");
  const [installmentsText, setInstallmentsText] = useState("");
  const [errors, setErrors] = useState<AffordabilityFieldErrors>({});
  const [result, setResult] = useState<AffordabilityResult | null>(null);

  function clearError(field: keyof AffordabilityFieldErrors) {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function handleClear() {
    setDownPaymentDigits("");
    setMaxInstallmentDigits("");
    setRateText("");
    setRateType("mensal");
    setInstallmentsText("");
    setErrors({});
    setResult(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const input: AffordabilityInput = {
      downPayment: centsDigitsToAmount(downPaymentDigits),
      maxInstallment: centsDigitsToAmount(maxInstallmentDigits),
      rate: parseLocaleNumberBRL(rateText) ?? NaN,
      rateType,
      installments: parseLocaleNumberBRL(installmentsText) ?? NaN,
    };

    const nextErrors = validateAffordabilityInput(input);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setResult(null);
      return;
    }

    setResult(calculateAffordability(input));
  }

  return (
    <div>
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <TextField
          id="carro-bolso-entrada"
          label="Entrada disponível"
          inputMode="decimal"
          placeholder="R$ 0,00"
          hint="Opcional — deixe em branco se não vai dar entrada"
          value={downPaymentDigits ? formatCurrencyBRL(centsDigitsToAmount(downPaymentDigits)) : ""}
          onChange={(event) => {
            setDownPaymentDigits(event.target.value.replace(/\D/g, "").slice(0, 12));
            clearError("downPayment");
          }}
          error={errors.downPayment}
        />

        <TextField
          id="carro-bolso-parcela"
          label="Parcela máxima que você pode pagar"
          inputMode="decimal"
          placeholder="R$ 0,00"
          value={maxInstallmentDigits ? formatCurrencyBRL(centsDigitsToAmount(maxInstallmentDigits)) : ""}
          onChange={(event) => {
            setMaxInstallmentDigits(event.target.value.replace(/\D/g, "").slice(0, 12));
            clearError("maxInstallment");
          }}
          error={errors.maxInstallment}
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <NumberField
            id="carro-bolso-taxa"
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
            id="carro-bolso-taxa-tipo"
            label="Tipo da taxa"
            value={rateType}
            onChange={(event) => setRateType(event.target.value as FinancingRateType)}
          >
            <option value="mensal">Mensal</option>
            <option value="anual">Anual</option>
          </SelectField>
        </div>

        <NumberField
          id="carro-bolso-prazo"
          label="Prazo (número de parcelas)"
          placeholder="0"
          value={installmentsText}
          onChange={(event) => {
            setInstallmentsText(event.target.value);
            clearError("installments");
          }}
          error={errors.installments}
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
            label="Valor aproximado máximo do veículo"
            value={formatCurrencyBRL(result.maxVehiclePrice)}
          />

          <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
            Os resultados são estimativas e podem diferir das condições realmente oferecidas por
            bancos e financeiras. Não representam aprovação de crédito.
          </p>

          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-zinc-200 p-3">
              <dt className="text-xs text-zinc-500">Valor financiável</dt>
              <dd className="mt-1 text-sm font-semibold text-zinc-900">
                {formatCurrencyBRL(result.financedAmount)}
              </dd>
            </div>
            <div className="rounded-lg border border-zinc-200 p-3">
              <dt className="text-xs text-zinc-500">Total de parcelas</dt>
              <dd className="mt-1 text-sm font-semibold text-zinc-900">
                {result.installmentsCount}x de {formatCurrencyBRL(result.installment)}
              </dd>
            </div>
            <div className="rounded-lg border border-zinc-200 p-3">
              <dt className="text-xs text-zinc-500">Juros estimados</dt>
              <dd className="mt-1 text-sm font-semibold text-emerald-700">
                {formatCurrencyBRL(result.totalInterest)}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}
    </div>
  );
}
