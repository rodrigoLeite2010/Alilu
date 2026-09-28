"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { addMonthsToMonth, monthRange } from "@/lib/financas/dates";
import { reaisTextToCents } from "@/lib/financas/validation";
import {
  bucketUpcoming,
  computeCanSpend,
  expensesByCategory,
  projectCashFlow,
  summarizeMonth,
  type UpcomingBuckets,
} from "@/lib/financas/summary";
import { todayISO } from "@/lib/financas/dates";
import type { BudgetState } from "@/lib/financas/types";
import { financeApi, notifyFinanceChanged, type MonthData } from "./api";
import { CashFlowChart } from "./CashFlowChart";
import { money, monthLabel } from "./format";
import { OccurrenceRow } from "./OccurrenceRow";
import { useMonthData } from "./useMonthData";

const STATE_INFO: Record<BudgetState, { icon: string; title: string; text: string; className: string }> = {
  ok: {
    icon: "🟢",
    title: "Dentro do orçamento",
    text: "Pelo que você cadastrou, o mês fecha no positivo e a meta de economia está garantida.",
    className: "border-teal-200 bg-teal-50 text-teal-900",
  },
  attention: {
    icon: "🟡",
    title: "Atenção aos próximos gastos",
    text: "O mês ainda fecha no positivo, mas há conta vencida ou a meta de economia pode não ser atingida.",
    className: "border-amber-200 bg-amber-50 text-amber-900",
  },
  over: {
    icon: "🔴",
    title: "Gastos maiores que a renda",
    text: "As contas previstas superam o que entra neste mês. Veja abaixo o que ainda vence e o que dá para ajustar.",
    className: "border-red-200 bg-red-50 text-red-900",
  },
};

