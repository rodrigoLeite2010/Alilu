"use client";

import { useState } from "react";
import { occurrenceStatus } from "@/lib/financas/summary";
import type { Occurrence, OccurrenceStatus } from "@/lib/financas/types";
import { financeApi, notifyFinanceChanged } from "./api";
import { money, shortDate } from "./format";

export const STATUS_STYLES: Record<OccurrenceStatus, { label: string; className: string }> = {
  income: { label: "A receber", className: "bg-sky-50 text-sky-800" },
  "income-received": { label: "Recebida", className: "bg-teal-50 text-teal-800" },
  paid: { label: "Paga", className: "bg-teal-50 text-teal-800" },
  pending: { label: "Pendente", className: "bg-amber-50 text-amber-800" },
  overdue: { label: "Vencida", className: "bg-red-50 text-red-700" },
};

/** Linha de uma ocorrência com botão de marcar como paga/recebida (e desfazer). */
export function OccurrenceRow({ occurrence, today, hint }: { occurrence: Occurrence; today: string; hint?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const status = occurrenceStatus(occurrence, today);
  const style = STATUS_STYLES[status];
  const isIncome = occurrence.kind === "income";

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      await financeApi.setPaid(occurrence.entryId, occurrence.date, !occurrence.paid);
      notifyFinanceChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível atualizar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-zinc-900">{occurrence.description}</p>
        <p className="text-xs text-zinc-500">
          {shortDate(occurrence.date)} · {occurrence.category}
          {hint ? ` · ${hint}` : ""}
        </p>
        {error ? (
          <p role="alert" className="text-xs text-red-700">
            {error}
          </p>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style.className}`}>{style.label}</span>
        <span className={`text-sm font-semibold ${isIncome ? "text-teal-800" : "text-zinc-900"}`}>
          {isIncome ? "+ " : ""}
          {money(occurrence.amountCents)}
        </span>
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          className="min-h-9 rounded-md px-2.5 text-xs font-semibold text-teal-800 ring-1 ring-inset ring-teal-700/30 hover:bg-teal-50 disabled:opacity-50"
        >
          {occurrence.paid ? "Desfazer" : isIncome ? "Marcar como recebida" : "Marcar como paga"}
        </button>
      </div>
    </li>
  );
}
