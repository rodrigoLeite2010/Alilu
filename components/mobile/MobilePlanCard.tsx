"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { formatPriceBrl, listPlans } from "@/lib/billing/plans";
import type { MobileBillingNotice, MobileBillingSummary } from "@/components/mobile/useMobileBilling";

const noticeClasses: Record<MobileBillingNotice["level"], string> = {
  blocked: "border-red-200 bg-red-50 text-red-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  info: "border-zinc-200 bg-zinc-50 text-zinc-700",
};

const linkClasses =
  "inline-flex min-h-11 w-full items-center justify-center rounded-md px-4 py-2.5 text-base font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent";

/** Aviso mais grave (blocked > warning), se houver — usado também no alerta do topo da home. */
export function topBillingNotice(summary: MobileBillingSummary | null): MobileBillingNotice | null {
  const notice = summary?.notices.find((item) => item.level === "blocked" || item.level === "warning");
  return notice ?? null;
}

/** Deslogado: os planos aparecem mesmo sem login (ver tudo, entrar só para assinar). */
export function MobilePlanTeaser() {
  const cheapest = listPlans()[0];
  return (
    <section aria-labelledby="mobile-plan-teaser" className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <h2 id="mobile-plan-teaser" className="text-lg font-semibold text-zinc-900">
        Planos do Piloto Automático
      </h2>
      <p className="mt-1 text-sm text-zinc-700">
        Publicação automática no Instagram a partir de {formatPriceBrl(cheapest.priceCents)}/mês, com ou sem IA. As ferramentas continuam grátis.
      </p>
      <Link href="/planos" className={`${linkClasses} mt-3 bg-white text-brand-primary ring-1 ring-inset ring-brand-primary/25 active:bg-brand-primary-soft`}>
        Ver planos
      </Link>
    </section>
  );
}

function statusLine(summary: MobileBillingSummary): string {
  const { access, plan } = summary;
  if (access.status === "EXEMPT") return "Acesso liberado";
  if (plan) return plan.complimentary ? `Plano ${plan.name} · cortesia` : `Plano ${plan.name} · ${formatPriceBrl(plan.priceCents)}/mês`;
  if (access.status === "PAST_DUE") return "Pagamento em atraso";
  if (access.status === "PENDING_PAYMENT") return "Pagamento aguardando confirmação";
  if (access.status === "NEW" || access.status === "TRIAL") {
    return access.remainingToday !== null ? `Teste grátis · ${access.remainingToday} de 3 automações hoje` : "Teste grátis";
  }
  return "Sem plano ativo";
}

/** Logado: plano, uso da franquia de IA, saldo de créditos e atalhos — tudo numa tela de celular. */
export function MobilePlanCard({
  loading,
  summary,
  credits,
}: {
  loading: boolean;
  summary: MobileBillingSummary | null;
  credits: number | null;
}) {
  if (loading) return <div aria-hidden className="h-32 animate-pulse rounded-xl bg-zinc-100" />;
  if (!summary) return <MobilePlanTeaser />;

  const usage = summary.aiUsage;
  const pct = usage ? Math.min(100, Math.round((usage.used / Math.max(usage.limit, 1)) * 100)) : 0;
  const barColor = pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-teal-600";
  const manage = summary.plan ? "Gerenciar plano" : summary.access.status === "EXEMPT" ? null : "Ver planos";

  return (
    <section aria-labelledby="mobile-plan-card" className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <h2 id="mobile-plan-card" className="text-lg font-semibold text-zinc-900">
        Seu plano
      </h2>
      <p className="mt-1 text-sm text-zinc-700">{statusLine(summary)}</p>
      {summary.pendingPlan ? <p className="text-sm text-amber-800">Muda para {summary.pendingPlan.name} no próximo ciclo.</p> : null}

      {usage ? (
        <div className="mt-3">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-zinc-700">Publicações com IA</span>
            <span className="tabular-nums font-medium text-zinc-900">
              {usage.used} de {usage.limit}
            </span>
          </div>
          <div
            className="mt-1.5 h-2 overflow-hidden rounded-full bg-zinc-100"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={usage.limit}
            aria-valuenow={usage.used}
            aria-label="Publicações com IA usadas no ciclo"
          >
            <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      ) : null}

      <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-zinc-50 px-3 py-2.5">
        <span className="flex items-center gap-2 text-sm text-zinc-700">
          <Icon name="coins" className="h-5 w-5 text-zinc-500" />
          Créditos de IA
        </span>
        <span className="text-sm font-semibold tabular-nums text-zinc-900" data-testid="mobile-credits">
          {credits !== null ? credits : "—"}
        </span>
      </div>

      <div className="mt-3 grid gap-2">
        {manage ? (
          <Link href="/planos" className={`${linkClasses} bg-white text-brand-primary ring-1 ring-inset ring-brand-primary/25 active:bg-brand-primary-soft`}>
            {manage}
          </Link>
        ) : null}
        <Link href="/minha-conta/creditos-ia" className={`${linkClasses} text-brand-primary active:bg-brand-primary-soft`}>
          Comprar créditos
        </Link>
      </div>
    </section>
  );
}

/** Alerta compacto de limite/pagamento no topo da home — avisa cedo, com o caminho para resolver. */
export function MobileBillingAlert({ notice }: { notice: MobileBillingNotice }) {
  return (
    <p role="status" className={`rounded-xl border px-4 py-3 text-sm ${noticeClasses[notice.level]}`}>
      {notice.message}{" "}
      <Link href="/planos" className="font-semibold underline">
        Ver planos
      </Link>
    </p>
  );
}