function StatCard({ label, value, tone }: { label: string; value: string; tone?: "negative" }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${tone === "negative" ? "text-red-700" : "text-zinc-900"}`}>{value}</p>
    </div>
  );
}

function BucketList({ title, items, today, hint }: { title: string; items: UpcomingBuckets["today"]; today: string; hint?: (date: string) => string }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</h3>
      <ul className="divide-y divide-zinc-100">
        {items.map((occ) => (
          <OccurrenceRow key={`${occ.entryId}-${occ.date}`} occurrence={occ} today={today} hint={hint?.(occ.date)} />
        ))}
      </ul>
    </div>
  );
}

function daysUntilLabel(today: string, date: string): string {
  const diff = Math.round((Date.parse(date) - Date.parse(today)) / 86_400_000);
  if (diff < 0) return `venceu há ${-diff} dia${diff === -1 ? "" : "s"}`;
  if (diff === 0) return "vence hoje";
  if (diff === 1) return "vence amanhã";
  return `vence em ${diff} dias`;
}

function Settings({ data }: { data: MonthData }) {
  const [goal, setGoal] = useState((data.savingsGoalCents / 100).toFixed(2).replace(".", ","));
  const [opening, setOpening] = useState((data.openingBalanceCents / 100).toFixed(2).replace(".", ","));
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const goalCents = reaisTextToCents(goal);
    const openingCents = reaisTextToCents(opening);
    if (goalCents === null || goalCents < 0 || openingCents === null) {
      setMessage("Confira os valores informados.");
      return;
    }
    try {
      await financeApi.saveSettings({ savingsGoalCents: goalCents });
      await financeApi.saveSettings({ month: data.month, openingBalanceCents: openingCents });
      notifyFinanceChanged();
      setMessage("Salvo.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Não foi possível salvar.");
    }
  }

  const inputClass = "mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-base focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/20";
  return (
    <details className="rounded-lg border border-zinc-200 bg-white p-4">
      <summary className="cursor-pointer text-sm font-semibold text-zinc-800">Ajustar meta de economia e saldo inicial</summary>
      <form onSubmit={submit} className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-zinc-700">
          Meta de economia por mês (R$)
          <input inputMode="decimal" className={inputClass} value={goal} onChange={(e) => setGoal(e.target.value)} />
        </label>
        <label className="text-sm text-zinc-700">
          Saldo que você tinha no início de {monthLabel(data.month)} (R$)
          <input inputMode="decimal" className={inputClass} value={opening} onChange={(e) => setOpening(e.target.value)} />
        </label>
        <div className="flex items-center gap-3 sm:col-span-2">
          <Button type="submit">Salvar</Button>
          {message ? <span role="status" className="text-sm text-zinc-600">{message}</span> : null}
        </div>
      </form>
    </details>
  );
}

export function Dashboard() {
  const currentMonth = todayISO().slice(0, 7);
  const [month, setMonth] = useState(currentMonth);
  const { data, error, loading } = useMonthData(month);

  const nav = (
    <div className="flex items-center justify-between gap-2">
      <Button variant="secondary" onClick={() => setMonth(addMonthsToMonth(month, -1))} aria-label="Mês anterior">
        ←
      </Button>
      <h2 className="text-center text-lg font-semibold capitalize text-zinc-900">{monthLabel(month)}</h2>
      <Button variant="secondary" onClick={() => setMonth(addMonthsToMonth(month, 1))} aria-label="Próximo mês">
        →
      </Button>
    </div>
  );

  if (error) {
    return (
      <div className="space-y-4">
        {nav}
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="space-y-4">
        {nav}
        <p className="text-sm text-zinc-500">{loading ? "Carregando..." : ""}</p>
      </div>
    );
  }

  const { today, occurrences } = data;
  const summary = summarizeMonth(occurrences, {
    today,
    openingBalanceCents: data.openingBalanceCents,
    savingsGoalCents: data.savingsGoalCents,
  });
  const canSpend = computeCanSpend(summary, month, today);
  const buckets = bucketUpcoming(occurrences, today);
  const categories = expensesByCategory(occurrences, summary.incomeTotalCents);
  const isEmpty = occurrences.length === 0;
  const state = STATE_INFO[summary.state];

  const inMonth = today >= monthRange(month).from && today <= monthRange(month).to;
  const flowStart = inMonth ? today : monthRange(month).from;
  const flowDays = inMonth ? canSpend.daysLeft : 0;
  const flow = projectCashFlow({
    startingBalanceCents: summary.balanceNowCents,
    occurrences,
    today: flowStart,
    days: flowDays,
  });
  const upcomingTotal = summary.expenseUpcomingCents + summary.expenseOverdueCents;

  return (
    <div className="space-y-6">
      {nav}

      {isEmpty ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-6 text-center">
          <p className="text-base font-semibold text-zinc-900">Comece cadastrando quanto você recebe e suas contas</p>
          <p className="mt-1 text-sm text-zinc-600">
            Cadastre sua renda em <a className="font-medium text-teal-800 underline" href="/financeiro/receitas">Receitas</a> e suas contas
            fixas em <a className="font-medium text-teal-800 underline" href="/financeiro/despesas">Despesas</a> (marque como &quot;Mensal&quot; para
            elas se repetirem sozinhas). O painel se monta em seguida.
          </p>
        </div>
      ) : null}

      <section aria-label="Sua situação neste mês" className={`rounded-lg border p-4 ${state.className}`}>
        <p className="text-xs font-semibold uppercase tracking-wide opacity-70">Sua situação neste mês</p>
        <p className="mt-1 text-lg font-semibold">
          <span aria-hidden>{state.icon}</span> {state.title}
        </p>
        <p className="mt-1 text-sm opacity-90">{state.text}</p>
      </section>

      <section aria-label="Resumo do mês" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Renda do mês" value={money(summary.incomeTotalCents)} />
        <StatCard label="Despesas pagas" value={money(summary.expensePaidCents)} />
        <StatCard label="Contas a vencer" value={money(upcomingTotal)} />
        <StatCard label="Saldo disponível" value={money(summary.balanceNowCents)} tone={summary.balanceNowCents < 0 ? "negative" : undefined} />
        <StatCard
          label="Previsão no fim do mês"
          value={money(summary.projectedEndCents)}
          tone={summary.projectedEndCents < 0 ? "negative" : undefined}
        />
      </section>

      <section aria-label="Meu mês em uma tela" className="rounded-lg border border-zinc-200 bg-white p-4 sm:p-5">
        <h2 className="text-base font-semibold text-zinc-900">Meu mês em uma tela</h2>
        <dl className="mt-3 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          {[
            ["Recebi", money(summary.incomeReceivedCents)],
            ["Gastei", money(summary.expensePaidCents)],
            ["Ainda tenho contas", money(upcomingTotal)],
            ["Meta de economia", money(summary.savingsGoalCents)],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 border-b border-zinc-100 py-1.5">
              <dt className="text-zinc-600">{label}</dt>
              <dd className="font-medium text-zinc-900">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 rounded-md bg-zinc-50 p-4">
          <p className="text-sm text-zinc-600">Quanto posso gastar até o fim do mês?</p>
          <p className={`text-2xl font-semibold ${canSpend.freeCents < 0 ? "text-red-700" : "text-zinc-900"}`}>
            {canSpend.freeCents < 0 ? `−${money(-canSpend.freeCents)}` : money(canSpend.freeCents)}
          </p>
          {canSpend.daysLeft > 0 ? (
            <p className="mt-1 text-sm text-zinc-700">
              {canSpend.daysLeft} {canSpend.daysLeft === 1 ? "dia restante" : "dias restantes"} → aproximadamente{" "}
              <strong>{money(canSpend.perDayCents)}/dia</strong>
            </p>
          ) : null}
          <p className="mt-2 text-xs text-zinc-500">
            É só uma referência matemática: saldo atual + o que ainda vai entrar − contas futuras − meta de economia. Não considera gastos que você
            ainda não cadastrou.
          </p>
        </div>
      </section>

      <section aria-label="Próximas contas" className="rounded-lg border border-zinc-200 bg-white p-4 sm:p-5">
        <h2 className="text-base font-semibold text-zinc-900">Próximas contas</h2>
        {upcomingTotal === 0 ? (
          <p className="mt-2 text-sm text-zinc-600">Nenhuma conta pendente neste mês.</p>
        ) : (
          <>
            <BucketList title="Vencidas" items={buckets.overdue} today={today} hint={(d) => daysUntilLabel(today, d)} />
            <BucketList title="Hoje" items={buckets.today} today={today} />
            <BucketList title="Amanhã" items={buckets.tomorrow} today={today} />
            <BucketList title="Próximos 7 dias" items={buckets.next7} today={today} hint={(d) => daysUntilLabel(today, d)} />
            <BucketList title="Mais adiante neste mês" items={buckets.rest} today={today} hint={(d) => daysUntilLabel(today, d)} />
          </>
        )}
      </section>

      <section aria-label="Fluxo de caixa" className="rounded-lg border border-zinc-200 bg-white p-4 sm:p-5">
        <h2 className="text-base font-semibold text-zinc-900">Saldo previsto até o fim do mês</h2>
        <p className="mb-2 text-sm text-zinc-600">
          Parte do seu saldo de hoje ({money(summary.balanceNowCents)}), soma o que ainda vai entrar ({money(summary.incomePendingCents)}) e desconta
          as contas futuras ({money(upcomingTotal)}).
        </p>
        <CashFlowChart points={flow} />
      </section>

      {categories.length > 0 ? (
        <section aria-label="Gastos por categoria" className="rounded-lg border border-zinc-200 bg-white p-4 sm:p-5">
          <h2 className="text-base font-semibold text-zinc-900">Para onde está indo meu dinheiro</h2>
          <ul className="mt-3 space-y-3">
            {categories.map((c) => {
              const width = summary.expenseTotalCents > 0 ? (c.totalCents / summary.expenseTotalCents) * 100 : 0;
              return (
                <li key={c.category}>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-zinc-800">{c.category}</span>
                    <span className="text-zinc-600">
                      {money(c.totalCents)}
                      {summary.incomeTotalCents > 0 ? ` · ${c.percentOfIncome.toLocaleString("pt-BR")}% da renda` : ""}
                    </span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-zinc-100" aria-hidden>
                    <div className="h-2 rounded-full bg-teal-700" style={{ width: `${Math.min(width, 100)}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <Settings key={`${data.month}-${data.savingsGoalCents}-${data.openingBalanceCents}`} data={data} />
    </div>
  );
}
