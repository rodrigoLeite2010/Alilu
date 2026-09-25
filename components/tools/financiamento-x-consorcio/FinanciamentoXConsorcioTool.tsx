"use client";

import { useState, type FormEvent } from "react";
import { TextField } from "@/components/forms/TextField";
import { NumberField } from "@/components/forms/NumberField";
import { SelectField } from "@/components/forms/SelectField";
import { Button } from "@/components/ui/Button";
import { formatCurrencyBRL, centsDigitsToAmount } from "@/lib/formatters/currency";
import { parseLocaleNumberBRL } from "@/lib/validators/number";
import {
  compareFinancingVsConsortium,
  validateFinancingVsConsortiumInput,
  type FinancingRateType,
  type FinancingVsConsortiumFieldErrors,
  type FinancingVsConsortiumInput,
  type FinancingVsConsortiumResult,
} from "@/lib/calculators/vehicle-financing";

/**
 * "Financiamento x consórcio" (cluster Financiamento de Veículos). Compara
 * os números de cada modalidade lado a lado — NUNCA cravando uma data de
 * contemplação do consórcio, que depende de sorteio ou lance e não pode ser
 * prevista por nenhuma calculadora.
 */
export function FinanciamentoXConsorcioTool() {
  const [vehiclePriceDigits, setVehiclePriceDigits] = useState("");
  const [downPaymentDigits, setDownPaymentDigits] = useState("");
  const [rateText, setRateText] = useState("");
  const [rateType, setRateType] = useState<FinancingRateType>("mensal");
  const [installmentsText, setInstallmentsText] = useState("");
  const [consortiumInstallmentDigits, setConsortiumInstallmentDigits] = useState("");
  const [consortiumInstallmentsText, setConsortiumInstallmentsText] = useState("");
  const [errors, setErrors] = useState<FinancingVsConsortiumFieldErrors>({});
  const [result, setResult] = useState<FinancingVsConsortiumResult | null>(null);

  function clearError(field: keyof FinancingVsConsortiumFieldErrors) {
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
    setRateText("");
    setRateType("mensal");
    setInstallmentsText("");
    setConsortiumInstallmentDigits("");
    setConsortiumInstallmentsText("");
    setErrors({});
    setResult(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const input: FinancingVsConsortiumInput = {
      vehiclePrice: centsDigitsToAmount(vehiclePriceDigits),
      downPayment: downPaymentDigits ? centsDigitsToAmount(downPaymentDigits) : 0,
      rate: parseLocaleNumberBRL(rateText) ?? NaN,
      rateType,
      installments: parseLocaleNumberBRL(installmentsText) ?? NaN,
      consortiumInstallment: centsDigitsToAmount(consortiumInstallmentDigits),
      consortiumInstallments: parseLocaleNumberBRL(consortiumInstallmentsText) ?? NaN,
    };

    const nextErrors = validateFinancingVsConsortiumInput(input);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setResult(null);
      return;
    }

    setResult(compareFinancingVsConsortium(input));
  }

  return (
    <div>
      <form onSubmit={handleSubmit} noValidate className="space-y-8">
        <fieldset className="space-y-5 rounded-lg border border-zinc-200 p-4">
          <legend className="px-1 text-sm font-semibold text-zinc-900">Financiamento</legend>
          <TextField
            id="consorcio-preco"
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
            id="consorcio-entrada"
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
              id="consorcio-taxa"
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
              id="consorcio-taxa-tipo"
              label="Tipo da taxa"
              value={rateType}
              onChange={(event) => setRateType(event.target.value as FinancingRateType)}
            >
              <option value="mensal">Mensal</option>
              <option value="anual">Anual</option>
            </SelectField>
          </div>
          <NumberField
            id="consorcio-prazo"
            label="Prazo (número de parcelas)"
            placeholder="0"
            value={installmentsText}
            onChange={(event) => {
              setInstallmentsText(event.target.value);
              clearError("installments");
            }}
            error={errors.installments}
          />
        </fieldset>

        <fieldset className="space-y-5 rounded-lg border border-zinc-200 p-4">
          <legend className="px-1 text-sm font-semibold text-zinc-900">Consórcio</legend>
          <TextField
            id="consorcio-parcela"
            label="Parcela mensal do consórcio"
            inputMode="decimal"
            placeholder="R$ 0,00"
            hint="Valor informado pela administradora, já com a taxa de administração embutida"
            value={
              consortiumInstallmentDigits
                ? formatCurrencyBRL(centsDigitsToAmount(consortiumInstallmentDigits))
                : ""
            }
            onChange={(event) => {
              setConsortiumInstallmentDigits(event.target.value.replace(/\D/g, "").slice(0, 12));
              clearError("consortiumInstallment");
            }}
            error={errors.consortiumInstallment}
          />
          <NumberField
            id="consorcio-prazo-consorcio"
            label="Prazo do consórcio (número de parcelas)"
            placeholder="0"
            value={consortiumInstallmentsText}
            onChange={(event) => {
              setConsortiumInstallmentsText(event.target.value);
              clearError("consortiumInstallments");
            }}
            error={errors.consortiumInstallments}
          />
        </fieldset>

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
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Financiamento</p>
              <p className="mt-2 text-2xl font-bold text-zinc-900">
                {formatCurrencyBRL(result.financing.totalPaid)}
              </p>
              <dl className="mt-3 space-y-1 text-sm text-zinc-600">
                <div className="flex justify-between">
                  <dt>Parcela</dt>
                  <dd>{formatCurrencyBRL(result.financing.installment)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Juros</dt>
                  <dd>{formatCurrencyBRL(result.financing.totalInterest)}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-lg border border-zinc-200 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Consórcio</p>
              <p className="mt-2 text-2xl font-bold text-zinc-900">
                {formatCurrencyBRL(result.consortium.totalPaid)}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 p-3">
            <p className="text-xs text-zinc-500">Diferença (financiamento menos consórcio)</p>
            <p className="mt-1 text-sm font-semibold text-zinc-900">
              {result.difference >= 0 ? "+" : ""}
              {formatCurrencyBRL(result.difference)}
            </p>
          </div>

          <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
            Os resultados são estimativas. No financiamento, o veículo fica disponível assim que o
            contrato é assinado; no consórcio, o acesso à carta de crédito depende de sorteio ou
            lance — esta calculadora não estima nem informa uma data de contemplação.
          </p>
        </div>
      ) : null}
    </div>
  );
}
