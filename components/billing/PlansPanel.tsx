"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { Dialog } from "@/components/instagram/Dialog";
import { ConfirmDialog } from "@/components/instagram/ConfirmDialog";
import { formatPriceBrl } from "@/lib/billing/plans";

/**
 * Tela de planos e assinatura (/planos). Funciona SEM login (mostra os
 * planos e convida a entrar) e, logada, mostra o plano atual, a franquia
 * de IA do ciclo, os avisos de limite e as ações: assinar, fazer upgrade,
 * agendar downgrade, cancelar e reativar. Toda regra (preço, limite,
 * acesso) vem do servidor — esta tela só desenha e dispara as ações.
 */

interface PlanDto {
  code: "AUTOMATION" | "CREATOR" | "PRO";
  name: string;
  priceCents: number;
  includesAi: boolean;
  aiPostsPerCycle: number | null;
  aiDailyReference: number | null;
  includesImporter: boolean;
  features: string[];
  upcoming: string[];
}

interface NoticeDto {
  code: string;
  level: "blocked" | "warning" | "info";
  message: string;
}

interface SummaryDto {
  access: {
    allowed: boolean;
    status: "NEW" | "TRIAL" | "PENDING_PAYMENT" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "EXPIRED" | "EXEMPT";
    reason: string | null;
    trialEndsAt: string | null;
    remainingToday: number | null;
    currentPeriodEndsAt: string | null;
  };
  plan: { code: PlanDto["code"]; name: string; priceCents: number; complimentary?: boolean } | null;
  pendingPlan: { code: PlanDto["code"]; name: string } | null;
  aiUsage: {
    used: number;
    limit: number;
    remaining: number;
    cycleEndsAt: string | null;
    dailyUsed: number;
    dailyReference: number | null;
  } | null;
  notices: NoticeDto[];
}

interface PlansResponse {
  authenticated: boolean;
  plans: PlanDto[];
  summary: SummaryDto | null;
}

type Action =
  | { kind: "subscribe"; plan: PlanDto }
  | { kind: "upgrade"; plan: PlanDto }
  | { kind: "downgrade"; plan: PlanDto }
  | { kind: "cancel" }
  | { kind: "reactivate" }
  | { kind: "undo-downgrade" };

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === "string" && body.error ? body.error : fallback;
  } catch {
    return fallback;
  }
}

const noticeStyles: Record<NoticeDto["level"], string> = {
  blocked: "border-red-200 bg-red-50 text-red-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  info: "border-zinc-200 bg-zinc-50 text-zinc-700",
};

