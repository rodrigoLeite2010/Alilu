"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { ResultHighlight } from "@/components/results/ResultHighlight";
import {
  calculateBusinessDays,
  validateBusinessDaysInput,
  type BusinessDaysFieldErrors,
  type BusinessDaysInput,
  type BusinessDaysResult,
} from "@/lib/calculators/business-days";

/** Componente principal da Calculadora de Dias Úteis. */
export function BusinessDaysTool() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [includeStartDate, setIncludeStartDate] = useState(true);
  const [considerHolidays, setConsiderHolidays] = useState(true);
  const [considerCorpusChristi, setConsiderCorpusChristi] = useState(false);
  const [errors, setErrors] = useState<BusinessDaysFieldErrors>({});
  const [result, setResult] = useState<BusinessDaysResult | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const input: BusinessDaysInput = {
      startDate,
      endDate,
      includeStartDate,
      considerHolidays,
      considerCorpusChristi,
    };

    const nextErrors = validateBusinessDaysInput(input);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setResult(null);
      return;
    }

    setResult(calculateBusinessDays(input));
  }

  return (
    <div>
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="block">
            <label htmlFor="business-days-start" className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Data inicial
            </label>
            <input
              id="business-days-start"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              aria-invalid={errors.startDate ? true : undefined}
              className={`w-full rounded-lg border bg-white py-3 px-4 text-base text-zinc-900 focus:outline-none focus:ring-2 dark:bg-zinc-900 dark:text-zinc-50 ${
                errors.startDate
                  ? "border-red-400 focus:border-red-500 focus:ring-red-500/30"
                  : "border-zinc-300 focus:border-blue-500 focus:ring-blue-500/30 dark:border-zinc-700"
              }`}
            />
            {errors.startDate ? (
              <span role="alert" className="mt-1.5 block text-sm text-red-600 dark:text-red-400">
                {errors.startDate}
              </span>
            ) : null}
          </div>

          <div className="block">
            <label htmlFor="business-days-end" className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Data final
            </label>
            <input
              id="business-days-end"
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              aria-invalid={errors.endDate ? true : undefined}
              className={`w-full rounded-lg border bg-white py-3 px-4 text-base text-zinc-900 focus:outline-none focus:ring-2 dark:bg-zinc-900 dark:text-zinc-50 ${
                errors.endDate
                  ? "border-red-400 focus:border-red-500 focus:ring-red-500/30"
                  : "border-zinc-300 focus:border-blue-500 focus:ring-blue-500/30 dark:border-zinc-700"
              }`}
            />
            {errors.endDate ? (
              <span role="alert" className="mt-1.5 block text-sm text-red-600 dark:text-red-400">
                {errors.endDate}
              </span>
            ) : null}
          </div>
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={includeStartDate}
              onChange={(event) => setIncludeStartDate(event.target.checked)}
              className="h-5 w-5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500/30 dark:border-zinc-700"
            />
            Incluir a data inicial na contagem
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={considerHolidays}
              onChange={(event) => setConsiderHolidays(event.target.checked)}
              className="h-5 w-5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500/30 dark:border-zinc-700"
            />
            Descontar feriados nacionais
          </label>
          {considerHolidays ? (
            <label className="ml-7 flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
              <input
                type="checkbox"
                checked={considerCorpusChristi}
                onChange={(event) => setConsiderCorpusChristi(event.target.checked)}
                className="h-5 w-5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500/30 dark:border-zinc-700"
              />
              Considerar também o Corpus Christi (uso consolidado no calendário oficial)
            </label>
          ) : null}
        </div>

        <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          Só são considerados feriados NACIONAIS (fixos e móveis, calculados a partir da
          Páscoa). Feriados estaduais, municipais e pontos facultativos não são considerados.
        </p>

        <Button type="submit" className="w-full sm:w-auto">
          Calcular
        </Button>
      </form>

      {result ? (
        <div className="mt-8 space-y-4">
          <ResultHighlight label="Dias úteis" value={result.headline} />
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
              <dt className="text-xs text-zinc-500 dark:text-zinc-400">Dias corridos</dt>
              <dd className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50">{result.totalDays}</dd>
            </div>
            <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
              <dt className="text-xs text-zinc-500 dark:text-zinc-400">Sábados</dt>
              <dd className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50">{result.saturdays}</dd>
            </div>
            <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
              <dt className="text-xs text-zinc-500 dark:text-zinc-400">Domingos</dt>
              <dd className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50">{result.sundays}</dd>
            </div>
            <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
              <dt className="text-xs text-zinc-500 dark:text-zinc-400">Feriados nacionais</dt>
              <dd className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50">{result.holidaysCount}</dd>
            </div>
          </dl>
          {result.holidayDates.length > 0 ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Feriados considerados: {result.holidayDates.join(", ")}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
