"use client";

import { useState, type FormEvent } from "react";
import { TextField } from "@/components/forms/TextField";
import { NumberField } from "@/components/forms/NumberField";
import { Button } from "@/components/ui/Button";
import { ResultHighlight } from "@/components/results/ResultHighlight";
import {
  centsDigitsToAmount,
  formatCurrencyBRL,
  formatPercentage,
} from "@/lib/formatters/currency";
import { parseLocaleNumberBRL } from "@/lib/validators/number";
import {
  calculateMarkup,
  validateMarkupInput,
  type MarkupFieldErrors,
  type MarkupInput,
  type MarkupResult,
} from "@/lib/calculators/markup";

/**
 * Componente principal da Calculadora de Markup: formulário e resultado
 * juntos (mesmo padrão da Calculadora de Juros Compostos), permitindo
 * recalcular ajustando os campos.
 */
export function MarkupTool() {
  const [costDigits, setCostDigits] = useState("");
  const [variableText, setVariableText] = useState("");
  const [fixedText, setFixedText] = useState("");
  const [marginText, setMarginText] = useState("");
  const [errors, setErrors] = useState<MarkupFieldErrors>({});
  const [result, setResult] = useState<MarkupResult | null>(null);

  function clearError(field: keyof MarkupFieldErrors) {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const input: MarkupInput = {
      cost: centsDigitsToAmount(costDigits),
      variableExpenses: parseLocaleNumberBRL(variableText) ?? NaN,
      fixedExpenses: parseLocaleNumberBRL(fixedText) ?? NaN,
      desiredMargin: parseLocaleNumberBRL(marginText) ?? NaN,
    };

    const nextErrors = validateMarkupInput(input);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setResult(null);
      return;
    }

    setResult(calculateMarkup(input));
  }

  return (
    <div>
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <TextField
          id="markup-cost"
          label="Custo do produto/serviço"
          inputMode="decimal"
          placeholder="R$ 0,00"
          value={costDigits ? formatCurrencyBRL(centsDigitsToAmount(costDigits)) : ""}
          onChange={(event) => {
            setCostDigits(event.target.value.replace(/\D/g, "").slice(0, 12));
            clearError("cost");
          }}
          error={errors.cost}
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <NumberField
            id="markup-variable"
            label="Despesas variáveis"
            suffix="%"
            hint="Impostos, comissões, taxas de cartão"
            placeholder="0"
            value={variableText}
            onChange={(event) => {
              setVariableText(event.target.value);
              clearError("variableExpenses");
            }}
            error={errors.variableExpenses}
          />
          <NumberField
            id="markup-fixed"
            label="Despesas fixas"
            suffix="%"
            hint="Rateio de custos fixos"
            placeholder="0"
            value={fixedText}
            onChange={(event) => {
              setFixedText(event.target.value);
              clearError("fixedExpenses");
            }}
            error={errors.fixedExpenses}
          />
          <NumberField
            id="markup-margin"
            label="Margem de lucro desejada"
            suffix="%"
            placeholder="0"
            value={marginText}
            onChange={(event) => {
              setMarginText(event.target.value);
              clearError("desiredMargin");
            }}
            error={errors.desiredMargin}
          />
        </div>

        <Button type="submit" className="w-full sm:w-auto">
          Calcular
        </Button>
      </form>

      {result ? (
        <div className="mt-8 space-y-4">
          <ResultHighlight label="Preço de venda sugerido" value={formatCurrencyBRL(result.headline)} />
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-zinc-200 p-3">
              <dt className="text-xs text-zinc-500">Markup multiplicador</dt>
              <dd className="mt-1 text-sm font-semibold text-zinc-900">
                × {result.multiplier.toFixed(2).replace(".", ",")}
              </dd>
            </div>
            <div className="rounded-lg border border-zinc-200 p-3">
              <dt className="text-xs text-zinc-500">Lucro no preço de venda</dt>
              <dd className="mt-1 text-sm font-semibold text-emerald-700">
                {formatCurrencyBRL(result.profitAmount)}
              </dd>
            </div>
            <div className="rounded-lg border border-zinc-200 p-3">
              <dt className="text-xs text-zinc-500">Total de percentuais</dt>
              <dd className="mt-1 text-sm font-semibold text-zinc-900">
                {formatPercentage(result.totalPercent)}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}
    </div>
  );
}
