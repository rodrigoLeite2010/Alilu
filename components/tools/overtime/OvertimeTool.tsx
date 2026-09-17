"use client";

import { useState, type FormEvent } from "react";
import { TextField } from "@/components/forms/TextField";
import { NumberField } from "@/components/forms/NumberField";
import { SelectField } from "@/components/forms/SelectField";
import { Button } from "@/components/ui/Button";
import { ResultHighlight } from "@/components/results/ResultHighlight";
import { centsDigitsToAmount, formatCurrencyBRL } from "@/lib/formatters/currency";
import { parseLocaleNumberBRL } from "@/lib/validators/number";
import {
  calculateOvertime,
  validateOvertimeInput,
  type OvertimeFieldErrors,
  type OvertimeInput,
  type OvertimeResult,
} from "@/lib/calculators/overtime";

/** Componente principal da Calculadora de Hora Extra. */
export function OvertimeTool() {
  const [salaryDigits, setSalaryDigits] = useState("");
  const [weeklyHoursText, setWeeklyHoursText] = useState("44");
  const [overtimeHoursText, setOvertimeHoursText] = useState("");
  const [overtimePercent, setOvertimePercent] = useState("50");
  const [errors, setErrors] = useState<OvertimeFieldErrors>({});
  const [result, setResult] = useState<OvertimeResult | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const input: OvertimeInput = {
      monthlySalary: centsDigitsToAmount(salaryDigits),
      weeklyHours: parseLocaleNumberBRL(weeklyHoursText) ?? NaN,
      overtimeHours: parseLocaleNumberBRL(overtimeHoursText) ?? NaN,
      overtimePercent: parseLocaleNumberBRL(overtimePercent) ?? NaN,
    };

    const nextErrors = validateOvertimeInput(input);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setResult(null);
      return;
    }

    setResult(calculateOvertime(input));
  }

  return (
    <div>
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <TextField
          id="overtime-salary"
          label="Salário mensal bruto"
          inputMode="decimal"
          placeholder="R$ 0,00"
          value={salaryDigits ? formatCurrencyBRL(centsDigitsToAmount(salaryDigits)) : ""}
          onChange={(event) => setSalaryDigits(event.target.value.replace(/\D/g, "").slice(0, 12))}
          error={errors.monthlySalary}
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <SelectField
            id="overtime-weekly-hours"
            label="Jornada semanal"
            hint="Define o divisor mensal (jornada × 5)"
            value={weeklyHoursText}
            onChange={(event) => setWeeklyHoursText(event.target.value)}
          >
            <option value="44">44 horas (divisor 220)</option>
            <option value="40">40 horas (divisor 200)</option>
            <option value="36">36 horas (divisor 180)</option>
            <option value="30">30 horas (divisor 150)</option>
          </SelectField>

          <NumberField
            id="overtime-hours"
            label="Horas extras no período"
            suffix="h"
            placeholder="0"
            value={overtimeHoursText}
            onChange={(event) => setOvertimeHoursText(event.target.value)}
            error={errors.overtimeHours}
          />
        </div>

        <SelectField
          id="overtime-percent"
          label="Adicional de hora extra"
          hint="50% é o mínimo constitucional (art. 7º, XVI, CF)"
          value={overtimePercent}
          onChange={(event) => setOvertimePercent(event.target.value)}
        >
          <option value="50">50%</option>
          <option value="100">100% (comum em domingos/feriados)</option>
        </SelectField>

        <Button type="submit" className="w-full sm:w-auto">
          Calcular
        </Button>
      </form>

      {result ? (
        <div className="mt-8 space-y-4">
          <ResultHighlight label="Valor total das horas extras" value={formatCurrencyBRL(result.headline)} />
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
              <dt className="text-xs text-zinc-500 dark:text-zinc-400">Divisor mensal</dt>
              <dd className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                {result.monthlyHoursDivisor}
              </dd>
            </div>
            <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
              <dt className="text-xs text-zinc-500 dark:text-zinc-400">Valor da hora normal</dt>
              <dd className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                {formatCurrencyBRL(result.normalHourValue)}
              </dd>
            </div>
            <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
              <dt className="text-xs text-zinc-500 dark:text-zinc-400">Valor da hora extra</dt>
              <dd className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                {formatCurrencyBRL(result.overtimeHourValue)}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}
    </div>
  );
}
