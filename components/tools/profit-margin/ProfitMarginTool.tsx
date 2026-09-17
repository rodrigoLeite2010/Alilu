"use client";

import { useState, type FormEvent } from "react";
import { TextField } from "@/components/forms/TextField";
import { Button } from "@/components/ui/Button";
import { ResultHighlight } from "@/components/results/ResultHighlight";
import { centsDigitsToAmount, formatCurrencyBRL, formatPercentage } from "@/lib/formatters/currency";
import {
  calculateProfitMargin,
  validateProfitMarginInput,
  type ProfitMarginFieldErrors,
  type ProfitMarginInput,
  type ProfitMarginResult,
} from "@/lib/calculators/profit-margin";

/** Componente principal da Calculadora de Margem de Lucro. */
export function ProfitMarginTool() {
  const [costDigits, setCostDigits] = useState("");
  const [priceDigits, setPriceDigits] = useState("");
  const [errors, setErrors] = useState<ProfitMarginFieldErrors>({});
  const [result, setResult] = useState<ProfitMarginResult | null>(null);

  function clearError(field: keyof ProfitMarginFieldErrors) {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const input: ProfitMarginInput = {
      cost: centsDigitsToAmount(costDigits),
      salePrice: centsDigitsToAmount(priceDigits),
    };

    const nextErrors = validateProfitMarginInput(input);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setResult(null);
      return;
    }

    setResult(calculateProfitMargin(input));
  }

  const isLoss = result ? result.profitAmount < 0 : false;

  return (
    <div>
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <TextField
            id="profit-margin-cost"
            label="Custo"
            inputMode="decimal"
            placeholder="R$ 0,00"
            value={costDigits ? formatCurrencyBRL(centsDigitsToAmount(costDigits)) : ""}
            onChange={(event) => {
              setCostDigits(event.target.value.replace(/\D/g, "").slice(0, 12));
              clearError("cost");
            }}
            error={errors.cost}
          />
          <TextField
            id="profit-margin-price"
            label="Preço de venda"
            inputMode="decimal"
            placeholder="R$ 0,00"
            value={priceDigits ? formatCurrencyBRL(centsDigitsToAmount(priceDigits)) : ""}
            onChange={(event) => {
              setPriceDigits(event.target.value.replace(/\D/g, "").slice(0, 12));
              clearError("salePrice");
            }}
            error={errors.salePrice}
          />
        </div>

        <Button type="submit" className="w-full sm:w-auto">
          Calcular
        </Button>
      </form>

      {result ? (
        <div className="mt-8 space-y-4">
          <ResultHighlight
            label={isLoss ? "Margem de lucro (prejuízo)" : "Margem de lucro"}
            value={formatPercentage(result.headline)}
          />
          <dl className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-zinc-200 p-3">
              <dt className="text-xs text-zinc-500">Lucro em valor</dt>
              <dd
                className={`mt-1 text-sm font-semibold ${
                  isLoss ? "text-red-700" : "text-emerald-700"
                }`}
              >
                {formatCurrencyBRL(result.profitAmount)}
              </dd>
            </div>
            <div className="rounded-lg border border-zinc-200 p-3">
              <dt className="text-xs text-zinc-500">Markup equivalente</dt>
              <dd className="mt-1 text-sm font-semibold text-zinc-900">
                {formatPercentage(result.markupPercent)}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}
    </div>
  );
}
