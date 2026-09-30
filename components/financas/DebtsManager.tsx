"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { debtPayoff } from "@/lib/financas/debts";
import { todayISO } from "@/lib/financas/dates";
import type { Debt } from "@/lib/financas/debts";
import { reaisTextToCents } from "@/lib/financas/validation";
import { FINANCE_CHANGED_EVENT, financeApi, notifyFinanceChanged } from "./api";
import { DebtDialog } from "./DebtDialog";
import { money, monthLabel } from "./format";

function PaymentForm({ debt }: { debt: Debt }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** sign 1 = "Paguei" (reduz o saldo devedor); sign -1 = "Ajuste" (aumenta, ex.: juros). */
  async function apply(sign: 1 | -1) {
    const cents = reaisTextToCents(value);
    if (cents === null || cents <= 0) {
      setError("Informe um valor maior que zero.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await financeApi.payDebt(debt.id, cents * sign);
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
        aria-label={`Valor para ${debt.name}`}
        className="w-28 rounded-md border border-zinc-300 px-2.5 py-2 text-sm focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/20"
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => apply(1)}
        className="min-h-9 rounded-md px-2.5 text-xs font-semibold text-teal-800 ring-1 ring-inset ring-teal-700/30 hover:bg-teal-50 disabled:opacity-50"
      >
        − Paguei
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => apply(-1)}
        className="min-h-9 rounded-md px-2.5 text-xs font-semibold text-zinc-700 ring-1 ring-inset ring-zinc-300 hover:bg-zinc-50 disabled:opacity-50"
      >
        + Ajuste (juros)
      </button>
      {error ? <span className="text-xs text-red-700">{error}</span> : null}
    </div>
  );
}

/** "Controle de dívidas": saldo devedor, parcela e previsão de término. */
export function DebtsManager() {
  const [debts, setDebts] = useState<Debt[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ debt: Debt | null } | null>(null);
  const [tick, setTick] = useState(0);
  const today = todayISO();

  useEffect(() => {
    let cancelled = false;
    financeApi
      .listDebts()
      .then((list) => {
        if (cancelled) return;
        setDebts(list);
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

  async function remove(debt: Debt) {
    if (!window.confirm(`Excluir a dívida "${debt.name}"?`)) return;
    try {
      await financeApi.deleteDebt(debt.id);
      notifyFinanceChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível excluir.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-zinc-600">Financiamento, cartão de crédito, empréstimo — saldo devedor, parcela e previsão de término.</p>
        <Button onClick={() => setDialog({ debt: null })}>+ Dívida</Button>
      </div>

      {error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {debts === null && !error ? <p className="text-sm text-zinc-500">Carregando...</p> : null}
      {debts?.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-600">Nenhuma dívida cadastrada ainda.</p>
      ) : null}

      <ul className="space-y-3">
        {debts?.map((debt) => {
          const payoff = debtPayoff(debt, today);
          return (
            <li key={debt.id} className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900">{debt.name}</h3>
                  <p className="text-xs text-zinc-500">
                    Saldo devedor: {money(debt.balanceCents)} · Parcela: {money(debt.installmentCents)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDialog({ debt })}
                    className="min-h-9 rounded-md px-2.5 text-xs font-semibold text-zinc-700 ring-1 ring-inset ring-zinc-300 hover:bg-zinc-50"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(debt)}
                    className="min-h-9 rounded-md px-2.5 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-200 hover:bg-red-50"
                  >
                    Excluir
                  </button>
                </div>
              </div>

              <p className="mt-2 text-xs font-medium text-zinc-700">
                {payoff.paidOff
                  ? "Quitada! 🎉"
                  : `Faltam ${payoff.monthsRemaining} ${payoff.monthsRemaining === 1 ? "parcela" : "parcelas"} · previsão de término: ${monthLabel(payoff.payoffMonth!)}`}
              </p>

              {!payoff.paidOff ? <PaymentForm debt={debt} /> : null}
            </li>
          );
        })}
      </ul>

      {dialog ? <DebtDialog key={dialog.debt?.id ?? "new"} open debt={dialog.debt} onClose={() => setDialog(null)} /> : null}
    </div>
  );
}
