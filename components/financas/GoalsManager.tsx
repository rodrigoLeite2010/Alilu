"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { goalProgress, type Goal } from "@/lib/financas/goals";
import { todayISO } from "@/lib/financas/dates";
import { reaisTextToCents } from "@/lib/financas/validation";
import { FINANCE_CHANGED_EVENT, financeApi, notifyFinanceChanged } from "./api";
import { GoalDialog } from "./GoalDialog";
import { money, shortDate } from "./format";

function DepositForm({ goal }: { goal: Goal }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function apply(sign: 1 | -1) {
    const cents = reaisTextToCents(value);
    if (cents === null || cents <= 0) {
      setError("Informe um valor maior que zero.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await financeApi.depositToGoal(goal.id, cents * sign);
      setValue("");
      notifyFinanceChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <input
        inputMode="decimal"
        placeholder="0,00"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-28 rounded-md border border-zinc-300 px-2.5 py-2 text-sm focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/20"
        aria-label={`Valor para ${goal.name}`}
      />
      <button type="button" disabled={busy} onClick={() => apply(1)} className="min-h-9 rounded-md px-2.5 text-xs font-semibold text-teal-800 ring-1 ring-inset ring-teal-700/30 hover:bg-teal-50 disabled:opacity-50">
        + Guardei
      </button>
      <button type="button" disabled={busy} onClick={() => apply(-1)} className="min-h-9 rounded-md px-2.5 text-xs font-semibold text-zinc-700 ring-1 ring-inset ring-zinc-300 hover:bg-zinc-50 disabled:opacity-50">
        − Usei
      </button>
      {error ? <span className="text-xs text-red-700">{error}</span> : null}
    </div>
  );
}

export function GoalsManager() {
  const [goals, setGoals] = useState<Goal[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ goal: Goal | null } | null>(null);
  const [tick, setTick] = useState(0);
  const today = todayISO();

  useEffect(() => {
    let cancelled = false;
    financeApi
      .listGoals()
      .then((list) => {
        if (cancelled) return;
        setGoals(list);
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
    const handler = () => setTick((v) => v + 1);
    window.addEventListener(FINANCE_CHANGED_EVENT, handler);
    return () => window.removeEventListener(FINANCE_CHANGED_EVENT, handler);
  }, []);

  async function remove(goal: Goal) {
    if (!window.confirm(`Excluir a meta "${goal.name}"?`)) return;
    try {
      await financeApi.deleteGoal(goal.id);
      notifyFinanceChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível excluir.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-zinc-600">Reserva de emergência, viagem, entrada do carro — o que você quiser guardar dinheiro para conseguir.</p>
        <Button onClick={() => setDialog({ goal: null })}>+ Meta</Button>
      </div>

      {error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {goals === null && !error ? <p className="text-sm text-zinc-500">Carregando...</p> : null}
      {goals?.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-600">
          Nenhuma meta ainda. Que tal começar pela{" "}
          <a href="/financeiro/reserva-de-emergencia" className="font-medium text-teal-800 underline">
            reserva de emergência
          </a>
          ?
        </p>
      ) : null}

      <ul className="space-y-3">
        {goals?.map((goal) => {
          const progress = goalProgress(goal, today);
          return (
            <li key={goal.id} className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900">{goal.name}</h3>
                  <p className="text-xs text-zinc-500">
                    {money(goal.currentCents)} de {money(goal.targetCents)}
                    {goal.targetDate ? ` · até ${shortDate(goal.targetDate)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setDialog({ goal })} className="min-h-9 rounded-md px-2.5 text-xs font-semibold text-zinc-700 ring-1 ring-inset ring-zinc-300 hover:bg-zinc-50">
                    Editar
                  </button>
                  <button type="button" onClick={() => remove(goal)} className="min-h-9 rounded-md px-2.5 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-200 hover:bg-red-50">
                    Excluir
                  </button>
                </div>
              </div>

              <div className="mt-3 h-2.5 rounded-full bg-zinc-100" aria-hidden>
                <div className={`h-2.5 rounded-full ${progress.reached ? "bg-teal-700" : "bg-teal-600"}`} style={{ width: `${Math.min(progress.percentComplete, 100)}%` }} />
              </div>
              <p className="mt-1.5 text-xs text-zinc-600">
                {progress.reached ? "Meta atingida! 🎉" : `${progress.percentComplete.toLocaleString("pt-BR")}% concluído · faltam ${money(progress.missingCents)}`}
                {!progress.reached && progress.monthlyNeededCents !== null ? ` · guarde ${money(progress.monthlyNeededCents)}/mês` : ""}
              </p>

              {!progress.reached ? <DepositForm goal={goal} /> : null}
            </li>
          );
        })}
      </ul>

      {dialog ? <GoalDialog key={dialog.goal?.id ?? "new"} open goal={dialog.goal} onClose={() => setDialog(null)} /> : null}
    </div>
  );
}
