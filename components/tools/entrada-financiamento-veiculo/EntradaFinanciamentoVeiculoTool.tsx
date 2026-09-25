"use client";

import { useState, type FormEvent } from "react";
import { TextField } from "@/components/forms/TextField";
import { NumberField } from "@/components/forms/NumberField";
import { SelectField } from "@/components/forms/SelectField";
import { Button } from "@/components/ui/Button";
import { ResultHighlight } from "@/components/results/ResultHighlight";
import { centsDigitsToAmount, formatCurrencyBRL, formatPercentage } from "@/lib/formatters/currency";
import { parseLocaleNumberBRL } from "@/lib/validators/number";
import {
  calculateRequiredDownPayment,
  validateRequiredDownPaymentInput,
  type FinancingRateType,
  type RequiredDownPaymentFieldErrors,
  type RequiredDownPaymentInput,
  type RequiredDownPaymentResult,
} from "@/lib/calculators/vehicle-financing";

/**
 * "Quanto preciso dar de entrada?" (cluster Financiamento de Veículos).
 * Pergunta o inverso de "Qual carro cabe no meu bolso": dada a parcela que
 * a pessoa QUER pagar, o preço do veículo, o prazo e a taxa, calcula a
 * entrada aproximada necessária.
 */
export function EntradaFinanciamentoVeiculoTool() {
  const [vehiclePriceDigits, setVehiclePriceDigits] = useState("");
  const [desiredInstallmentDigits, setDesiredInstallmentDigits] = useState("");
  const [rateText, setRateText] = useState("");
  const [rateType, setRateType] = useState<FinancingRateType>("mensal");
  const [installmentsText, setInstallmentsText] = useState("");
  const [errors, setErrors] = useState<RequiredDownPaymentFieldErrors>({});
  const [result, setResult] = useState<RequiredDownPaymentResult | null>(null);

  function clearError(field: keyof RequiredDownPaymentFieldErrors) {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function handleClear() {
    setVehiclePriceDigits("");
    setDesiredInstallmentDigits("");
    setRateText("");
    setRateType("mensal");
    setInstallmentsText("");
    setErrors({});
    setResult(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const input: RequiredDownPaymentInput = {
      vehiclePrice: centsDigitsToAmount(vehiclePriceDigits),
      desiredInstallment: centsDigitsToAmount(desiredInstallmentDigits),
      rate: parseLocaleNumberBRL(rateText) ?? NaN,
      rateType,
      installments: parseLocaleNumberBRL(installmentsText) ?? NaN,
    };

    const nextErrors = validateRequiredDownPaymentInput(input);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setResult(null);
      return;
    }

    setResult(calculateRequiredDownPayment(input));
  }

  return (
    <div>
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <TextField
          id="entrada-preco-veiculo"
          label="Preço do veículo"
          inputMode="decimal"
          placeholder="R$ 0,00"
          value={vehiclePriceDigits ? formatCurrencyBRL(centsDigitsToAmount(vehiclePriceDigits)) : ""}
          onChange={(event) => {
            setVehiclePriceDigits(event.target.value.replace(/\D/g, "").slice(0, 12));
            clearError("vehiclePrice");
          }}
          error={errors.vehiclePrice}
        />

        <TextField
          id="entrada-parcela-desejada"
          label="Parcela que você quer pagar"
          inputMode="decimal"
          placeholder="R$ 0,00"
          value={
            desiredInstallmentDigits ? formatCurrencyBRL(centsDigitsToAmount(desiredInstallmentDigits)) : ""
          }
          onChange={(event) => {
            setDesiredInstallmentDigits(event.target.value.replace(/\D/g, "").slice(0, 12));
            clearError("desiredInstallment");
          }}
          error={errors.desiredInstallment}
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <NumberField
            id="entrada-taxa"
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
            id="entrada-taxa-tipo"
            label="Tipo da taxa"
            value={rateType}
            onChange={(event) => setRateType(event.target.value as FinancingRateType)}
          >
            <option value="mensal">Mensal</option>
            <option value="anual">Anual</option>
          </SelectField>
        </div>

        <NumberField
          id="entrada-prazo"
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
            label={result.coversFullPrice ? "Entrada necessária" : "Entrada aproximada necessária"}
            value={formatCurrencyBRL(result.downPayment)}
          />

          {result.coversFullPrice ? (
            <p className="rounded-lg bg-teal-50 p-3 text-xs text-teal-800">
              Com a parcela informada, dá para financiar o veículo inteiro, sem precisar de entrada. A
              parcela recalculada para o valor total do veículo é {formatCurrencyBRL(result.installment)}{" "}
              — menor do que a que você informou.
            </p>
          ) : (
            <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
              Os resultados são estimativas e podem diferir das condições realmente oferecidas por
              bancos e financeiras. Não representam aprovação de crédito.
            </p>
          )}

          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-zinc-200 p-3">
              <dt className="text-xs text-zinc-500">Percentual da entrada</dt>
              <dd className="mt-1 text-sm font-semibold text-zinc-900">
                {formatPercentage(result.downPaymentPercent)}
              </dd>
            </div>
            <div className="rounded-lg border border-zinc-200 p-3">
              <dt className="text-xs text-zinc-500">Valor financiado</dt>
              <dd className="mt-1 text-sm font-semibold text-zinc-900">
                {formatCurrencyBRL(result.financedAmount)}
              </dd>
            </div>
            <div className="rounded-lg border border-zinc-200 p-3">
              <dt className="text-xs text-zinc-500">Parcela</dt>
              <dd className="mt-1 text-sm font-semibold text-zinc-900">
                {formatCurrencyBRL(result.installment)}
              </dd>
            </div>
            <div className="rounded-lg border border-zinc-200 p-3">
              <dt className="text-xs text-zinc-500">Total pago</dt>
              <dd className="mt-1 text-sm font-semibold text-zinc-900">
                {formatCurrencyBRL(result.totalPaid)}
              </dd>
            </div>
            <div className="rounded-lg border border-zinc-200 p-3">
              <dt className="text-xs text-zinc-500">Juros</dt>
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
