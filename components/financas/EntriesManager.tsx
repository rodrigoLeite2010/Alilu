"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { RECURRENCE_LABELS } from "@/lib/financas/categories";
import type { EntryKind, FinEntry } from "@/lib/financas/types";
import { FINANCE_CHANGED_EVENT, financeApi, notifyFinanceChanged } from "./api";
import { EntryDialog } from "./EntryDialog";
import { money, shortDate } from "./format";

/** Lista, cria, edita e exclui receitas ou despesas (recorrentes inclusive). */
export function EntriesManager({ kind }: { kind: EntryKind }) {
  const [entries, setEntries] = useState<FinEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ entry: FinEntry | null } | null>(null);
  const isIncome = kind === "income";

  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    financeApi
      .listEntries(kind)
      .then((list) => {
        if (cancelled) return;
        setEntries(list);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Não foi possível carregar.");
      });
    return () => {
      cancelled = true;
    };
  }, [kind, tick]);

  useEffect(() => {
    const handler = () => setTick((value) => value + 1);
    window.addEventListener(FINANCE_CHANGED_EVENT, handler);
    return () => window.removeEventListener(FINANCE_CHANGED_EVENT, handler);
  }, []);

  async function remove(entry: FinEntry) {
    const extra = entry.recurrence !== "none" ? " Isso remove todas as repetições." : "";
    if (!window.confirm(`Excluir "${entry.description}"?${extra}`)) return;
    try {
      await financeApi.deleteEntry(entry.id);
      notifyFinanceChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível excluir.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-zinc-600">
          {isIncome
            ? "Salário, renda extra e tudo que entra. Marque como “Mensal” o que se repete."
            : "Suas contas e gastos. Marque como “Mensal” o que se repete, como aluguel, escola e condomínio."}
        </p>
        <Button onClick={() => setDialog({ entry: null })}>{isIncome ? "+ Receita" : "+ Despesa"}</Button>
      </div>

      {error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {entries === null && !error ? <p className="text-sm text-zinc-500">Carregando...</p> : null}
      {entries?.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-600">
          Nenhuma {isIncome ? "receita" : "despesa"} cadastrada ainda.
        </p>
      ) : null}

      <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white px-4">
        {entries?.map((entry) => (
          <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-zinc-900">{entry.description}</p>
              <p className="text-xs text-zinc-500">
                {shortDate(entry.date)} · {entry.category}
                {entry.nature ? ` · ${entry.nature === "fixed" ? "Fixa" : "Variável"}` : ""} · {RECURRENCE_LABELS[entry.recurrence]}
                {entry.recurrenceEnd ? ` até ${shortDate(entry.recurrenceEnd)}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-semibold ${isIncome ? "text-teal-800" : "text-zinc-900"}`}>{money(entry.amountCents)}</span>
              <button type="button" onClick={() => setDialog({ entry })} className="min-h-9 rounded-md px-2.5 text-xs font-semibold text-zinc-700 ring-1 ring-inset ring-zinc-300 hover:bg-zinc-50">
                Editar
              </button>
              <button type="button" onClick={() => remove(entry)} className="min-h-9 rounded-md px-2.5 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-200 hover:bg-red-50">
                Excluir
              </button>
            </div>
          </li>
        ))}
      </ul>

      {dialog ? (
        <EntryDialog key={dialog.entry?.id ?? "new"} open mode="full" kind={kind} entry={dialog.entry} onClose={() => setDialog(null)} />
      ) : null}
    </div>
  );
}
