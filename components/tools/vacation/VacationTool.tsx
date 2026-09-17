"use client";

import { useState, type FormEvent } from "react";
import { TextField } from "@/components/forms/TextField";
import { NumberField } from "@/components/forms/NumberField";
import { Button } from "@/components/ui/Button";
import { ResultHighlight } from "@/components/results/ResultHighlight";
import { centsDigitsToAmount, formatCurrencyBRL } from "@/lib/formatters/currency";
import { parseLocaleNumberBRL } from "@/lib/validators/number";
import {
  calculateVacation,
  validateVacationInput,
  type VacationFieldErrors,
  type VacationInput,
  type VacationResult,
} from "@/lib/calculators/vacation";
import { PAYROLL_TABLE_REFERENCE_YEAR } from "@/lib/calculators/payroll-tables";

/**
 * Componente principal da Calculadora de Férias. Mostra os componentes do
 * cálculo separadamente (férias, terço constitucional, abono pecuniário,
 * descontos) e nunca mistura valores brutos com líquidos sem identificação
 * clara (PROMPT MESTRE, "Calculadora de Férias").
 */
export function VacationTool() {
  const [grossDigits, setGrossDigits] = useState("");
  const [vacationDaysText, setVacationDaysText] = useState("30");
  const [sellDaysText, setSellDaysText] = useState("0");
  const [dependentsText, setDependentsText] = useState("");
  const [errors, setErrors] = useState<VacationFieldErrors>({});
  const [result, setResult] = useState<VacationResult | null>(null);

  function clearError(field: keyof VacationFieldErrors) {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const input: VacationInput = {
      grossSalary: centsDigitsToAmount(grossDigits),
      vacationDays: parseLocaleNumberBRL(vacationDaysText) ?? NaN,
      sellDays: sellDaysText ? parseLocaleNumberBRL(sellDaysText) ?? NaN : 0,
      dependents: dependentsText ? parseLocaleNumberBRL(dependentsText) ?? NaN : 0,
    };

    const nextErrors = validateVacationInput(input);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setResult(null);
      return;
    }

    setResult(calculateVacation(input));
  }

  return (
    <div>
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <TextField
          id="vacation-gross"
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
            id="vacation-days"
            label="Dias de férias gozados"
            hint="De 1 a 30 dias"
            placeholder="30"
            value={vacationDaysText}
            onChange={(event) => {
              setVacationDaysText(event.target.value);
              clearError("vacationDays");
            }}
            error={errors.vacationDays}
          />
          <NumberField
            id="vacation-sell-days"
            label="Dias vendidos (abono pecuniário)"
            hint="No máximo 10 dias (1/3 de 30)"
            placeholder="0"
            value={sellDaysText}
            onChange={(event) => {
              setSellDaysText(event.target.value);
              clearError("sellDays");
            }}
            error={errors.sellDays}
          />
        </div>

        <NumberField
          id="vacation-dependents"
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

        <Button type="submit" className="w-full sm:w-auto">
          Calcular
        </Button>
      </form>

      {result ? (
        <div className="mt-8 space-y-4">
          <ResultHighlight label="Valor líquido a receber" value={formatCurrencyBRL(result.headline)} />

          <div>
            <h3 className="mb-2 text-sm font-semibold text-zinc-900">
              Memória de cálculo
            </h3>
            <dl className="divide-y divide-zinc-200 rounded-lg border border-zinc-200">
              <div className="flex items-center justify-between p-3">
                <dt className="text-sm text-zinc-600">Férias (dias gozados)</dt>
                <dd className="text-sm font-medium text-zinc-900">
                  {formatCurrencyBRL(result.vacationGrossValue)}
                </dd>
              </div>
              <div className="flex items-center justify-between p-3">
                <dt className="text-sm text-zinc-600">
                  (+) Terço constitucional
                </dt>
                <dd className="text-sm font-medium text-zinc-900">
                  {formatCurrencyBRL(result.oneThird)}
                </dd>
              </div>
              {result.abonoValue > 0 ? (
                <>
                  <div className="flex items-center justify-between p-3">
                    <dt className="text-sm text-zinc-600">
                      (+) Abono pecuniário
                    </dt>
                    <dd className="text-sm font-medium text-zinc-900">
                      {formatCurrencyBRL(result.abonoValue)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between p-3">
                    <dt className="text-sm text-zinc-600">
                      (+) Terço sobre o abono
                    </dt>
                    <dd className="text-sm font-medium text-zinc-900">
                      {formatCurrencyBRL(result.abonoOneThird)}
                    </dd>
                  </div>
                </>
              ) : null}
              <div className="flex items-center justify-between p-3">
                <dt className="text-sm font-semibold text-zinc-900">
                  Total bruto
                </dt>
                <dd className="text-sm font-semibold text-zinc-900">
                  {formatCurrencyBRL(result.grossTotal)}
                </dd>
              </div>
              <div className="flex items-center justify-between p-3">
                <dt className="text-sm text-zinc-600">(−) INSS</dt>
                <dd className="text-sm font-medium text-red-700">
                  {formatCurrencyBRL(result.inss)}
                </dd>
              </div>
              <div className="flex items-center justify-between p-3">
                <dt className="text-sm text-zinc-600">(−) IRRF</dt>
                <dd className="text-sm font-medium text-red-700">
                  {formatCurrencyBRL(result.irrf)}
                </dd>
              </div>
              <div className="flex items-center justify-between bg-emerald-50 p-3">
                <dt className="text-sm font-semibold text-emerald-800">
                  Valor líquido a receber
                </dt>
                <dd className="text-sm font-semibold text-emerald-800">
                  {formatCurrencyBRL(result.netTotal)}
                </dd>
              </div>
            </dl>
          </div>

          <p className="text-xs text-zinc-500">
            O abono pecuniário (venda de férias) é isento de INSS e IRRF. Já o terço
            constitucional sobre o abono, embora também isento de INSS, é tributável para fins de
            IRRF. Cálculo com base nas tabelas oficiais de INSS e IRRF vigentes em{" "}
            {PAYROLL_TABLE_REFERENCE_YEAR}, aplicadas apenas sobre o valor das férias, de forma
            isolada do salário do mês — não substitui o holerite oficial.
          </p>
        </div>
      ) : null}
    </div>
  );
}
