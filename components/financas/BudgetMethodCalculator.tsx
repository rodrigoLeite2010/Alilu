"use client";

import { useState } from "react";
import { NumberField } from "@/components/forms/NumberField";
import { actualSplit, split503020 } from "@/lib/financas/budget-method";
import { reaisTextToCents } from "@/lib/financas/validation";
import { todayISO } from "@/lib/financas/dates";
import { money } from "./format";
import { useMonthData } from "./useMonthData";

function Row({ label, recommended, actual }: { label: string; recommended: number; actual?: number }) {
  const over = actual !== undefined && actual > recommended;
  return (
    <div className="flex items-center justify-between gap-3 border-b border-zinc-100 py-2 text-sm">
      <span className="text-zinc-700">{label}</span>
      <span className="text-right">
        <span className="font-medium text-zinc-900">{money(recommended)}</span>
        {actual !== undefined ? (
          <span className={`ml-2 ${over ? "text-red-700" : "text-teal-800"}`}>
            (gasto: {money(actual)})
          </span>
        ) : null}
      </span>
    </div>
  );
}

/** Calculadora 50/30/20, comparando com os gastos reais do mês corrente, quando disponíveis. */
export function BudgetMethodCalculator() {
  const month = todayISO().slice(0, 7);
  const { data } = useMonthData(month);
  const [incomeText, setIncomeText] = useState("");

  const typed = reaisTextToCents(incomeText);
  const registeredIncome = data ? data.occurrences.filter((o) => o.kind === "income").reduce((s, o) => s + o.amountCents, 0) : null;
  const income = typed ?? registeredIncome ?? 0;
  const split = split503020(income);
  const actual = data ? actualSplit(data.occurrences, income) : null;

  return (
    <div className="space-y-5">
      <NumberField
        id="budget-income"
        label="Sua renda mensal (R$)"
        placeholder={registeredIncome ? (registeredIncome / 100).toFixed(2).replace(".", ",") : "0,00"}
        hint={registeredIncome !== null ? `Deixe em branco para usar sua renda já cadastrada este mês: ${money(registeredIncome)}.` : undefined}
        value={incomeText}
        onChange={(e) => setIncomeText(e.target.value)}
      />

      {income > 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-sm text-zinc-600">Para uma renda de {money(income)}</p>
          <div className="mt-2">
            <Row label="Necessidades (50%)" recommended={split.needsCents} actual={actual?.needsCents} />
            <Row label="Desejos (30%)" recommended={split.wantsCents} actual={actual?.wantsCents} />
            <Row label="Economia/metas (20%)" recommended={split.savingsCents} actual={actual?.savingsCents} />
          </div>
          {actual ? (
            <p className="mt-3 text-xs text-zinc-500">
              Comparação com as despesas deste mês: despesas marcadas como “fixa” contam como necessidade, “variável” como desejo. É só uma
              aproximação — ajuste como fizer sentido para você.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-zinc-500">Informe sua renda (ou cadastre-a em Receitas) para ver a divisão.</p>
      )}

      <p className="text-xs text-zinc-500">
        O 50/30/20 é uma referência de orçamento, não uma regra obrigatória — use como ponto de partida e ajuste à sua realidade.
      </p>
    </div>
  );
}
