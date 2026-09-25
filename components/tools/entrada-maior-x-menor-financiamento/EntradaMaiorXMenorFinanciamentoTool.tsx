"use client";

import { useState, type FormEvent } from "react";
import { TextField } from "@/components/forms/TextField";
import { NumberField } from "@/components/forms/NumberField";
import { SelectField } from "@/components/forms/SelectField";
import { Button } from "@/components/ui/Button";
import { formatCurrencyBRL, centsDigitsToAmount } from "@/lib/formatters/currency";
import { parseLocaleNumberBRL } from "@/lib/validators/number";
import {
  compareDownPaymentScenarios,
  validateDownPaymentScenarioInput,
  type DownPaymentComparisonResult,
  type DownPaymentScenarioFieldErrors,
  type DownPaymentScenarioInput,
  type FinancingRateType,
} from "@/lib/calculators/vehicle-financing";

/**
 * "Entrada maior x entrada menor" (cluster Financiamento de Veículos).
 * Compara dois valores de entrada para o MESMO veículo, prazo e taxa — só a
 * entrada muda entre os dois cenários — e mostra a diferença exata em
 * parcela, juros e total pago.
 */
export function EntradaMaiorXMenorFinanciamentoTool() {
  const [vehiclePriceDigits, setVehiclePriceDigits] = useState("");
  const [lowerDownPaymentDigits, setLowerDownPaymentDigits] = useState("");
  const [higherDownPaymentDigits, setHigherDownPaymentDigits] = useState("");
  const [rateText, setRateText] = useState("");
  const [rateType, setRateType] = useState<FinancingRateType>("mensal");
  const [installmentsText, setInstallmentsText] = useState("");
  const [errors, setErrors] = useState<{
    vehiclePrice?: string;
    lowerDownPayment?: string;
    higherDownPayment?: string;
    rate?: string;
    installments?: string;
  }>({});
  const [result, setResult] = useState<DownPaymentComparisonResult | null>(null);

  function clearError(field: keyof typeof errors) {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function handleClear() {
    setVehiclePriceDigits("");
    setLowerDownPaymentDigits("");
    setHigherDownPaymentDigits("");
    setRateText("");
    setRateType("mensal");
    setInstallmentsText("");
    setErrors({});
    setResult(null);
  }

  function validateScenario(input: DownPaymentScenarioInput): DownPaymentScenarioFieldErrors {
    return validateDownPaymentScenarioInput(input);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const vehiclePrice = centsDigitsToAmount(vehiclePriceDigits);
    const rate = parseLocaleNumberBRL(rateText) ?? NaN;
    const installments = parseLocaleNumberBRL(installmentsText) ?? NaN;
    const lowerDownPayment = centsDigitsToAmount(lowerDownPaymentDigits);
    const higherDownPayment = centsDigitsToAmount(higherDownPaymentDigits);

    const scenarioAInput: DownPaymentScenarioInput = {
      vehiclePrice,
      downPayment: lowerDownPayment,
      rate,
      rateType,
      installments,
    };
    const scenarioBInput: DownPaymentScenarioInput = {
      vehiclePrice,
      downPayment: higherDownPayment,
      rate,
      rateType,
      installments,
    };

    const errorsA = validateScenario(scenarioAInput);
    const errorsB = validateScenario(scenarioBInput);

    const nextErrors: typeof errors = {
      vehiclePrice: errorsA.vehiclePrice ?? errorsB.vehiclePrice,
      lowerDownPayment: errorsA.downPayment,
      higherDownPayment: errorsB.downPayment,
      rate: errorsA.rate ?? errorsB.rate,
      installments: errorsA.installments ?? errorsB.installments,
    };
    if (
      !nextErrors.lowerDownPayment &&
      !nextErrors.higherDownPayment &&
      Number.isFinite(lowerDownPayment) &&
      Number.isFinite(higherDownPayment) &&
      lowerDownPayment >= higherDownPayment
    ) {
      nextErrors.higherDownPayment = "A entrada maior deve ser maior que a entrada menor.";
    }

    const hasErrors = Object.values(nextErrors).some(Boolean);
    setErrors(nextErrors);
    if (hasErrors) {
      setResult(null);
      return;
    }

    setResult(compareDownPaymentScenarios(scenarioAInput, scenarioBInput));
  }

  return (
    <div>
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <TextField
          id="entrada-comparar-preco"
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

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <TextField
            id="entrada-comparar-menor"
            label="Cenário A — entrada menor"
            inputMode="decimal"
            placeholder="R$ 0,00"
            value={
              lowerDownPaymentDigits ? formatCurrencyBRL(centsDigitsToAmount(lowerDownPaymentDigits)) : ""
            }
            onChange={(event) => {
              setLowerDownPaymentDigits(event.target.value.replace(/\D/g, "").slice(0, 12));
              clearError("lowerDownPayment");
            }}
            error={errors.lowerDownPayment}
          />
          <TextField
            id="entrada-comparar-maior"
            label="Cenário B — entrada maior"
            inputMode="decimal"
            placeholder="R$ 0,00"
            value={
              higherDownPaymentDigits ? formatCurrencyBRL(centsDigitsToAmount(higherDownPaymentDigits)) : ""
            }
            onChange={(event) => {
              setHigherDownPaymentDigits(event.target.value.replace(/\D/g, "").slice(0, 12));
              clearError("higherDownPayment");
            }}
            error={errors.higherDownPayment}
          />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <NumberField
            id="entrada-comparar-taxa"
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
            id="entrada-comparar-taxa-tipo"
            label="Tipo da taxa"
            value={rateType}
            onChange={(event) => setRateType(event.target.value as FinancingRateType)}
          >
            <option value="mensal">Mensal</option>
            <option value="anual">Anual</option>
          </SelectField>
        </div>

        <NumberField
          id="entrada-comparar-prazo"
          label="Prazo (número de parcelas, igual nos dois cenários)"
          placeholder="0"
          value={installmentsText}
          onChange={(event) => {
            setInstallmentsText(event.target.value);
            clearError("installments");
          }}
          error={errors.installments}
        />

        <div className="flex flex-wrap gap-3">
          <Button type="submit">Comparar</Button>
          <Button type="button" variant="secondary" onClick={handleClear}>
            Limpar
          </Button>
        </div>
      </form>

      {result ? (
        <div className="mt-8 space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-zinc-200 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Cenário A — entrada menor
              </p>
              <p className="mt-2 text-2xl font-bold text-zinc-900">
                {formatCurrencyBRL(result.scenarioA.installment)}
                <span className="text-sm font-normal text-zinc-500"> /mês</span>
              </p>
              <dl className="mt-3 space-y-1 text-sm text-zinc-600">
                <div className="flex justify-between">
                  <dt>Entrada</dt>
                  <dd>{formatCurrencyBRL(result.scenarioA.downPayment)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Total pago</dt>
                  <dd>{formatCurrencyBRL(result.scenarioA.totalPaid)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Juros</dt>
                  <dd>{formatCurrencyBRL(result.scenarioA.totalInterest)}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-lg border border-teal-300 bg-teal-50/30 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-teal-800">
                Cenário B — entrada maior
              </p>
              <p className="mt-2 text-2xl font-bold text-teal-900">
                {formatCurrencyBRL(result.scenarioB.installment)}
                <span className="text-sm font-normal text-teal-700"> /mês</span>
              </p>
              <dl className="mt-3 space-y-1 text-sm text-teal-800">
                <div className="flex justify-between">
                  <dt>Entrada</dt>
                  <dd>{formatCurrencyBRL(result.scenarioB.downPayment)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Total pago</dt>
                  <dd>{formatCurrencyBRL(result.scenarioB.totalPaid)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Juros</dt>
                  <dd>{formatCurrencyBRL(result.scenarioB.totalInterest)}</dd>
                </div>
              </dl>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-zinc-900">
              Diferença entre dar mais entrada (B) e dar menos entrada (A)
            </p>
            <dl className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-lg border border-zinc-200 p-3">
                <dt className="text-xs text-zinc-500">Entrada</dt>
                <dd className="mt-1 text-sm font-semibold text-zinc-900">
                  {formatCurrencyBRL(result.difference.downPayment)}
                </dd>
              </div>
              <div className="rounded-lg border border-zinc-200 p-3">
                <dt className="text-xs text-zinc-500">Parcela</dt>
                <dd className="mt-1 text-sm font-semibold text-zinc-900">
                  {formatCurrencyBRL(result.difference.installment)}
                </dd>
              </div>
              <div className="rounded-lg border border-zinc-200 p-3">
                <dt className="text-xs text-zinc-500">Juros</dt>
                <dd className="mt-1 text-sm font-semibold text-emerald-700">
                  {formatCurrencyBRL(result.difference.totalInterest)}
                </dd>
              </div>
              <div className="rounded-lg border border-zinc-200 p-3">
                <dt className="text-xs text-zinc-500">Total pago</dt>
                <dd className="mt-1 text-sm font-semibold text-emerald-700">
                  {formatCurrencyBRL(result.difference.totalPaid)}
                </dd>
              </div>
            </dl>
          </div>

          <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
            Os resultados são estimativas e podem diferir das condições realmente oferecidas por
            bancos e financeiras.
          </p>
        </div>
      ) : null}
    </div>
  );
}
