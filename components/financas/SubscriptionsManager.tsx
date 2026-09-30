"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { RECURRENCE_LABELS } from "@/lib/financas/categories";
import { todayISO } from "@/lib/financas/dates";
import { SUBSCRIPTION_CATEGORY, summarizeSubscriptions } from "@/lib/financas/subscriptions";
import type { FinEntry } from "@/lib/financas/types";
import { FINANCE_CHANGED_EVENT, financeApi, notifyFinanceChanged } from "./api";
import { EntryDialog } from "./EntryDialog";
import { money, shortDate } from "./format";

/**
 * "Assinaturas mensais": sem tabela nova. Lê as despesas (kind "expense")
 * já existentes e filtra as recorrentes da categoria "Assinaturas" — ver
 * lib/financas/subscriptions.ts. Cadastrar/editar reaproveita o EntryDialog
 * já usado por Despesas, só com categoria e periodicidade pré-selecionadas.
 */
export function SubscriptionsManager() {
  const [entries, setEntries] = useState<FinEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ entry: FinEntry | null } | null>(null);
  const [tick, setTick] = useState(0);
  const today = todayISO();

  useEffect(() => {
    let cancelled = false;
    financeApi
      .listEntries("expense")
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
  }, [tick]);

  useEffect(() => {
    const handler = () => setTick((value) => value + 1);
    window.addEventListener(FINANCE_CHANGED_EVENT, handler);
    return () => window.removeEventListener(FINANCE_CHANGED_EVENT, handler);
  }, []);

  async function remove(entry: FinEntry) {
    if (!window.confirm(`Excluir a assinatura "${entry.description}"?`)) return;
    try {
      await financeApi.deleteEntry(entry.id);
      notifyFinanceChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível excluir.");
    }
  }

  const summary = entries ? summarizeSubscriptions(entries, today) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-zinc-600">
          Despesas recorrentes cadastradas na categoria &ldquo;Assinaturas&rdquo; (streaming, academia, software...). Quanto você paga por mês e por
          ano.
        </p>
        <Button onClick={() => setDialog({ entry: null })}>+ Assinatura</Button>
      </div>

      {error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {entries === null && !error ? <p className="text-sm text-zinc-500">Carregando...</p> : null}

      {summary && summary.subscriptions.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <p className="text-xs text-zinc-500">Total por mês</p>
            <p className="text-xl font-semibold text-zinc-900">{money(summary.monthlyTotalCents)}</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <p className="text-xs text-zinc-500">Total por ano</p>
            <p className="text-xl font-semibold text-zinc-900">{money(summary.yearlyTotalCents)}</p>
          </div>
        </div>
      ) : null}

      {summary?.subscriptions.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-600">
          Nenhuma assinatura cadastrada ainda. Cadastre como despesa recorrente na categoria &ldquo;Assinaturas&rdquo;.
        </p>
      ) : null}

      <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white px-4">
        {summary?.subscriptions.map(({ entry, monthlyCents, yearlyCents }) => (
          <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-zinc-900">{entry.description}</p>
              <p className="text-xs text-zinc-500">
                {RECURRENCE_LABELS[entry.recurrence]} · {money(entry.amountCents)}
                {entry.recurrenceEnd ? ` até ${shortDate(entry.recurrenceEnd)}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-semibold text-zinc-900">{money(monthlyCents)}/mês</p>
                <p className="text-xs text-zinc-500">{money(yearlyCents)}/ano</p>
              </div>
              <button
                type="button"
                onClick={() => setDialog({ entry })}
                className="min-h-9 rounded-md px-2.5 text-xs font-semibold text-zinc-700 ring-1 ring-inset ring-zinc-300 hover:bg-zinc-50"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => remove(entry)}
                className="min-h-9 rounded-md px-2.5 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-200 hover:bg-red-50"
              >
                Excluir
              </button>
            </div>
          </li>
        ))}
      </ul>

      {dialog ? (
        <EntryDialog
          key={dialog.entry?.id ?? "new"}
          open
          mode="full"
          kind="expense"
          entry={dialog.entry}
          defaultCategory={SUBSCRIPTION_CATEGORY}
          defaultRecurrence="monthly"
          onClose={() => setDialog(null)}
        />
      ) : null}
    </div>
  );
}