export function PlansPanel({ initialData = null }: { initialData?: PlansResponse | null }) {
  const [data, setData] = useState<PlansResponse | null>(initialData);
  const [loadError, setLoadError] = useState(false);
  const [action, setAction] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [email, setEmail] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/billing/summary", { cache: "no-store" });
      if (!response.ok) throw new Error("load");
      setData((await response.json()) as PlansResponse);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/billing/summary", { cache: "no-store" })
      .then((response) => (response.ok ? (response.json() as Promise<PlansResponse>) : Promise.reject(new Error("load"))))
      .then((body) => {
        if (active) setData(body);
      })
      .catch(() => {
        if (active) setLoadError(true);
      });
    return () => {
      active = false;
    };
  }, []);

  function closeAction() {
    if (busy) return;
    setAction(null);
    setActionError(null);
  }

  async function post(body: Record<string, unknown>): Promise<Response> {
    return fetch("/api/billing/automation-subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async function runAction() {
    if (!action) return;
    setBusy(true);
    setActionError(null);
    try {
      if (action.kind === "subscribe") {
        const response = await post({ action: "checkout", planCode: action.plan.code, name, cpfCnpj, email: email || undefined });
        if (!response.ok) {
          setActionError(await readErrorMessage(response, "Não foi possível iniciar o pagamento."));
          return;
        }
        window.location.href = ((await response.json()) as { checkoutUrl: string }).checkoutUrl;
        return;
      }
      if (action.kind === "upgrade" || action.kind === "downgrade") {
        const response = await post({ action: "change-plan", planCode: action.plan.code });
        if (!response.ok) {
          setActionError(await readErrorMessage(response, "Não foi possível trocar de plano agora."));
          return;
        }
        const result = (await response.json()) as { kind: "upgrade" | "downgrade"; checkoutUrl?: string };
        if (result.kind === "upgrade" && result.checkoutUrl) {
          window.location.href = result.checkoutUrl;
          return;
        }
      } else {
        const apiAction = action.kind === "cancel" ? "cancel" : action.kind === "reactivate" ? "reactivate" : "cancel-plan-change";
        const response = await post({ action: apiAction });
        if (!response.ok) {
          setActionError(await readErrorMessage(response, "Não foi possível concluir agora."));
          return;
        }
      }
      setAction(null);
      await load();
    } catch {
      setActionError("Não foi possível conectar. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <p className="text-sm text-zinc-500" role="status">
        {loadError ? "Não foi possível carregar os planos agora. Atualize a página." : "Carregando planos…"}
      </p>
    );
  }

  const { plans, authenticated, summary } = data;
  const status = summary?.access.status ?? null;
  const currentPlan = summary?.plan ?? null;
  const currentPrice = currentPlan?.priceCents ?? 0;
  const loginHref = `/entrar?callbackUrl=${encodeURIComponent("/planos")}`;
  const periodEnd = formatDate(summary?.access.currentPeriodEndsAt ?? null);
  const canceledWithAccess = status === "CANCELED" && summary?.access.allowed === true;
  const complimentary = status === "ACTIVE" && currentPlan?.complimentary === true;
  const hasPaidPlan = status === "ACTIVE" && currentPlan !== null && !complimentary;
  const canSubscribe = authenticated && !hasPaidPlan && !complimentary && status !== "EXEMPT" && status !== "PAST_DUE" && !canceledWithAccess;

  function renderPlanAction(plan: PlanDto) {
    if (!authenticated) {
      return (
        <LinkButton href={loginHref} className="w-full justify-center">
          Entrar para assinar
        </LinkButton>
      );
    }
    if (status === "EXEMPT") return <p className="text-center text-xs text-zinc-500">Seu login já tem acesso liberado.</p>;
    if (status === "PAST_DUE") return <p className="text-center text-xs text-amber-800">Regularize o pagamento para trocar de plano.</p>;
    if (canceledWithAccess) {
      return <p className="text-center text-xs text-zinc-500">Reative a assinatura para continuar.</p>;
    }
    if (complimentary) {
      return currentPlan?.code === plan.code ? (
        <Badge tone="brand">Seu plano (cortesia)</Badge>
      ) : (
        <p className="text-center text-xs text-zinc-500">Disponível quando a cortesia terminar.</p>
      );
    }
    if (hasPaidPlan && currentPlan) {
      if (currentPlan.code === plan.code) return <Badge tone="brand">Seu plano</Badge>;
      if (summary?.pendingPlan?.code === plan.code) return <Badge tone="warning">Agendado para o próximo ciclo</Badge>;
      if (plan.priceCents > currentPrice) {
        return (
          <Button type="button" className="w-full justify-center" onClick={() => setAction({ kind: "upgrade", plan })}>
            Fazer upgrade
          </Button>
        );
      }
      return (
        <Button type="button" variant="secondary" className="w-full justify-center" onClick={() => setAction({ kind: "downgrade", plan })}>
          Mudar no próximo ciclo
        </Button>
      );
    }
    if (canSubscribe) {
      return (
        <Button type="button" className="w-full justify-center" onClick={() => setAction({ kind: "subscribe", plan })}>
          Assinar {plan.name}
        </Button>
      );
    }
    return null;
  }

  const usage = summary?.aiUsage ?? null;
  const usagePct = usage ? Math.min(100, Math.round((usage.used / Math.max(usage.limit, 1)) * 100)) : 0;
  const usageBarColor = usagePct >= 100 ? "bg-red-500" : usagePct >= 80 ? "bg-amber-500" : "bg-teal-600";

  let dialog: { title: string; description: string; confirm: string } | null = null;
  if (action?.kind === "upgrade") {
    dialog = {
      title: `Fazer upgrade para ${action.plan.name}?`,
      description: `Você paga agora só a diferença proporcional aos dias que faltam do ciclo atual (mínimo de R$ 5,00). Assim que o pagamento for confirmado, o plano ${action.plan.name} já vale; a partir da próxima renovação a cobrança é de ${formatPriceBrl(action.plan.priceCents)}/mês. Você escolhe Pix, boleto ou cartão na próxima tela.`,
      confirm: "Continuar para o pagamento",
    };
  } else if (action?.kind === "downgrade") {
    dialog = {
      title: `Mudar para ${action.plan.name} no próximo ciclo?`,
      description: `Nada muda agora: você continua com o plano atual até ${periodEnd ?? "o fim do período já pago"}. Depois disso a cobrança passa a ser de ${formatPriceBrl(action.plan.priceCents)}/mês.`,
      confirm: "Agendar mudança",
    };
  } else if (action?.kind === "cancel") {
    dialog = {
      title: "Cancelar assinatura?",
      description: `Você continua com acesso até ${periodEnd ?? "o fim do período já pago"}. Depois disso, novas automações ficam pausadas até assinar de novo — nada que já foi criado ou agendado é apagado.`,
      confirm: "Cancelar assinatura",
    };
  } else if (action?.kind === "reactivate") {
    dialog = {
      title: "Reativar assinatura?",
      description: `Você não paga nada agora. Seu acesso continua normalmente e a próxima cobrança será em ${periodEnd ?? "o fim do período já pago"}, renovando todo mês.`,
      confirm: "Reativar assinatura",
    };
  } else if (action?.kind === "undo-downgrade") {
    dialog = {
      title: "Manter o plano atual?",
      description: "A mudança agendada será desfeita e a cobrança do próximo ciclo continua no valor do plano atual.",
      confirm: "Manter plano atual",
    };
  }

  return (
    <div className="space-y-8">
      {summary && summary.notices.length > 0 ? (
        <div className="space-y-2" aria-live="polite">
          {summary.notices.map((notice) => (
            <p key={notice.code} className={`rounded-lg border px-4 py-3 text-sm ${noticeStyles[notice.level]}`}>
              {notice.message}
            </p>
          ))}
        </div>
      ) : null}

      {authenticated && summary ? (
        <section className="rounded-lg border border-zinc-200 p-5" aria-labelledby="sua-assinatura">
          <h2 id="sua-assinatura" className="text-base font-semibold text-zinc-900">
            Sua assinatura
          </h2>
          {status === "EXEMPT" ? (
            <p className="mt-2 text-sm text-zinc-600">Seu login tem acesso liberado ao Piloto Automático e aos recursos de IA, sem cobrança.</p>
          ) : null}
          {(status === "NEW" || status === "TRIAL") && summary.access.allowed ? (
            <p className="mt-2 text-sm text-zinc-600">
              Você está no teste grátis do Piloto Automático
              {summary.access.remainingToday !== null ? ` — ${summary.access.remainingToday} de 3 automações restantes hoje` : ""}
              {summary.access.trialEndsAt ? `, até ${formatDate(summary.access.trialEndsAt)}` : ""}.
            </p>
          ) : null}
          {status === "PENDING_PAYMENT" ? (
            <p className="mt-2 text-sm text-amber-900">
              Pagamento aguardando confirmação. Assim que for confirmado, o plano é liberado (Pix costuma levar instantes; boleto, até 1 dia útil).
            </p>
          ) : null}
          {status === "PAST_DUE" ? (
            <p className="mt-2 text-sm text-amber-900">
              Pagamento em atraso: novas publicações automáticas ficam pausadas até a cobrança ser confirmada. Nada do que já foi criado ou agendado é apagado.
            </p>
          ) : null}
          {(status === "EXPIRED" || (status === "CANCELED" && !canceledWithAccess)) ? (
            <p className="mt-2 text-sm text-zinc-600">Você não tem um plano ativo. Escolha um plano abaixo para continuar com o Piloto Automático.</p>
          ) : null}
          {complimentary && currentPlan ? (
            <p className="mt-2 text-sm text-zinc-700">
              <span className="font-medium text-zinc-900">Plano {currentPlan.name} — cortesia</span>
              {periodEnd ? `, válido até ${periodEnd}` : ""}. Sem cobrança. Quando terminar, é só escolher um plano para continuar.
            </p>
          ) : null}
          {(hasPaidPlan || canceledWithAccess) && currentPlan ? (
            <div className="mt-2 space-y-3">
              <p className="text-sm text-zinc-700">
                <span className="font-medium text-zinc-900">
                  Plano {currentPlan.name} — {formatPriceBrl(currentPlan.priceCents)}/mês
                </span>
                {canceledWithAccess
                  ? `. Cancelado: acesso até ${periodEnd ?? "o fim do período pago"}.`
                  : periodEnd
                    ? `. Renova em ${periodEnd}.`
                    : "."}
              </p>
              {summary.pendingPlan ? (
                <p className="text-sm text-amber-900">
                  Mudança agendada para o plano {summary.pendingPlan.name} no próximo ciclo.{" "}
                  <button type="button" className="font-medium underline" onClick={() => setAction({ kind: "undo-downgrade" })}>
                    Desfazer
                  </button>
                </p>
              ) : null}
              <div>
                {canceledWithAccess ? (
                  <Button type="button" onClick={() => setAction({ kind: "reactivate" })}>
                    Reativar assinatura
                  </Button>
                ) : (
                  <Button type="button" variant="secondary" onClick={() => setAction({ kind: "cancel" })}>
                    Cancelar assinatura
                  </Button>
                )}
              </div>
            </div>
          ) : null}

          {usage ? (
            <div className="mt-5 border-t border-zinc-100 pt-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium text-zinc-900">Publicações com IA neste ciclo</p>
                <p className="text-sm tabular-nums text-zinc-700">
                  {usage.used} de {usage.limit}
                </p>
              </div>
              <div
                className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-100"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={usage.limit}
                aria-valuenow={usage.used}
                aria-label="Publicações com IA usadas no ciclo"
              >
                <div className={`h-full ${usageBarColor}`} style={{ width: `${usagePct}%` }} />
              </div>
              <p className="mt-2 text-xs text-zinc-500">
                Restam {usage.remaining}
                {usage.cycleEndsAt ? ` — o ciclo recomeça em ${formatDate(usage.cycleEndsAt)}` : ""}.
                {usage.dailyReference !== null
                  ? ` Hoje: ${usage.dailyUsed} (ritmo de referência do plano: cerca de ${usage.dailyReference} por dia, só um aviso).`
                  : ""}{" "}
                Publicar com texto próprio, manualmente, não consome a franquia.
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      <section aria-labelledby="planos-titulo">
        <h2 id="planos-titulo" className="text-base font-semibold text-zinc-900">
          Escolha seu plano
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          A assinatura cobre o Piloto Automático. Quem usa IA para criar o texto escolhe o plano pela quantidade de publicações por mês.
          {!authenticated ? " Você pode ver tudo sem entrar; para assinar, é só entrar na sua conta." : ""}
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = hasPaidPlan && currentPlan?.code === plan.code;
            return (
              <article
                key={plan.code}
                className={`flex flex-col rounded-lg border p-5 ${isCurrent ? "border-teal-600 ring-1 ring-teal-600" : "border-zinc-200"}`}
              >
                <h3 className="text-lg font-semibold text-zinc-900">{plan.name}</h3>
                <p className="mt-1 text-2xl font-bold text-zinc-900">
                  {formatPriceBrl(plan.priceCents)}
                  <span className="text-sm font-normal text-zinc-500">/mês</span>
                </p>
                <p className="mt-1 text-xs text-zinc-500">{plan.includesAi ? "Com IA para criar os textos" : "Texto escrito por você, sem IA"}</p>
                {/* Celular: o botão vem logo abaixo do preço (order); no desktop fica no rodapé do card. */}
                <ul className="order-3 mt-4 flex-1 space-y-2 text-sm text-zinc-700 md:order-none">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <span aria-hidden className="text-teal-700">
                        ✓
                      </span>
                      <span>{feature}</span>
                    </li>
                  ))}
                  {plan.upcoming.length > 0 ? (
                    <li className="pt-1 text-xs text-zinc-500">Em breve: {plan.upcoming.join(", ")}.</li>
                  ) : null}
                </ul>
                <div className="order-2 mt-4 flex min-h-11 items-center justify-center md:order-none md:mt-5">{renderPlanAction(plan)}</div>
              </article>
            );
          })}
        </div>
        {!authenticated || status === "NEW" || status === "TRIAL" ? (
          <p className="mt-3 text-xs text-zinc-500">
            Todo mundo começa com 7 dias de teste grátis do Piloto Automático, com até 3 automações por dia, sem precisar assinar antes.
          </p>
        ) : null}
      </section>

      <section className="grid gap-4 md:grid-cols-2" aria-label="O que é grátis e créditos">
        <div className="rounded-lg border border-zinc-200 p-5">
          <h2 className="text-base font-semibold text-zinc-900">O que continua grátis</h2>
          <ul className="mt-2 space-y-1.5 text-sm text-zinc-700">
            <li>Todos os utilitários e calculadoras do Alilu.</li>
            <li>Publicar e agendar manualmente no Instagram, inclusive Stories e Reels feitos por você.</li>
            <li>O que é manual fica grátis; o plano cobre a automação.</li>
          </ul>
        </div>
        <div className="rounded-lg border border-zinc-200 p-5">
          <h2 className="text-base font-semibold text-zinc-900">Créditos de IA</h2>
          <p className="mt-2 text-sm text-zinc-700">
            Recursos de IA mais caros, como vídeo gerado por IA, usam créditos — compre só quando precisar, sem assinatura. 100 créditos custam{" "}
            {formatPriceBrl(500)}.
          </p>
          <div className="mt-3">
            <LinkButton href="/minha-conta/creditos-ia" variant="secondary">
              Ver meus créditos
            </LinkButton>
          </div>
        </div>
      </section>

      <p className="text-xs text-zinc-500">
        Pagamento por Pix, boleto ou cartão, processado pelo Asaas — o Alilu nunca vê nem guarda dados de cartão. Cancele quando quiser, pela própria
        página. Dúvidas? <Link href="/contato" className="underline">Fale com a gente</Link>.
      </p>

      {action?.kind === "subscribe" ? (
        <Dialog
          open
          title={`Assinar o plano ${action.plan.name}`}
          onClose={closeAction}
          footer={
            <>
              <Button type="button" variant="secondary" onClick={closeAction} disabled={busy}>
                Cancelar
              </Button>
              <Button type="button" onClick={() => void runAction()} disabled={busy || !name.trim() || !cpfCnpj.trim()}>
                {busy ? "Aguarde…" : "Continuar para o pagamento"}
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <p className="text-sm text-zinc-600">
              {formatPriceBrl(action.plan.priceCents)} por mês, renovação automática, cancele quando quiser. Você escolhe Pix, boleto ou cartão na próxima
              tela.
            </p>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-zinc-700">Nome completo</span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                placeholder="Como está no seu documento"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-zinc-700">CPF ou CNPJ</span>
              <input
                type="text"
                value={cpfCnpj}
                onChange={(event) => setCpfCnpj(event.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                placeholder="Exigido para emitir a cobrança"
                inputMode="numeric"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-zinc-700">E-mail (opcional)</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                placeholder="Para receber a confirmação do pagamento"
              />
            </label>
            {actionError ? <p className="text-sm text-red-600">{actionError}</p> : null}
          </div>
        </Dialog>
      ) : null}

      {dialog ? (
        <ConfirmDialog
          open
          title={dialog.title}
          description={`${dialog.description}${actionError ? ` ${actionError}` : ""}`}
          confirmLabel={dialog.confirm}
          destructive={action?.kind === "cancel"}
          busy={busy}
          onConfirm={() => void runAction()}
          onClose={closeAction}
        />
      ) : null}
    </div>
  );
}
