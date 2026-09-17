"use client";

import { useState, type FormEvent } from "react";
import { TextField } from "@/components/forms/TextField";
import { NumberField } from "@/components/forms/NumberField";
import { SelectField } from "@/components/forms/SelectField";
import { Button } from "@/components/ui/Button";
import { ResultHighlight } from "@/components/results/ResultHighlight";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { FinancingBalanceChart } from "@/components/tools/financing/FinancingBalanceChart";
import { centsDigitsToAmount, formatCurrencyBRL } from "@/lib/formatters/currency";
import { parseLocaleNumberBRL } from "@/lib/validators/number";
import {
  calculateFinancing,
  validateFinancingInput,
  type FinancingFieldErrors,
  type FinancingInput,
  type FinancingRateType,
  type FinancingResult,
} from "@/lib/calculators/financing";

/**
 * Componente principal da Calculadora de Financiamento de Veículo.
 * Reaproveita integralmente o motor de cálculo do Simulador de
 * Financiamento SAC x Price (lib/calculators/financing.ts), fixando o
 * sistema em "price" (o formato mais comum de financiamento de veículo
 * anunciado por lojas e bancos), sem duplicar a fórmula financeira já
 * existente (PROMPT MESTRE, "Financiamento de Veículo").
 */
export function FinanciamentoVeiculoTool() {
  const [vehicleValueDigits, setVehicleValueDigits] = useState("");
  const [downPaymentDigits, setDownPaymentDigits] = useState("");
  const [rateText, setRateText] = useState("");
  const [rateType, setRateType] = useState<FinancingRateType>("mensal");
  const [installmentsText, setInstallmentsText] = useState("");
  const [errors, setErrors] = useState<FinancingFieldErrors>({});
  const [result, setResult] = useState<FinancingResult | null>(null);

  function clearError(field: keyof FinancingFieldErrors) {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const input: FinancingInput = {
      assetValue: centsDigitsToAmount(vehicleValueDigits),
      downPayment: centsDigitsToAmount(downPaymentDigits),
      rate: parseLocaleNumberBRL(rateText) ?? NaN,
      rateType,
      installments: parseLocaleNumberBRL(installmentsText) ?? NaN,
      system: "price",
    };

    const nextErrors = validateFinancingInput(input);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setResult(null);
      return;
    }

    setResult(calculateFinancing(input));
  }

  const price = result?.price;

  return (
    <div>
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <TextField
          id="financiamento-veiculo-price"
          label="Preço do veículo"
          inputMode="decimal"
          placeholder="R$ 0,00"
          value={vehicleValueDigits ? formatCurrencyBRL(centsDigitsToAmount(vehicleValueDigits)) : ""}
          onChange={(event) => {
            setVehicleValueDigits(event.target.value.replace(/\D/g, "").slice(0, 12));
            clearError("assetValue");
          }}
          error={errors.assetValue}
        />

        <TextField
          id="financiamento-veiculo-down-payment"
          label="Entrada"
          inputMode="decimal"
          placeholder="R$ 0,00"
          hint="Opcional"
          value={downPaymentDigits ? formatCurrencyBRL(centsDigitsToAmount(downPaymentDigits)) : ""}
          onChange={(event) => {
            setDownPaymentDigits(event.target.value.replace(/\D/g, "").slice(0, 12));
            clearError("downPayment");
          }}
          error={errors.downPayment}
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <NumberField
            id="financiamento-veiculo-rate"
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
            id="financiamento-veiculo-rate-type"
            label="Tipo da taxa"
            value={rateType}
            onChange={(event) => setRateType(event.target.value as FinancingRateType)}
          >
            <option value="mensal">Mensal</option>
            <option value="anual">Anual</option>
          </SelectField>
        </div>

        <NumberField
          id="financiamento-veiculo-installments"
          label="Número de parcelas"
          placeholder="0"
          value={installmentsText}
          onChange={(event) => {
            setInstallmentsText(event.target.value);
            clearError("installments");
          }}
          error={errors.installments}
        />

        <Button type="submit" className="w-full sm:w-auto">
          Simular
        </Button>
      </form>

      {result && price ? (
        <div className="mt-8 space-y-6">
          <ResultHighlight label="Valor da parcela" value={formatCurrencyBRL(price.firstPayment)} />

          <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
            Esta é uma simulação matemática do financiamento. Tarifas, seguros, impostos e o
            Custo Efetivo Total (CET) informado pelo banco/financeira podem alterar o valor
            realmente contratado.
          </p>

          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-zinc-200 p-3">
              <dt className="text-xs text-zinc-500">Valor financiado</dt>
              <dd className="mt-1 text-sm font-semibold text-zinc-900">
                {formatCurrencyBRL(price.financedAmount)}
              </dd>
            </div>
            <div className="rounded-lg border border-zinc-200 p-3">
              <dt className="text-xs text-zinc-500">Total pago</dt>
              <dd className="mt-1 text-sm font-semibold text-zinc-900">
                {formatCurrencyBRL(price.totalPaid)}
              </dd>
            </div>
            <div className="rounded-lg border border-zinc-200 p-3">
              <dt className="text-xs text-zinc-500">Juros totais</dt>
              <dd className="mt-1 text-sm font-semibold text-emerald-700">
                {formatCurrencyBRL(price.totalInterest)}
              </dd>
            </div>
          </dl>

          <div>
            <SectionHeading title="Evolução do saldo devedor" as="h3" />
            <FinancingBalanceChart financedAmount={price.financedAmount} price={price.installments} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
