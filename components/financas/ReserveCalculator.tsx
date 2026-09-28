"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { NumberField } from "@/components/forms/NumberField";
import { SelectField } from "@/components/forms/SelectField";
import { suggestedReserveCents, type ReserveMonths } from "@/lib/financas/goals";
import { reaisTextToCents } from "@/lib/financas/validation";
import { financeApi, notifyFinanceChanged } from "./api";
import { money } from "./format";

const OPTIONS: ReserveMonths[] = [3, 6, 9, 12];

/** Calculadora: despesas essenciais mensais × meses desejados = reserva sugerida. */
export function ReserveCalculator() {
  const [expenses, setExpenses] = useState("");
  const [months, setMonths] = useState<ReserveMonths>(6);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const expensesCents = reaisTextToCents(expenses);
  const suggested = expensesCents !== null ? suggestedReserveCents(expensesCents, months) : null;

  async function createGoal() {
    if (suggested === null) return;
    setCreating(true);
    setMessage(null);
    try {
      await financeApi.createGoal({ name: "Reserva de emergência", targetCents: suggested, currentCents: 0, targetDate: null });
      notifyFinanceChanged();
      setMessage("Meta criada em Metas financeiras.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Não foi possível criar a meta.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField
          id="reserve-expenses"
          label="Despesas essenciais por mês (R$)"
          hint="Moradia, alimentação, transporte, saúde — o mínimo para viver, sem contar supérfluos."
          placeholder="0,00"
          value={expenses}
          onChange={(e) => setExpenses(e.target.value)}
        />
        <SelectField id="reserve-months" label="Quantos meses de reserva" value={String(months)} onChange={(e) => setMonths(Number(e.target.value) as ReserveMonths)}>
          {OPTIONS.map((m) => (
            <option key={m} value={m}>
              {m} meses
            </option>
          ))}
        </SelectField>
      </div>

      {suggested !== null ? (
        <div className="rounded-lg border border-teal-200 bg-teal-50 p-4">
          <p className="text-sm text-teal-900">Reserva sugerida</p>
          <p className="text-2xl font-semibold text-teal-900">{money(suggested)}</p>
          <p className="mt-1 text-xs text-teal-800">
            {money(expensesCents ?? 0)}/mês × {months} meses
          </p>
          <div className="mt-3">
            <Button onClick={createGoal} disabled={creating}>
              {creating ? "Criando..." : "Criar essa meta"}
            </Button>
            {message ? (
              <span role="status" className="ml-3 text-sm text-teal-900">
                {message}
              </span>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="text-sm text-zinc-500">Informe suas despesas essenciais para ver a reserva sugerida.</p>
      )}

      <p className="text-xs text-zinc-500">
        É uma referência comum de planejamento financeiro, não uma regra fixa — ajuste conforme sua realidade (estabilidade de renda, dependentes,
        outras proteções que você já tenha).
      </p>
    </div>
  );
}
