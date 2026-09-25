"use client";

import { useState, type FormEvent } from "react";
import { TextField } from "@/components/forms/TextField";
import { Button } from "@/components/ui/Button";
import { ResultHighlight } from "@/components/results/ResultHighlight";
import { formatCurrencyBRL, centsDigitsToAmount } from "@/lib/formatters/currency";
import {
  calculateMonthlyCarCost,
  validateMonthlyCarCostInput,
  type MonthlyCarCostFieldErrors,
  type MonthlyCarCostInput,
  type MonthlyCarCostResult,
} from "@/lib/calculators/vehicle-financing";

interface FieldConfig {
  key: keyof MonthlyCarCostInput;
  label: string;
  hint?: string;
  /** true para os dois únicos campos anuais (IPVA e licenciamento) — os demais são mensais. */
  annual?: boolean;
}

const FIELDS: FieldConfig[] = [
  { key: "installment", label: "Parcela do financiamento", hint: "0 se o carro não for financiado" },
  { key: "fuel", label: "Combustível" },
  { key: "insurance", label: "Seguro" },
  { key: "ipvaAnnual", label: "IPVA (valor anual)", annual: true },
  { key: "licensingAnnual", label: "Licenciamento (valor anual)", annual: true },
  { key: "maintenance", label: "Manutenção" },
  { key: "parking", label: "Estacionamento" },
  { key: "tolls", label: "Pedágio" },
  { key: "other", label: "Outros gastos" },
];

const BAR_COLORS = [
  "bg-teal-600",
  "bg-emerald-600",
  "bg-amber-500",
  "bg-sky-600",
  "bg-violet-600",
  "bg-rose-500",
  "bg-lime-600",
  "bg-orange-500",
  "bg-zinc-500",
];

type DigitsState = Record<keyof MonthlyCarCostInput, string>;

function emptyDigits(): DigitsState {
  return {
    installment: "",
    fuel: "",
    insurance: "",
    ipvaAnnual: "",
    licensingAnnual: "",
    maintenance: "",
    parking: "",
    tolls: "",
    other: "",
  };
}

/**
 * "Custo mensal de possuir um carro" (cluster Financiamento de Veículos).
 * Soma parcela, combustível, seguro, IPVA e licenciamento (rateados por 12),
 * manutenção, estacionamento, pedágio e outros gastos. O gráfico por
 * categoria é decorativo (aria-hidden) — os mesmos números já ficam
 * acessíveis na lista logo abaixo, mesma técnica sem dependência nova usada
 * em FinancingBalanceChart.
 */
export function CustoMensalCarroTool() {
  const [digits, setDigits] = useState<DigitsState>(emptyDigits());
  const [errors, setErrors] = useState<MonthlyCarCostFieldErrors>({});
  const [result, setResult] = useState<MonthlyCarCostResult | null>(null);

  function clearError(field: keyof MonthlyCarCostFieldErrors) {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function handleClear() {
    setDigits(emptyDigits());
    setErrors({});
    setResult(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const input: MonthlyCarCostInput = {
      installment: centsDigitsToAmount(digits.installment),
      fuel: centsDigitsToAmount(digits.fuel),
      insurance: centsDigitsToAmount(digits.insurance),
      ipvaAnnual: centsDigitsToAmount(digits.ipvaAnnual),
      licensingAnnual: centsDigitsToAmount(digits.licensingAnnual),
      maintenance: centsDigitsToAmount(digits.maintenance),
      parking: centsDigitsToAmount(digits.parking),
      tolls: centsDigitsToAmount(digits.tolls),
      other: centsDigitsToAmount(digits.other),
    };

    const nextErrors = validateMonthlyCarCostInput(input);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setResult(null);
      return;
    }

    setResult(calculateMonthlyCarCost(input));
  }

  const nonZeroCategories = result ? result.categories.filter((category) => category.monthlyAmount > 0) : [];
  const maxCategoryAmount = Math.max(1, ...nonZeroCategories.map((category) => category.monthlyAmount));

  return (
    <div>
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {FIELDS.map((field) => (
          <TextField
            key={field.key}
            id={`custo-carro-${field.key}`}
            label={field.label}
            inputMode="decimal"
            placeholder="R$ 0,00"
            hint={field.hint}
            value={digits[field.key] ? formatCurrencyBRL(centsDigitsToAmount(digits[field.key])) : ""}
            onChange={(event) => {
              const nextValue = event.target.value.replace(/\D/g, "").slice(0, 12);
              setDigits((current) => ({ ...current, [field.key]: nextValue }));
              clearError(field.key);
            }}
            error={errors[field.key]}
          />
        ))}

        <div className="flex flex-wrap gap-3">
          <Button type="submit">Calcular</Button>
          <Button type="button" variant="secondary" onClick={handleClear}>
            Limpar
          </Button>
        </div>
      </form>

      {result ? (
        <div className="mt-8 space-y-6">
          <ResultHighlight label="Custo mensal total" value={formatCurrencyBRL(result.monthlyTotal)} />

          <div className="rounded-lg border border-zinc-200 p-3">
            <p className="text-xs text-zinc-500">Custo anual estimado</p>
            <p className="mt-1 text-sm font-semibold text-zinc-900">
              {formatCurrencyBRL(result.annualTotal)}
            </p>
          </div>

          {nonZeroCategories.length > 0 ? (
            <div>
              <p className="text-sm font-semibold text-zinc-900">Custo por categoria</p>
              <ul className="mt-3 space-y-2">
                {nonZeroCategories.map((category, index) => (
                  <li key={category.key} className="flex items-center gap-3">
                    <span className="w-32 shrink-0 truncate text-xs text-zinc-600">{category.label}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100" aria-hidden="true">
                      <span
                        className={`block h-full rounded-full ${BAR_COLORS[index % BAR_COLORS.length]}`}
                        style={{ width: `${(category.monthlyAmount / maxCategoryAmount) * 100}%` }}
                      />
                    </span>
                    <span className="w-24 shrink-0 text-right text-xs font-medium text-zinc-900">
                      {formatCurrencyBRL(category.monthlyAmount)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
