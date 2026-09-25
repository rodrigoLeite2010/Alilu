"use client";

import { useState, type FormEvent } from "react";
import { TextField } from "@/components/forms/TextField";
import { NumberField } from "@/components/forms/NumberField";
import { SelectField } from "@/components/forms/SelectField";
import { Button } from "@/components/ui/Button";
import { formatCurrencyBRL, centsDigitsToAmount } from "@/lib/formatters/currency";
import { parseLocaleNumberBRL } from "@/lib/validators/number";
import {
  compareFinancingVsCash,
  validateFinancingVsCashInput,
  type FinancingRateType,
  type FinancingVsCashFieldErrors,
  type FinancingVsCashInput,
  type FinancingVsCashResult,
} from "@/lib/calculators/vehicle-financing";

/**
 * "Financiamento x pagamento à vista" (cluster Financiamento de Veículos).
 * Mostra lado a lado o total pago financiando e o preço à vista (com
 * desconto opcional) — sem declarar qual opção é "melhor": a decisão
 * depende de fatores que a calculadora não conhece (se a pessoa tem o
 * dinheiro disponível hoje, o que faria com ele em vez de comprar à vista
 * etc.), por isso o texto só apresenta os números.
 */
export function FinanciamentoXAVistaTool() {
  const [vehiclePriceDigits, setVehiclePriceDigits] = useState("");
  const [cashDiscountText, setCashDiscountText] = useState("");
  const [downPaymentDigits, setDownPaymentDigits] = useState("");
  const [rateText, setRateText] = useState("");
  const [rateType, setRateType] = useState<FinancingRateType>("mensal");
  const [installmentsText, setInstallmentsText] = useState("");
  const [errors, setErrors] = useState<FinancingVsCashFieldErrors>({});
  const [result, setResult] = useState<FinancingVsCashResult | null>(null);

  function clearError(field: keyof FinancingVsCashFieldErrors) {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function handleClear() {
    setVehiclePriceDigits("");
    setCashDiscountText("");
    setDownPaymentDigits("");
    setRateText("");
    setRateType("mensal");
    setInstallmentsText("");
    setErrors({});
    setResult(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const input: FinancingVsCashInput = {
      vehiclePrice: centsDigitsToAmount(vehiclePriceDigits),
      cashDiscountPercent: cashDiscountText ? (parseLocaleNumberBRL(cashDiscountText) ?? NaN) : 0,
      downPayment: downPaymentDigits ? centsDigitsToAmount(downPaymentDigits) : 0,
      rate: parseLocaleNumberBRL(rateText) ?? NaN,
      rateType,
      installments: parseLocaleNumberBRL(installmentsText) ?? NaN,
    };

    const nextErrors = validateFinancingVsCashInput(input);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setResult(null);
      return;
    }

    setResult(compareFinancingVsCash(input));
  }

  return (
    <div>
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <TextField
          id="financiamento-vista-preco"
          label="Preço do veículo (tabela)"
          inputMode="decimal"
          placeholder="R$ 0,00"
          value={vehiclePriceDigits ? formatCurrencyBRL(centsDigitsToAmount(vehiclePriceDigits)) : ""}
          onChange={(event) => {
            setVehiclePriceDigits(event.target.value.replace(/\D/g, "").slice(0, 12));
            clearError("vehiclePrice");
          }}
          error={errors.vehiclePrice}
        />

        <NumberField
          id="financiamento-vista-desconto"
          label="Desconto para pagamento à vista"
          suffix="%"
          placeholder="0,00"
          hint="Opcional — deixe em branco se não houver desconto"
          value={cashDiscountText}
          onChange={(event) => {
            setCashDiscountText(event.target.value);
            clearError("cashDiscountPercent");
          }}
          error={errors.cashDiscountPercent}
        />

        <TextField
          id="financiamento-vista-entrada"
          label="Entrada (se for financiar)"
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
            id="financiamento-vista-taxa"
            label="Taxa de juros do financiamento"
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
            id="financiamento-vista-taxa-tipo"
            label="Tipo da taxa"
            value={rateType}
            onChange={(event) => setRateType(event.target.value as FinancingRateType)}
          >
            <option value="mensal">Mensal</option>
            <option value="anual">Anual</option>
          </SelectField>
        </div>

        <NumberField
          id="financiamento-vista-prazo"
          label="Prazo do financiamento (número de parcelas)"
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
                Pagando à vista
              </p>
              <p className="mt-2 text-2xl font-bold text-zinc-900">
                {formatCurrencyBRL(result.cashPrice)}
              </p>
            </div>

            <div className="rounded-lg border border-zinc-200 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Financiando (total pago)
              </p>
              <p className="mt-2 text-2xl font-bold text-zinc-900">
                {formatCurrencyBRL(result.totalPaidFinancing)}
              </p>
              <dl className="mt-3 space-y-1 text-sm text-zinc-600">
                <div className="flex justify-between">
                  <dt>Parcela</dt>
                  <dd>{formatCurrencyBRL(result.installment)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Juros</dt>
                  <dd>{formatCurrencyBRL(result.totalInterest)}</dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 p-3">
            <p className="text-xs text-zinc-500">Diferença (financiando menos à vista)</p>
            <p className="mt-1 text-sm font-semibold text-zinc-900">
              {result.difference >= 0 ? "+" : ""}
              {formatCurrencyBRL(result.difference)}
            </p>
          </div>

          <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
            Os resultados são estimativas e podem diferir das condições realmente oferecidas por
            bancos e financeiras. Esta calculadora não recomenda uma opção sobre a outra — a
            escolha depende de fatores que ela não considera, como ter o valor à vista disponível
            hoje sem comprometer sua reserva financeira.
          </p>
        </div>
      ) : null}
    </div>
  );
}
