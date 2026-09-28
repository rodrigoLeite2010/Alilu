"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { addMonthsToMonth, daysInMonth, monthRange, toISO, todayISO } from "@/lib/financas/dates";
import { occurrenceStatus } from "@/lib/financas/summary";
import type { Occurrence, OccurrenceStatus } from "@/lib/financas/types";
import { money, monthLabel } from "./format";
import { OccurrenceRow, STATUS_STYLES } from "./OccurrenceRow";
import { useMonthData } from "./useMonthData";

type Filter = "all" | "income" | "paid" | "pending" | "overdue";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Todas" },
  { id: "income", label: "Receitas" },
  { id: "paid", label: "Pagas" },
  { id: "pending", label: "Pendentes" },
  { id: "overdue", label: "Vencidas" },
];

function matches(filter: Filter, status: OccurrenceStatus): boolean {
  switch (filter) {
    case "all":
      return true;
    case "income":
      return status === "income" || status === "income-received";
    case "paid":
      return status === "paid";
    case "pending":
      return status === "pending";
    case "overdue":
      return status === "overdue";
  }
}

const CHIP: Record<OccurrenceStatus, string> = {
  income: "bg-sky-100 text-sky-900",
  "income-received": "bg-teal-100 text-teal-900",
  paid: "bg-zinc-100 text-zinc-600 line-through",
  pending: "bg-amber-100 text-amber-900",
  overdue: "bg-red-100 text-red-800",
};

export function FinanceCalendar() {
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<string | null>(null);
  const { data, error, loading } = useMonthData(month);

  const today = data?.today ?? todayISO();
  const { from } = monthRange(month);
  const [year, monthNumber] = month.split("-").map(Number);
  const total = daysInMonth(year, monthNumber);
  const leading = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay(); // 0 = domingo

  const byDay = new Map<string, Occurrence[]>();
  for (const occ of data?.occurrences ?? []) {
    if (!matches(filter, occurrenceStatus(occ, today))) continue;
    byDay.set(occ.date, [...(byDay.get(occ.date) ?? []), occ]);
  }
  const selectedItems = selected ? (byDay.get(selected) ?? []) : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Button variant="secondary" aria-label="Mês anterior" onClick={() => { setMonth(addMonthsToMonth(month, -1)); setSelected(null); }}>
          ←
        </Button>
        <h2 className="text-center text-lg font-semibold capitalize text-zinc-900">{monthLabel(month)}</h2>
        <Button variant="secondary" aria-label="Próximo mês" onClick={() => { setMonth(addMonthsToMonth(month, 1)); setSelected(null); }}>
          →
        </Button>
      </div>

      <div role="group" aria-label="Filtrar" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={`min-h-9 rounded-full px-3 text-sm font-medium ring-1 ring-inset ${
              filter === f.id ? "bg-teal-700 text-white ring-teal-700" : "bg-white text-zinc-700 ring-zinc-300"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600" aria-label="Legenda">
        {(Object.keys(STATUS_STYLES) as OccurrenceStatus[]).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${CHIP[s].split(" ")[0]} ring-1 ring-inset ring-zinc-300`} aria-hidden />
            {STATUS_STYLES[s].label}
          </span>
        ))}
      </div>

      {error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {loading && !data ? <p className="text-sm text-zinc-500">Carregando...</p> : null}

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-zinc-500" aria-hidden>
        {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: leading }).map((_, i) => (
          <div key={`blank-${i}`} />
        ))}
        {Array.from({ length: total }).map((_, i) => {
          const day = i + 1;
          const iso = toISO(year, monthNumber, day);
          const items = byDay.get(iso) ?? [];
          const isToday = iso === today;
          const isSelected = iso === selected;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => setSelected(isSelected ? null : iso)}
              aria-pressed={isSelected}
              aria-label={`Dia ${day}${items.length ? `, ${items.length} lançamento${items.length > 1 ? "s" : ""}` : ""}`}
              className={`flex min-h-16 flex-col items-stretch gap-0.5 rounded-md p-1 text-left ring-1 ring-inset sm:min-h-24 ${
                isSelected ? "ring-2 ring-teal-700" : "ring-zinc-200"
              } ${isToday ? "bg-teal-50" : "bg-white"}`}
            >
              <span className={`text-xs font-semibold ${isToday ? "text-teal-800" : "text-zinc-700"}`}>{day}</span>
              {items.slice(0, 2).map((occ) => (
                <span
                  key={`${occ.entryId}-${occ.date}`}
                  className={`hidden truncate rounded px-1 text-[11px] leading-4 sm:block ${CHIP[occurrenceStatus(occ, today)]}`}
                >
                  {occ.kind === "income" ? "+" : ""}
                  {occ.description}
                </span>
              ))}
              {items.length > 0 ? (
                <span className="flex flex-wrap gap-0.5 sm:hidden" aria-hidden>
                  {items.slice(0, 4).map((occ) => (
                    <span key={`${occ.entryId}-${occ.date}`} className={`h-2 w-2 rounded-full ${CHIP[occurrenceStatus(occ, today)].split(" ")[0]} ring-1 ring-inset ring-zinc-300`} />
                  ))}
                </span>
              ) : null}
              {items.length > 2 ? <span className="hidden text-[11px] text-zinc-500 sm:block">+{items.length - 2}</span> : null}
            </button>
          );
        })}
      </div>

      {selected ? (
        <section aria-label={`Detalhes do dia ${selected.slice(8)}`} className="rounded-lg border border-zinc-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-zinc-900">
            {selected.slice(8)}/{selected.slice(5, 7)}
            {selectedItems.length > 0
              ? ` · ${money(selectedItems.reduce((sum, o) => sum + (o.kind === "income" ? o.amountCents : -o.amountCents), 0))} no dia`
              : ""}
          </h3>
          {selectedItems.length === 0 ? (
            <p className="mt-1 text-sm text-zinc-600">Nada neste dia{filter === "all" ? "" : " para este filtro"}.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {selectedItems.map((occ) => (
                <OccurrenceRow key={`${occ.entryId}-${occ.date}`} occurrence={occ} today={today} />
              ))}
            </ul>
          )}
        </section>
      ) : null}
      <span className="sr-only">Mês iniciado em {from}</span>
    </div>
  );
}
