"use client";

import { useEffect, useState } from "react";
import { EXPENSE_CATEGORIES } from "@/lib/financas/categories";
import { todayISO } from "@/lib/financas/dates";
import { categoryLimitProgress, type CategoryLimit } from "@/lib/financas/envelopes";
import { expensesByCategory } from "@/lib/financas/summary";
import { reaisTextToCents } from "@/lib/financas/validation";
import { FINANCE_CHANGED_EVENT, financeApi } from "./api";
import { money } from "./format";

const LIMIT_CHANGED_EVENT = "alilu:financas-limites-changed";

function progressBarColor(state: "ok" | "attention" | "over"): string {
  if (state === "over") return "bg-red-600";
  if (state === "attention") return "bg-amber-500";
  return "bg-teal-700";
}

function EditLimitForm({
  category,
  currentCents,
  onDone,
}: {
  category: string;
  currentCents: number | null;
  onDone: () => void;
}) {
  const [value, setValue] = useState(currentCents ? (currentCents / 100).toFixed(2).replace(".", ",") : "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    const cents = reaisTextToCents(value);
    if (cents === null || cents <= 0) {
      setError("Informe um limite maior que zero.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await financeApi.setCategoryLimit(category, cents);
      window.dispatchEvent(new Event(LIMIT_CHANGED_EVENT));
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <input
        inputMode="decimal"
        placeholder="0,00"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label={`Limite mensal para ${category}`}
        autoFocus
        className="w-28 rounded-md border border-zinc-300 px-2.5 py-2 text-sm focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/20"
      />
      <button
        type="button"
        disabled={saving}
        onClick={save}
        className="min-h-9 rounded-md bg-teal-700 px-2.5 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
      >
        {saving ? "Salvando..." : "Salvar"}
      </button>
      <button
        type="button"
        onClick={onDone}
        className="min-h-9 rounded-md px-2.5 text-xs font-semibold text-zinc-700 ring-1 ring-inset ring-zinc-300 hover:bg-zinc-50"
      >
        Cancelar
      </button>
      {error ? <span className="text-xs text-red-700">{error}</span> : null}
    </div>
  );
}

/**
 * "Método dos envelopes": um limite de gasto por categoria de despesa
 * (fin_category_limits, 1 por categoria por usuário), comparado contra o
 * gasto real do mês corrente — reaproveita `expensesByCategory`
 * (lib/financas/summary.ts), a mesma função já usada no painel mensal.
 */
export function EnvelopesManager() {
  const [limits, setLimits] = useState<CategoryLimit[] | null>(null);
  const [spentByCategory, setSpentByCategory] = useState<Map<string, number> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const month = todayISO().slice(0, 7);

  useEffect(() => {
    let cancelled = false;
    Promise.all([financeApi.listCategoryLimits(), financeApi.loadMonth(month)])
      .then(([limitList, monthData]) => {
        if (cancelled) return;
        setLimits(limitList);
        const totals = expensesByCategory(monthData.occurrences, 0);
        setSpentByCategory(new Map(totals.map((t) => [t.category, t.totalCents])));
        setError(null);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Não foi possível carregar.");
      });
    return () => {
      cancelled = true;
    };
  }, [month, tick]);

  useEffect(() => {
    const handler = () => setTick((v) => v + 1);
    window.addEventListener(FINANCE_CHANGED_EVENT, handler);
    window.addEventListener(LIMIT_CHANGED_EVENT, handler);
    return () => {
      window.removeEventListener(FINANCE_CHANGED_EVENT, handler);
      window.removeEventListener(LIMIT_CHANGED_EVENT, handler);
    };
  }, []);

  async function remove(category: string) {
    if (!window.confirm(`Remover o limite de "${category}"?`)) return;
    try {
      await financeApi.deleteCategoryLimit(category);
      setTick((v) => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível excluir.");
    }
  }

  const limitByCategory = new Map((limits ?? []).map((l) => [l.category, l.limitCents]));
  const loading = limits === null || spentByCategory === null;

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-600">
        Defina um teto mensal para as categorias que quiser controlar. A barra mostra quanto já foi gasto neste mês em cada uma.
      </p>

      {error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {loading && !error ? <p className="text-sm text-zinc-500">Carregando...</p> : null}

      {!loading ? (
        <ul className="space-y-3">
          {EXPENSE_CATEGORIES.map((category) => {
            const limitCents = limitByCategory.get(category) ?? null;
            const spentCents = spentByCategory?.get(category) ?? 0;
            const progress = limitCents !== null ? categoryLimitProgress({ category, limitCents }, spentCents) : null;

            return (
              <li key={category} className="rounded-lg border border-zinc-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-900">{category}</h3>
                    {progress ? (
                      <p className="text-xs text-zinc-500">
                        {money(progress.spentCents)} de {money(progress.limitCents)}
                      </p>
                    ) : (
                      <p className="text-xs text-zinc-500">Sem limite definido</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditing(category)}
                      className="min-h-9 rounded-md px-2.5 text-xs font-semibold text-zinc-700 ring-1 ring-inset ring-zinc-300 hover:bg-zinc-50"
                    >
                      {progress ? "Editar" : "Definir limite"}
                    </button>
                    {progress ? (
                      <button
                        type="button"
                        onClick={() => remove(category)}
                        className="min-h-9 rounded-md px-2.5 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-200 hover:bg-red-50"
                      >
                        Remover
                      </button>
                    ) : null}
                  </div>
                </div>

                {progress ? (
                  <>
                    <div className="mt-3 h-2.5 rounded-full bg-zinc-100" aria-hidden>
                      <div
                        className={`h-2.5 rounded-full ${progressBarColor(progress.state)}`}
                        style={{ width: `${Math.min(progress.percentUsed, 100)}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-zinc-600">
                      {progress.state === "over"
                        ? `Passou ${money(-progress.remainingCents)} do limite`
                        : `${progress.percentUsed.toLocaleString("pt-BR")}% usado · faltam ${money(progress.remainingCents)}`}
                    </p>
                  </>
                ) : null}

                {editing === category ? (
                  <EditLimitForm category={category} currentCents={limitCents} onDone={() => setEditing(null)} />
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
