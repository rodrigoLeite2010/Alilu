"use client";

import { useState, type FormEvent } from "react";
import { TextField } from "@/components/forms/TextField";
import { NumberField } from "@/components/forms/NumberField";
import { SelectField } from "@/components/forms/SelectField";
import { Button } from "@/components/ui/Button";
import {
  centsDigitsToAmount,
  formatCurrencyBRL,
} from "@/lib/formatters/currency";
import { parseLocaleNumberBRL } from "@/lib/validators/number";
import {
  calculateFinancing,
  validateFinancingInput,
  type FinancingFieldErrors,
  type FinancingInput,
  type FinancingRateType,
  type FinancingResult,
  type FinancingSystem,
} from "@/lib/calculators/financing";

/**
 * Formulário do Simulador de Financiamento SAC x Price. Todo o cálculo
 * acontece no navegador (lib/calculators/financing.ts) — nenhum valor
 * digitado é enviado para servidor, salvo em cookies ou em
 * localStorage/sessionStorage.
 */
export function FinancingForm({
  onCalculate,
}: {
  onCalculate: (result: FinancingResult) => void;
}) {
  const [assetValueDigits, setAssetValueDigits] = useState("");
  const [downPaymentDigits, setDownPaymentDigits] = useState("");
  const [rateText, setRateText] = useState("");
  const [rateType, setRateType] = useState<FinancingRateType>("mensal");
  const [installmentsText, setInstallmentsText] = useState("");
  const [system, setSystem] = useState<FinancingSystem>("comparar");
  const [errors, setErrors] = useState<FinancingFieldErrors>({});

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
      assetValue: centsDigitsToAmount(assetValueDigits),
      downPayment: centsDigitsToAmount(downPaymentDigits),
      rate: parseLocaleNumberBRL(rateText) ?? NaN,
      rateType,
      installments: parseLocaleNumberBRL(installmentsText) ?? NaN,
      system,
    };

    const nextErrors = validateFinancingInput(input);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    onCalculate(calculateFinancing(input));
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <TextField
        id="financing-asset-value"
        label="Valor do bem"
        inputMode="decimal"
        placeholder="R$ 0,00"
        value={
          assetValueDigits
            ? formatCurrencyBRL(centsDigitsToAmount(assetValueDigits))
            : ""
        }
        onChange={(event) => {
          setAssetValueDigits(event.target.value.replace(/\D/g, "").slice(0, 12));
          clearError("assetValue");
        }}
        error={errors.assetValue}
      />

      <TextField
        id="financing-down-payment"
        label="Entrada"
        inputMode="decimal"
        placeholder="R$ 0,00"
        hint="Opcional"
        value={
          downPaymentDigits
            ? formatCurrencyBRL(centsDigitsToAmount(downPaymentDigits))
            : ""
        }
        onChange={(event) => {
          setDownPaymentDigits(
            event.target.value.replace(/\D/g, "").slice(0, 12)
          );
          clearError("downPayment");
        }}
        error={errors.downPayment}
      />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <NumberField
          id="financing-rate"
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
          id="financing-rate-type"
          label="Tipo da taxa"
          value={rateType}
          onChange={(event) =>
            setRateType(event.target.value as FinancingRateType)
          }
        >
          <option value="mensal">Mensal</option>
          <option value="anual">Anual</option>
        </SelectField>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <NumberField
          id="financing-installments"
          label="Número de parcelas"
          placeholder="0"
          value={installmentsText}
          onChange={(event) => {
            setInstallmentsText(event.target.value);
            clearError("installments");
          }}
          error={errors.installments}
        />

        <SelectField
          id="financing-system"
          label="Sistema"
          value={system}
          onChange={(event) => setSystem(event.target.value as FinancingSystem)}
        >
          <option value="price">Price</option>
          <option value="sac">SAC</option>
          <option value="comparar">Comparar os dois</option>
        </SelectField>
      </div>

      <Button type="submit" className="w-full sm:w-auto">
        Simular
      </Button>
    </form>
  );
}
