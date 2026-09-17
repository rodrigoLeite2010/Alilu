"use client";

import { useState, type FormEvent } from "react";
import { TextField } from "@/components/forms/TextField";
import { NumberField } from "@/components/forms/NumberField";
import { Button } from "@/components/ui/Button";
import { ResultHighlight } from "@/components/results/ResultHighlight";
import { centsDigitsToAmount, formatCurrencyBRL } from "@/lib/formatters/currency";
import { parseLocaleNumberBRL } from "@/lib/validators/number";
import {
  calculateThirteenthSalary,
  validateThirteenthSalaryInput,
  type ThirteenthSalaryFieldErrors,
  type ThirteenthSalaryInput,
  type ThirteenthSalaryResult,
} from "@/lib/calculators/thirteenth-salary";
import { PAYROLL_TABLE_REFERENCE_YEAR } from "@/lib/calculators/payroll-tables";

/**
 * Componente principal da Calculadora de 13º Salário. Permite informar
 * salário e meses trabalhados no ano, mostrando o cálculo e os descontos das
 * duas parcelas separadamente (PROMPT MESTRE, "13º Salário").
 */
export function ThirteenthSalaryTool() {
  const [grossDigits, setGrossDigits] = useState("");
  const [monthsText, setMonthsText] = useState("12");
  const [dependentsText, setDependentsText] = useState("");
  const [errors, setErrors] = useState<ThirteenthSalaryFieldErrors>({});
  const [result, setResult] = useState<ThirteenthSalaryResult | null>(null);

  function clearError(field: keyof ThirteenthSalaryFieldErrors) {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const input: ThirteenthSalaryInput = {
      grossSalary: centsDigitsToAmount(grossDigits),
      monthsWorked: parseLocaleNumberBRL(monthsText) ?? NaN,
      dependents: dependentsText ? parseLocaleNumberBRL(dependentsText) ?? NaN : 0,
    };

    const nextErrors = validateThirteenthSalaryInput(input);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setResult(null);
      return;
    }

    setResult(calculateThirteenthSalary(input));
  }

  return (
    <div>
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <TextField
          id="thirteenth-gross"
          label="Salário bruto"
          inputMode="decimal"
          placeholder="R$ 0,00"
          value={grossDigits ? formatCurrencyBRL(centsDigitsToAmount(grossDigits)) : ""}
          onChange={(event) => {
            setGrossDigits(event.target.value.replace(/\D/g, "").slice(0, 12));
            clearError("grossSalary");
          }}
          error={errors.grossSalary}
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <NumberField
            id="thirteenth-months"
            label="Meses trabalhados no ano"
            hint="Mês com 15 dias ou mais conta como completo"
            placeholder="12"
            value={monthsText}
            onChange={(event) => {
              setMonthsText(event.target.value);
              clearError("monthsWorked");
            }}
            error={errors.monthsWorked}
          />
          <NumberField
            id="thirteenth-dependents"
            label="Número de dependentes"
            hint="Para fins de IRRF (opcional)"
            placeholder="0"
            value={dependentsText}
            onChange={(event) => {
              setDependentsText(event.target.value);
              clearError("dependents");
            }}
            error={errors.dependents}
          />
        </div>

        <Button type="submit" className="w-full sm:w-auto">
          Calcular
        </Button>
      </form>

      {result ? (
        <div className="mt-8 space-y-4">
          <ResultHighlight label="Valor líquido total" value={formatCurrencyBRL(result.headline)} />

          <div>
            <h3 className="mb-2 text-sm font-semibold text-zinc-900">
              Memória de cálculo
            </h3>
            <dl className="divide-y divide-zinc-200 rounded-lg border border-zinc-200">
              <div className="flex items-center justify-between p-3">
                <dt className="text-sm text-zinc-600">13º bruto proporcional</dt>
                <dd className="text-sm font-medium text-zinc-900">
                  {formatCurrencyBRL(result.grossTotal)}
                </dd>
              </div>
              <div className="flex items-center justify-between p-3">
                <dt className="text-sm text-zinc-600">
                  1ª parcela (sem descontos)
                </dt>
                <dd className="text-sm font-medium text-zinc-900">
                  {formatCurrencyBRL(result.firstInstallment)}
                </dd>
              </div>
              <div className="flex items-center justify-between p-3">
                <dt className="text-sm text-zinc-600">2ª parcela (bruta)</dt>
                <dd className="text-sm font-medium text-zinc-900">
                  {formatCurrencyBRL(result.secondInstallmentGross)}
                </dd>
              </div>
              <div className="flex items-center justify-between p-3">
                <dt className="text-sm text-zinc-600">
                  (−) INSS (sobre o 13º total)
                </dt>
                <dd className="text-sm font-medium text-red-700">
                  {formatCurrencyBRL(result.inss)}
                </dd>
              </div>
              <div className="flex items-center justify-between p-3">
                <dt className="text-sm text-zinc-600">
                  (−) IRRF (sobre o 13º total)
                </dt>
                <dd className="text-sm font-medium text-red-700">
                  {formatCurrencyBRL(result.irrf)}
                </dd>
              </div>
              <div className="flex items-center justify-between p-3">
                <dt className="text-sm font-semibold text-zinc-900">
                  2ª parcela (líquida)
                </dt>
                <dd className="text-sm font-semibold text-zinc-900">
                  {formatCurrencyBRL(result.secondInstallmentNet)}
                </dd>
              </div>
              <div className="flex items-center justify-between bg-emerald-50 p-3">
                <dt className="text-sm font-semibold text-emerald-800">
                  Valor líquido total (1ª + 2ª)
                </dt>
                <dd className="text-sm font-semibold text-emerald-800">
                  {formatCurrencyBRL(result.netTotal)}
                </dd>
              </div>
            </dl>
          </div>

          <p className="text-xs text-zinc-500">
            A 1ª parcela é paga sem descontos; o INSS e o IRRF do 13º inteiro são concentrados na
            2ª parcela, conforme a prática usual de folha de pagamento. Cálculo com base nas
            tabelas oficiais de INSS e IRRF vigentes em {PAYROLL_TABLE_REFERENCE_YEAR} — não
            substitui o holerite oficial.
          </p>
        </div>
      ) : null}
    </div>
  );
}
