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
  calculateFinancing,
  validateFinancingInput,
  type FinancingFieldErrors,
  type FinancingInput,
  type FinancingRateType,
  type FinancingResult,
} from "@/lib/calculators/financing";

/**
 * Componente principal da Calculadora de Parcelamento. Reaproveita
 * integralmente o motor de cálculo do Simulador de Financiamento SAC x
 * Price (lib/calculators/financing.ts), fixando o sistema em "price"
 * (prestação constante — o padrão de qualquer parcelamento) e simplificando
 * o formulário/resultado para o caso de uso de uma compra parcelada, sem
 * duplicar a fórmula financeira já existente (PROMPT MESTRE, "Parcelamento
 * com Juros").
 */
export function ParcelamentoTool() {
  const [priceDigits, setPriceDigits] = useState("");
  const [downPaymentDigits, setDownPaymentDigits] = useState("");
  const [rateText, setRateText] = useState("");
  const [rateType, setRateType] = useState<FinancingRateType>("mensal");
  const [installmentsText, setInstallmentsText] = useState("");
  const [errors, setErrors] = useState<FinancingFieldErrors>({});
  const [result, setResult] = useState<FinancingResult | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const input: FinancingInput = {
      assetValue: centsDigitsToAmount(priceDigits),
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
          id="parcelamento-price"
          label="Valor da compra"
          inputMode="decimal"
          placeholder="R$ 0,00"
          value={priceDigits ? formatCurrencyBRL(centsDigitsToAmount(priceDigits)) : ""}
          onChange={(event) => setPriceDigits(event.target.value.replace(/\D/g, "").slice(0, 12))}
          error={errors.assetValue}
        />

        <TextField
          id="parcelamento-down-payment"
          label="Entrada"
          inputMode="decimal"
          placeholder="R$ 0,00"
          hint="Opcional"
          value={downPaymentDigits ? formatCurrencyBRL(centsDigitsToAmount(downPaymentDigits)) : ""}
          onChange={(event) => setDownPaymentDigits(event.target.value.replace(/\D/g, "").slice(0, 12))}
          error={errors.downPayment}
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <NumberField
            id="parcelamento-rate"
            label="Taxa de juros"
            suffix="%"
            hint="Deixe 0 para parcelamento sem juros"
            placeholder="0,00"
            value={rateText}
            onChange={(event) => setRateText(event.target.value)}
            error={errors.rate}
          />
          <SelectField
            id="parcelamento-rate-type"
            label="Tipo da taxa"
            value={rateType}
            onChange={(event) => setRateType(event.target.value as FinancingRateType)}
          >
            <option value="mensal">Mensal</option>
            <option value="anual">Anual</option>
          </SelectField>
        </div>

        <NumberField
          id="parcelamento-installments"
          label="Número de parcelas"
          placeholder="0"
          value={installmentsText}
          onChange={(event) => setInstallmentsText(event.target.value)}
          error={errors.installments}
        />

        <Button type="submit" className="w-full sm:w-auto">
          Calcular
        </Button>
      </form>

      {result && price ? (
        <div className="mt-8 space-y-4">
          <ResultHighlight label="Valor da parcela" value={formatCurrencyBRL(price.firstPayment)} />
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
        </div>
      ) : null}
    </div>
  );
}
