"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { formatCents } from "@/lib/allowance/money";
import type { ChildDashboard } from "@/lib/allowance/backend/allowance-service";
import type { TransactionDto } from "@/lib/allowance/types";
import { Avatar } from "./MesadaHome";
import { call, formatDateBr, formatDayMonth } from "./api";
import { QuickForm, type QuickField } from "./QuickForm";

type Dialog = null | "expense" | "income" | "deposit" | "withdraw" | "goal" | "task" | "plan" | "settings";
type Tab = "resumo" | "historico" | "metas" | "tarefas";
const TABS: Array<{ id: Tab; label: string }> = [
  { id: "resumo", label: "Resumo" },
  { id: "historico", label: "Histórico" },
  { id: "metas", label: "Metas" },
  { id: "tarefas", label: "Tarefas" },
];

const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const KIND_FILTERS = [
  { value: "", label: "Tudo" },
  { value: "income", label: "Entradas" },
  { value: "expense", label: "Saídas" },
  { value: "savings", label: "Cofrinho" },
  { value: "reward", label: "Recompensas" },
  { value: "allowance", label: "Mesada" },
];

function ActionButton({ label, onClick, emoji, tone = "bg-white" }: { label: string; onClick: () => void; emoji: string; tone?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border border-zinc-200 px-2 py-3 text-sm font-semibold text-zinc-800 shadow-sm hover:border-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700 ${tone}`}
    >
      <span aria-hidden className="text-xl">
        {emoji}
      </span>
      {label}
    </button>
  );
}

function sign(t: TransactionDto): { text: string; className: string } {
  if (t.type === "INCOME" || t.type === "SAVINGS_WITHDRAWAL") return { text: `+ ${formatCents(t.amountCents)}`, className: "text-emerald-700" };
  return { text: `- ${formatCents(t.amountCents)}`, className: t.type === "SAVINGS_TRANSFER" ? "text-amber-700" : "text-red-700" };
}

function TransactionRow({ t }: { t: TransactionDto }) {
  const s = sign(t);
  const label = t.description || t.categoryName || (t.type === "SAVINGS_TRANSFER" ? "Guardou no cofrinho" : "Movimentação");
  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-zinc-900">
          <span aria-hidden>{t.type === "SAVINGS_TRANSFER" || t.type === "SAVINGS_WITHDRAWAL" ? "🐷" : (t.categoryIcon ?? "•")} </span>
          {label}
        </p>
        <p className="text-xs text-zinc-500">
          {formatDateBr(t.date)}
          {t.categoryName ? ` · ${t.categoryName}` : ""}
          {t.goalName ? ` · Meta: ${t.goalName}` : ""}
        </p>
      </div>
      <span className={`shrink-0 text-sm font-semibold ${s.className}`}>{s.text}</span>
    </li>
  );
}

export function ChildPanel({ dashboard }: { dashboard: ChildDashboard }) {
  const router = useRouter();
  const d = dashboard;
  const id = d.child.id;
  const [tab, setTab] = useState<Tab>("resumo");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [kind, setKind] = useState("");
  const [history, setHistory] = useState<TransactionDto[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const base = `/api/allowance/children/${id}`;
  const refresh = useCallback(() => router.refresh(), [router]);

  useEffect(() => {
    if (tab !== "historico") return;
    let cancelled = false;
    void call<TransactionDto[]>("GET", `${base}/transactions?limit=100${kind ? `&kind=${kind}` : ""}`).then((r) => {
      if (!cancelled) setHistory(r.data ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [tab, kind, base, d.balanceCents, d.savingsCents]);

  const submit = (method: string, url: string, transform?: (v: Record<string, string | boolean>) => unknown) => async (values: Record<string, string | boolean>) => {
    const result = await call(method, url, transform ? transform(values) : values);
    if (result.error) return result.error;
    refresh();
    return null;
  };

  const categoryOptions = (list: Array<{ id: string; name: string; icon: string }>) => [
    { value: "", label: "Sem categoria" },
    ...list.map((c) => ({ value: c.id, label: `${c.icon} ${c.name}` })),
  ];
  const goalOptions = [{ value: "", label: "Sem meta" }, ...d.goals.filter((g) => g.status === "ACTIVE").map((g) => ({ value: g.id, label: `${g.icon} ${g.name}` }))];

  const forms: Record<Exclude<Dialog, null>, { title: string; submitLabel: string; fields: QuickField[]; intro?: string; onSubmit: (v: Record<string, string | boolean>) => Promise<string | null> }> = {
    expense: {
      title: "Registrar gasto",
      submitLabel: "Registrar gasto",
      intro: `Saldo disponível: ${formatCents(d.balanceCents)}`,
      fields: [
        { name: "amount", label: "Valor (R$)", type: "money", required: true },
        { name: "description", label: "Descrição", type: "text", maxLength: 120, placeholder: "Ex.: Brinquedo" },
        { name: "categoryId", label: "Categoria", type: "select", options: categoryOptions(d.expenseCategories) },
        { name: "date", label: "Data", type: "date", defaultValue: today() },
      ],
      onSubmit: submit("POST", `${base}/expenses`),
    },
    income: {
      title: "Adicionar entrada",
      submitLabel: "Adicionar entrada",
      fields: [
        { name: "amount", label: "Valor (R$)", type: "money", required: true },
        { name: "description", label: "Descrição", type: "text", maxLength: 120, placeholder: "Ex.: Presente da vovó" },
        { name: "categoryId", label: "Categoria", type: "select", options: categoryOptions(d.incomeCategories) },
        { name: "date", label: "Data", type: "date", defaultValue: today() },
      ],
      onSubmit: submit("POST", `${base}/income`),
    },
    deposit: {
      title: "Guardar dinheiro",
      submitLabel: "Guardar",
      intro: `Disponível para guardar: ${formatCents(d.balanceCents)}`,
      fields: [
        { name: "amount", label: "Valor (R$)", type: "money", required: true },
        { name: "goalId", label: "Para qual meta? (opcional)", type: "select", options: goalOptions },
        { name: "description", label: "Descrição (opcional)", type: "text", maxLength: 120 },
        { name: "date", label: "Data", type: "date", defaultValue: today() },
      ],
      onSubmit: submit("POST", `${base}/savings/deposit`),
    },
    withdraw: {
      title: "Retirar do cofrinho",
      submitLabel: "Retirar",
      intro: `No cofrinho: ${formatCents(d.savingsCents)}`,
      fields: [
        { name: "amount", label: "Valor (R$)", type: "money", required: true },
        { name: "goalId", label: "De qual meta? (opcional)", type: "select", options: goalOptions },
        { name: "description", label: "Motivo (opcional)", type: "text", maxLength: 120 },
        { name: "date", label: "Data", type: "date", defaultValue: today() },
      ],
      onSubmit: submit("POST", `${base}/savings/withdraw`),
    },
    goal: {
      title: "Criar meta de economia",
      submitLabel: "Criar meta",
      fields: [
        { name: "name", label: "Nome da meta", type: "text", required: true, maxLength: 60, placeholder: "Ex.: Comprar bicicleta" },
        { name: "targetAmount", label: "Quanto custa? (R$)", type: "money", required: true },
        { name: "targetDate", label: "Data alvo (opcional)", type: "date" },
        { name: "icon", label: "Ícone", type: "select", defaultValue: "🎯", options: ["🎯", "🚲", "🎮", "🧸", "📱", "🎧", "👟", "✈️"].map((e) => ({ value: e, label: e })) },
      ],
      onSubmit: submit("POST", `${base}/goals`),
    },
    task: {
      title: "Criar tarefa",
      submitLabel: "Criar tarefa",
      fields: [
        { name: "name", label: "Tarefa", type: "text", required: true, maxLength: 80, placeholder: "Ex.: Arrumar o quarto" },
        { name: "hasReward", label: "Com recompensa em dinheiro", type: "checkbox", hint: "Desmarcado = tarefa educativa, sem dinheiro." },
        { name: "rewardAmount", label: "Valor da recompensa (R$)", type: "money", hint: "Só vale se “com recompensa” estiver marcado." },
        { name: "repeatable", label: "Pode se repetir", type: "checkbox", defaultValue: true, hint: "Desmarque para uma recompensa única." },
      ],
      onSubmit: submit("POST", `${base}/tasks`),
    },
    plan: {
      title: "Mesada mensal",
      submitLabel: "Salvar mesada",
      fields: [
        { name: "monthlyAmount", label: "Valor por mês (R$)", type: "money", required: true, defaultValue: d.plan ? String(d.plan.monthlyAmountCents / 100).replace(".", ",") : undefined },
        { name: "paymentDay", label: "Dia do pagamento (1 a 31)", type: "number", required: true, defaultValue: String(d.plan?.paymentDay ?? 5) },
        { name: "carryOverBalance", label: "Acumular o saldo do mês anterior", type: "checkbox", defaultValue: d.plan?.carryOverBalance ?? true, hint: "Desmarcado: o saldo restante é zerado (com registro no histórico) antes da nova mesada." },
      ],
      onSubmit: submit("PUT", `${base}/plan`),
    },
    settings: {
      title: "Ajustes",
      submitLabel: "Salvar",
      fields: [
        { name: "name", label: "Nome", type: "text", required: true, defaultValue: d.child.name, maxLength: 60 },
        { name: "weeklyLimit", label: "Limite semanal de gastos (R$, opcional)", type: "money", defaultValue: d.child.weeklyLimitCents ? String(d.child.weeklyLimitCents / 100).replace(".", ",") : undefined, hint: "Serve só de orientação — não bloqueia compras." },
        { name: "allowNegativeBalance", label: "Permitir saldo negativo", type: "checkbox", defaultValue: d.child.allowNegativeBalance },
      ],
      onSubmit: submit("PATCH", base),
    },
  };
  const current = dialog ? forms[dialog] : null;

  async function decide(taskId: string, approve: boolean) {
    const result = await call("POST", `${base}/tasks/${taskId}/complete`, { approve });
    if (result.error) setNotice(result.error);
    else setNotice(null);
    refresh();
  }
  async function review(completionId: string, approve: boolean) {
    const result = await call("POST", `/api/allowance/completions/${completionId}/${approve ? "approve" : "reject"}`);
    setNotice(result.error ?? null);
    refresh();
  }

  const m = d.month;
  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <Avatar avatar={d.child.avatar} name={d.child.name} size="h-16 w-16 text-4xl" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-zinc-500">
            <Link href="/mesada" className="hover:underline">
              Mesada
            </Link>
          </p>
          <h1 className="truncate text-2xl font-bold text-zinc-900">{d.child.name}</h1>
        </div>
        <Button type="button" variant="ghost" onClick={() => setDialog("settings")}>
          Ajustes
        </Button>
      </header>

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Saldo disponível</p>
          <p className={`mt-1 text-3xl font-bold ${d.balanceCents < 0 ? "text-red-700" : "text-zinc-900"}`}>{formatCents(d.balanceCents)}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Cofrinho 🐷</p>
          <p className="mt-1 text-3xl font-bold text-amber-700">{formatCents(d.savingsCents)}</p>
        </div>
      </section>

      <button type="button" onClick={() => setDialog("plan")} className="flex w-full items-center justify-between rounded-xl border border-zinc-200 p-4 text-left hover:border-teal-700">
        <span>
          <span className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">Mesada</span>
          <span className="block text-base font-semibold text-zinc-900">{d.plan ? `${formatCents(d.plan.monthlyAmountCents)} / mês` : "Definir mesada"}</span>
        </span>
        <span className="text-right text-sm text-zinc-600">{d.plan ? `Próxima: ${formatDayMonth(d.nextPaymentDate)}` : "Toque para configurar"}</span>
      </button>

      {d.alerts.length > 0 ? (
        <ul className="space-y-2">
          {d.alerts.map((alert) => (
            <li key={alert.message} className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {alert.kind === "SAVED_25" ? "🌟 " : "💡 "}
              {alert.message}
            </li>
          ))}
        </ul>
      ) : null}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ActionButton emoji="🛍️" label="Registrar gasto" onClick={() => setDialog("expense")} />
        <ActionButton emoji="➕" label="Adicionar entrada" onClick={() => setDialog("income")} />
        <ActionButton emoji="🐷" label="Guardar" onClick={() => setDialog("deposit")} tone="bg-amber-50/60" />
        <ActionButton emoji="🪙" label="Retirar do cofrinho" onClick={() => setDialog("withdraw")} />
      </section>

      <nav aria-label="Seções" className="flex gap-1 overflow-x-auto border-b border-zinc-200">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            aria-current={tab === item.id ? "page" : undefined}
            className={`min-h-11 shrink-0 px-4 text-sm font-semibold ${tab === item.id ? "border-b-2 border-teal-700 text-teal-800" : "text-zinc-600"}`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {notice ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {notice}
        </p>
      ) : null}

      {tab === "resumo" ? (
        <div className="space-y-5">
          <section className="rounded-xl border border-zinc-200 p-4">
            <h2 className="text-base font-semibold text-zinc-900">Este mês</h2>
            <dl className="mt-3 space-y-2 text-sm">
              {[
                ["Recebeu", formatCents(m.totalIncomeCents), "text-emerald-700"],
                ["  · Mesada", formatCents(m.allowanceIncomeCents), "text-zinc-600"],
                ["  · Recompensas", formatCents(m.rewardIncomeCents), "text-zinc-600"],
                ["  · Outras entradas", formatCents(m.extraIncomeCents), "text-zinc-600"],
                ["Gastou", formatCents(m.expensesCents), "text-red-700"],
                ["Guardou", formatCents(m.savingsCents), "text-amber-700"],
                ["Saldo final", formatCents(m.balanceCents), "text-zinc-900 font-bold"],
              ].map(([label, value, cls]) => (
                <div key={label} className="flex justify-between gap-3 border-b border-zinc-100 pb-1">
                  <dt className="whitespace-pre text-zinc-600">{label}</dt>
                  <dd className={`font-semibold ${cls}`}>{value}</dd>
                </div>
              ))}
            </dl>
            {d.weekly ? (
              <p className="mt-3 text-sm text-zinc-700">
                Semana: gastou {formatCents(d.weekly.spentCents)} de {formatCents(d.weekly.limitCents)} · restante sugerido {formatCents(d.weekly.remainingCents)}
              </p>
            ) : null}
          </section>

          {m.byCategory.length > 0 ? (
            <section className="rounded-xl border border-zinc-200 p-4">
              <h2 className="text-base font-semibold text-zinc-900">Gastos por categoria</h2>
              <ul className="mt-3 space-y-3">
                {m.byCategory.map((c) => (
                  <li key={c.categoryId ?? c.name}>
                    <div className="flex justify-between text-sm">
                      <span>
                        {c.icon} {c.name}
                      </span>
                      <span className="font-medium">
                        {c.pct}% · {formatCents(c.totalCents)}
                      </span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-zinc-100" role="presentation">
                      <div className="h-2 rounded-full bg-teal-600" style={{ width: `${c.pct}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {d.badges.length > 0 ? (
            <section className="rounded-xl border border-zinc-200 p-4">
              <h2 className="text-base font-semibold text-zinc-900">Medalhas</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {d.badges.map((b) => (
                  <li key={b.code} className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-900">
                    🏅 {b.label}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="rounded-xl border border-zinc-200 p-4">
            <h2 className="text-base font-semibold text-zinc-900">Últimas movimentações</h2>
            {d.recent.length === 0 ? <p className="mt-2 text-sm text-zinc-500">Ainda não há movimentações.</p> : <ul className="mt-1 divide-y divide-zinc-100">{d.recent.map((t) => <TransactionRow key={t.id} t={t} />)}</ul>}
          </section>
        </div>
      ) : null}

      {tab === "historico" ? (
        <section>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {KIND_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setKind(f.value)}
                className={`min-h-9 shrink-0 rounded-full px-3 text-sm font-medium ${kind === f.value ? "bg-teal-700 text-white" : "bg-zinc-100 text-zinc-700"}`}
              >
                {f.label}
              </button>
            ))}
          </div>
          {history === null ? <p className="mt-3 text-sm text-zinc-500">Carregando…</p> : history.length === 0 ? <p className="mt-3 text-sm text-zinc-500">Nada por aqui ainda.</p> : <ul className="divide-y divide-zinc-100">{history.map((t) => <TransactionRow key={t.id} t={t} />)}</ul>}
        </section>
      ) : null}

      {tab === "metas" ? (
        <section className="space-y-3">
          {d.goals.length === 0 ? <p className="text-sm text-zinc-500">Crie uma meta (ex.: bicicleta) e vincule o que for guardando.</p> : null}
          {d.goals.map((g) => (
            <article key={g.id} className="rounded-xl border border-zinc-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold text-zinc-900">
                  {g.icon} {g.name}
                </h3>
                {g.status === "ACHIEVED" ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">Atingida 🎉</span> : null}
              </div>
              <p className="mt-1 text-sm text-zinc-600">
                {formatCents(g.savedCents)} de {formatCents(g.targetCents)} · {g.progressPct}%
                {g.targetDate ? ` · até ${formatDateBr(g.targetDate)}` : ""}
              </p>
              <div className="mt-2 h-3 rounded-full bg-zinc-100" role="progressbar" aria-valuenow={g.progressPct} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-3 rounded-full bg-amber-500" style={{ width: `${g.progressPct}%` }} />
              </div>
            </article>
          ))}
          <Button type="button" onClick={() => setDialog("goal")} className="w-full sm:w-auto">
            Criar meta
          </Button>
        </section>
      ) : null}

      {tab === "tarefas" ? (
        <section className="space-y-3">
          {d.tasks.length === 0 ? <p className="text-sm text-zinc-500">Cadastre tarefas educativas — com ou sem recompensa em dinheiro.</p> : null}
          {d.tasks.map((t) => (
            <article key={t.id} className="rounded-xl border border-zinc-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-zinc-900">{t.name}</h3>
                  <p className="text-xs text-zinc-500">
                    {t.hasReward ? `Com recompensa: ${formatCents(t.rewardCents)}` : "Tarefa sem recompensa"}
                    {t.repeatable ? "" : " · única"}
                    {t.completedCount > 0 ? ` · feita ${t.completedCount}x` : ""}
                  </p>
                </div>
              </div>
              {t.pendingCompletionId ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-sm text-amber-800">Aguardando sua aprovação</span>
                  <Button type="button" onClick={() => review(t.pendingCompletionId!, true)}>
                    Aprovar{t.hasReward ? ` e pagar ${formatCents(t.rewardCents)}` : ""}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => review(t.pendingCompletionId!, false)}>
                    Recusar
                  </Button>
                </div>
              ) : t.done ? (
                <p className="mt-3 text-sm font-medium text-emerald-700">Concluída ✔</p>
              ) : (
                <Button type="button" variant="secondary" className="mt-3" onClick={() => decide(t.id, true)}>
                  Marcar como concluída{t.hasReward ? ` (+${formatCents(t.rewardCents)})` : ""}
                </Button>
              )}
            </article>
          ))}
          <Button type="button" onClick={() => setDialog("task")} className="w-full sm:w-auto">
            Criar tarefa
          </Button>
        </section>
      ) : null}

      {current ? <QuickForm key={dialog} open title={current.title} fields={current.fields} submitLabel={current.submitLabel} intro={current.intro} onClose={() => setDialog(null)} onSubmit={current.onSubmit} /> : null}
    </div>
  );
}
