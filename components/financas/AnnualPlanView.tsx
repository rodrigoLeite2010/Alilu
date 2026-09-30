"use client";

import { useEffect, useState } from "react";
import { summarizeAnnualPlan } from "@/lib/financas/annual";
import { todayISO } from "@/lib/financas/dates";
import type { Occurrence } from "@/lib/financas/types";
import { financeApi } from "./api";
import { money } from "./format";

const MONTH_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/**
 * "Planejamento anual": receitas, despesas e saldo mês a mês. Sem tabela
 * nova — reaproveita GET /api/financas/year (que só agrupa, por mês, o
 * mesmo motor de recorrência já usado por "Meu orçamento") e resume os
 * dados com lib/financas/annual.ts.
 */
export function AnnualPlanView() {
  const currentYear = todayISO().slice(0, 4);
  const [year, setYear] = useState(currentYear);
  const [occurrences, setOccurrences] = useState<Occurrence[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    financeApi
      .loadYear(year)
      .then((data) => {
        if (cancelled) return;
        setOccurrences(data.occurrences);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Não foi possível carregar.");
      });
    return () => {
      cancelled = true;
    };
  }, [year]);

  const plan = occurrences ? summarizeAnnualPlan(occurrences, year) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-zinc-600">Receitas, despesas e saldo mês a mês, para planejar o ano inteiro.</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setYear((y) => String(Number(y) - 1))}
            aria-label="Ano anterior"
            className="min-h-9 rounded-md px-2.5 text-sm font-semibold text-zinc-700 ring-1 ring-inset ring-zinc-300 hover:bg-zinc-50"
          >
            ←
          </button>
          <span className="min-w-12 text-center text-sm font-semibold text-zinc-900">{year}</span>
          <button
            type="button"
            onClick={() => setYear((y) => String(Number(y) + 1))}
            aria-label="Próximo ano"
            className="min-h-9 rounded-md px-2.5 text-sm font-semibold text-zinc-700 ring-1 ring-inset ring-zinc-300 hover:bg-zinc-50"
          >
            →
          </button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {plan === null && !error ? <p className="text-sm text-zinc-500">Carregando...</p> : null}

      {plan ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <p className="text-xs text-zinc-500">Receitas no ano</p>
              <p className="text-lg font-semibold text-teal-800">{money(plan.incomeTotalCents)}</p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <p className="text-xs text-zinc-500">Despesas no ano</p>
              <p className="text-lg font-semibold text-zinc-900">{money(plan.expenseTotalCents)}</p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <p className="text-xs text-zinc-500">Saldo do ano</p>
              <p className={`text-lg font-semibold ${plan.balanceTotalCents < 0 ? "text-red-700" : "text-teal-800"}`}>
                {money(plan.balanceTotalCents)}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
            <table className="w-full text-sm">
              <caption className="sr-only">Receitas, despesas e saldo de cada mês de {year}</caption>
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500">
                  <th scope="col" className="px-3 py-2 font-medium">
                    Mês
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Receitas
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Despesas
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Saldo
                  </th>
                </tr>
              </thead>
              <tbody>
                {plan.months.map((flow, i) => (
                  <tr key={flow.month} className="border-b border-zinc-100 last:border-0">
                    <th scope="row" className="px-3 py-2 text-left font-normal text-zinc-700">
                      {MONTH_SHORT[i]}
                    </th>
                    <td className="px-3 py-2 text-teal-800">{money(flow.incomeCents)}</td>
                    <td className="px-3 py-2 text-zinc-700">{money(flow.expenseCents)}</td>
                    <td className={`px-3 py-2 font-medium ${flow.balanceCents < 0 ? "text-red-700" : "text-zinc-900"}`}>
                      {money(flow.balanceCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
