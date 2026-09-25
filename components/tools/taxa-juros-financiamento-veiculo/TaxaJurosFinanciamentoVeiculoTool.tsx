"use client";

import { useState, type FormEvent } from "react";
import { TextField } from "@/components/forms/TextField";
import { NumberField } from "@/components/forms/NumberField";
import { Button } from "@/components/ui/Button";
import { ResultHighlight } from "@/components/results/ResultHighlight";
import { formatCurrencyBRL, centsDigitsToAmount, formatPercentage } from "@/lib/formatters/currency";
import { parseLocaleNumberBRL } from "@/lib/validators/number";
import {
  calculateImplicitRateDetails,
  validateImplicitRateInput,
  type ImplicitRateResult,
} from "@/lib/calculators/vehicle-financing";

interface FormErrors {
  vehiclePrice?: string;
  downPayment?: string;
  installment?: string;
  installments?: string;
}

/**
 * "Descobrir taxa de juros" (cluster Financiamento de Veículos). A pessoa já
 * tem uma proposta (preço do veículo, entrada, parcela e prazo) e quer saber
 * qual taxa de juros mensal está embutida nela. Resolvida por bisseção
 * (calculateImplicitMonthlyRate, lib/calculators/vehicle-financing.ts) — um
 * cálculo iterativo, não uma aproximação — já que não existe fórmula fechada
 * para isolar a taxa na equação da Tabela Price.
 */
export function TaxaJurosFinanciamentoVeiculoTool() {
  const [vehiclePriceDigits, setVehiclePriceDigits] = useState("");
  const [downPaymentDigits, setDownPaymentDigits] = useState("");
  const [installmentDigits, setInstallmentDigits] = useState("");
  const [installmentsText, setInstallmentsText] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [result, setResult] = useState<ImplicitRateResult | null>(null);

  function clearError(field: keyof FormErrors) {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function handleClear() {
    setVehiclePriceDigits("");
    setDownPaymentDigits("");
    setInstallmentDigits("");
    setInstallmentsText("");
    setErrors({});
    setResult(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const vehiclePrice = centsDigitsToAmount(vehiclePriceDigits);
    const downPayment = downPaymentDigits ? centsDigitsToAmount(downPaymentDigits) : 0;
    const installment = centsDigitsToAmount(installmentDigits);
    const installments = parseLocaleNumberBRL(installmentsText) ?? NaN;

    const nextErrors: FormErrors = {};
    const hasValidVehiclePrice = Number.isFinite(vehiclePrice) && vehiclePrice > 0;
    if (!hasValidVehiclePrice) {
      nextErrors.vehiclePrice = "Informe um valor do veículo maior que zero.";
    }
    if (!Number.isFinite(downPayment) || downPayment < 0) {
      nextErrors.downPayment = "A entrada não pode ser negativa.";
    } else if (hasValidVehiclePrice && downPayment >= vehiclePrice) {
      nextErrors.downPayment = "A entrada deve ser menor que o valor do veículo.";
    }

    const financedAmount = vehiclePrice - downPayment;
    if (hasValidVehiclePrice && Number.isFinite(downPayment) && downPayment < vehiclePrice) {
      const implicitErrors = validateImplicitRateInput({ financedAmount, installment, installments });
      if (implicitErrors.installment) nextErrors.installment = implicitErrors.installment;
      if (implicitErrors.installments) nextErrors.installments = implicitErrors.installments;
    } else {
      if (!Number.isFinite(installment) || installment <= 0) {
        nextErrors.installment = "Informe uma parcela maior que zero.";
      }
      if (!Number.isFinite(installments) || !Number.isInteger(installments) || installments <= 0) {
        nextErrors.installments = "Informe um número de parcelas válido: um número inteiro maior que zero.";
      }
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setResult(null);
      return;
    }

    setResult(calculateImplicitRateDetails({ financedAmount, installment, installments }));
  }

  return (
    <div>
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <TextField
          id="taxa-juros-preco"
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
          id="taxa-juros-entrada"
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

        <TextField
          id="taxa-juros-parcela"
          label="Parcela informada na proposta"
          inputMode="decimal"
          placeholder="R$ 0,00"
          value={installmentDigits ? formatCurrencyBRL(centsDigitsToAmount(installmentDigits)) : ""}
          onChange={(event) => {
            setInstallmentDigits(event.target.value.replace(/\D/g, "").slice(0, 12));
            clearError("installment");
          }}
          error={errors.installment}
        />

        <NumberField
          id="taxa-juros-prazo"
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
            label="Taxa de juros aproximada"
            value={`${formatPercentage(result.monthlyRatePercent)} ao mês`}
          />

          <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
            Os resultados são estimativas e podem diferir das condições realmente oferecidas por
            bancos e financeiras.
          </p>

          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-zinc-200 p-3">
              <dt className="text-xs text-zinc-500">Taxa equivalente ao ano</dt>
              <dd className="mt-1 text-sm font-semibold text-zinc-900">
                {formatPercentage(result.annualRatePercent)}
              </dd>
            </div>
            <div className="rounded-lg border border-zinc-200 p-3">
              <dt className="text-xs text-zinc-500">Total pago (parcelas)</dt>
              <dd className="mt-1 text-sm font-semibold text-zinc-900">
                {formatCurrencyBRL(result.totalPaid)}
              </dd>
            </div>
            <div className="rounded-lg border border-zinc-200 p-3">
              <dt className="text-xs text-zinc-500">Juros totais</dt>
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
