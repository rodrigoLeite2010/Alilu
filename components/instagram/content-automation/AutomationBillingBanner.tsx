"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import Link from "next/link";
import { ConfirmDialog } from "@/components/instagram/ConfirmDialog";

/**
 * Banner de acesso do Piloto Automático — trial (dias/usos restantes),
 * limite diário atingido, teste encerrado / pagamento pendente ou
 * atrasado (convida a assinar), e painel de assinante ativo (com
 * cancelar). Nunca bloqueia a TELA em si — só informa; quem realmente
 * bloqueia a geração é o AutomationAccessService no servidor (ver
 * content-automation-cron.ts). Copy sem linguagem agressiva de venda,
 * como pedido.
 */

export interface AutomationAccessDto {
  allowed: boolean;
  status: "NEW" | "TRIAL" | "PENDING_PAYMENT" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "EXPIRED" | "EXEMPT";
  reason: string | null;
  trialEndsAt: string | null;
  remainingToday: number | null;
  currentPeriodEndsAt: string | null;
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === "string" && body.error ? body.error : fallback;
  } catch {
    return fallback;
  }
}

function formatDatePtBr(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const diffMs = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
}

export function AutomationBillingBanner({
  initialAccess,
  planName = null,
  planPriceLabel = null,
}: {
  initialAccess: AutomationAccessDto;
  /** Nome do plano pago em vigor (Automático/Criador/Pro), quando houver. */
  planName?: string | null;
  planPriceLabel?: string | null;
}) {
  const [access, setAccess] = useState(initialAccess);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [reactivateOpen, setReactivateOpen] = useState(false);
  const [reactivateBusy, setReactivateBusy] = useState(false);
  const [reactivateError, setReactivateError] = useState<string | null>(null);

  async function refreshAccess() {
    try {
      const response = await fetch("/api/billing/automation-access");
      if (response.ok) setAccess((await response.json()) as AutomationAccessDto);
    } catch {
      // silencioso — o banner só fica com a informação anterior até a próxima visita à tela.
    }
  }

  async function confirmCancel() {
    setCancelBusy(true);
    setCancelError(null);
    try {
      const response = await fetch("/api/billing/automation-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      if (!response.ok) {
        setCancelError(await readErrorMessage(response, "Não foi possível cancelar agora."));
        return;
      }
      setCancelOpen(false);
      await refreshAccess();
    } catch {
      setCancelError("Não foi possível conectar. Tente novamente.");
    } finally {
      setCancelBusy(false);
    }
  }

  async function confirmReactivate() {
    setReactivateBusy(true);
    setReactivateError(null);
    try {
      const response = await fetch("/api/billing/automation-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reactivate" }),
      });
      if (!response.ok) {
        setReactivateError(await readErrorMessage(response, "Não foi possível reativar agora."));
        return;
      }
      setReactivateOpen(false);
      await refreshAccess();
    } catch {
      setReactivateError("Não foi possível conectar. Tente novamente.");
    } finally {
      setReactivateBusy(false);
    }
  }

  if (access.status === "EXEMPT") {
    return (
      <div className="mb-6 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3">
        <Badge tone="brand">Acesso liberado</Badge>
        <p className="mt-1 text-sm text-teal-900">
          Seu login tem uso ilimitado do Piloto Automático, sem limite diário e sem cobrança.
        </p>
      </div>
    );
  }

  if (access.status === "ACTIVE") {
    return (
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3">
        <div>
          <Badge tone="brand">{planName ? `Plano ${planName}` : "Assinatura ativa"}</Badge>
          <p className="mt-1 text-sm text-teal-900">
            {planPriceLabel ? `${planPriceLabel}/mês — ` : ""}Postagens automáticas sem limite diário
            {access.currentPeriodEndsAt ? ` — renova em ${formatDatePtBr(access.currentPeriodEndsAt)}` : ""}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <LinkButton href="/planos" variant="secondary">
            Gerenciar plano
          </LinkButton>
          <Button type="button" variant="ghost" onClick={() => setCancelOpen(true)}>
            Cancelar assinatura
          </Button>
        </div>
        <ConfirmDialog
          open={cancelOpen}
          title="Cancelar assinatura?"
          description={`Você continua com acesso ao Piloto Automático até ${formatDatePtBr(access.currentPeriodEndsAt) ?? "o fim do período já pago"}. Depois disso, novas automações ficam pausadas até assinar de novo — nada que já foi criado ou agendado é apagado.${cancelError ? ` ${cancelError}` : ""}`}
          confirmLabel="Cancelar assinatura"
          destructive
          busy={cancelBusy}
          onConfirm={confirmCancel}
          onClose={() => setCancelOpen(false)}
        />
      </div>
    );
  }

  if (access.status === "CANCELED" && access.allowed) {
    const periodEnd = formatDatePtBr(access.currentPeriodEndsAt) ?? "o fim do período já pago";
    return (
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
        <div>
          <Badge tone="neutral">Assinatura cancelada</Badge>
          <p className="mt-1 text-sm text-zinc-600">
            Você ainda tem acesso ao Piloto Automático até {periodEnd}.
          </p>
        </div>
        <Button type="button" onClick={() => setReactivateOpen(true)}>
          Reativar assinatura
        </Button>
        <ConfirmDialog
          open={reactivateOpen}
          title="Reativar assinatura?"
          description={`Você não paga nada agora. Seu acesso continua normalmente e a próxima cobrança de R$ 19,00 será em ${periodEnd}, renovando todo mês.${reactivateError ? ` ${reactivateError}` : ""}`}
          confirmLabel="Reativar assinatura"
          busy={reactivateBusy}
          onConfirm={confirmReactivate}
          onClose={() => setReactivateOpen(false)}
        />
      </div>
    );
  }

  if (access.status === "PENDING_PAYMENT") {
    return (
      <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
        <Badge tone="warning">Pagamento aguardando confirmação</Badge>
        <p className="mt-1 text-sm text-amber-900">
          Assim que o pagamento for confirmado, o Piloto libera as postagens automáticas sem limite. Isso costuma
          levar só alguns instantes (Pix) — boleto pode levar até 1 dia útil.
        </p>
      </div>
    );
  }

  if (access.status === "PAST_DUE") {
    return (
      <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
        <Badge tone="warning">Pagamento em atraso</Badge>
        <p className="mt-1 text-sm text-amber-900">
          Novas postagens automáticas ficam pausadas até a próxima cobrança ser confirmada — nada que já foi criado
          ou agendado é apagado.{" "}
          <Link href="/planos" className="font-medium underline">
            Ver assinatura
          </Link>
        </p>
      </div>
    );
  }

  const isTrial = access.status === "NEW" || access.status === "TRIAL";
  const trialDaysLeft = daysUntil(access.trialEndsAt);

  if (isTrial && access.allowed) {
    return (
      <div className="mb-6 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
        <Badge tone="brand">Período de teste</Badge>
        <p className="mt-1 text-sm text-zinc-600">
          {access.remainingToday !== null ? `${access.remainingToday} de 3 automações restantes hoje` : "Até 3 automações por dia"}
          {trialDaysLeft !== null ? ` — termina em ${trialDaysLeft} dia${trialDaysLeft === 1 ? "" : "s"}` : ""}.{" "}
          <Link href="/planos" className="font-medium text-teal-800 underline">
            Ver planos
          </Link>
        </p>
      </div>
    );
  }

  // EXPIRED, ou TRIAL com o limite do dia atingido — convite pra assinar, sem linguagem agressiva.
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
      <div>
        <Badge tone="neutral">{access.status === "EXPIRED" ? "Período de teste encerrado" : "Limite de hoje atingido"}</Badge>
        <p className="mt-1 text-sm text-zinc-600">
          {access.reason ??
            (access.status === "EXPIRED"
              ? "Escolha um plano, a partir de R$ 19,00/mês, para continuar usando o Piloto Automático."
              : "Volte amanhã, ou escolha um plano (a partir de R$ 19,00/mês) para não ter limite diário.")}
        </p>
      </div>
      <LinkButton href="/planos">Ver planos</LinkButton>
    </div>
  );
}
