"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, LinkButton } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Dialog } from "@/components/instagram/Dialog";
import { ConfirmDialog } from "@/components/instagram/ConfirmDialog";
import { CREDIT_TRANSACTION_LABEL, type CreditTransactionType } from "@/lib/ai-video/types";
import { formatBrlFromCents, formatCredits, formatDateTime, readErrorMessage } from "./client-utils";

export interface CreditPackageDto {
  code: string;
  name: string;
  credits: number;
  bonusCredits: number;
  priceCents: number;
}

export interface CreditTransactionDto {
  id: string;
  type: CreditTransactionType;
  amount: number;
  reservedDelta: number;
  availableAfter: number;
  description: string;
  createdAt: string;
}

export interface CreditPurchaseDto {
  id: string;
  packageName: string;
  credits: number;
  priceCents: number;
  status: "PENDING" | "PAID" | "CANCELED" | "REFUNDED" | "CHARGEBACK";
  invoiceUrl: string | null;
  paidAt: string | null;
  createdAt: string;
  refundable: boolean;
}

const PURCHASE_STATUS: Record<CreditPurchaseDto["status"], { label: string; tone: "neutral" | "brand" | "warning" }> = {
  PENDING: { label: "Aguardando pagamento", tone: "warning" },
  PAID: { label: "Pago", tone: "brand" },
  CANCELED: { label: "Cancelado", tone: "neutral" },
  REFUNDED: { label: "Reembolsado", tone: "neutral" },
  CHARGEBACK: { label: "Contestado", tone: "warning" },
};

/**
 * "Minha conta > Créditos de IA": saldo, pacotes (valores vindos do
 * servidor, nunca fixos aqui), compras e extrato. Depois de pagar, a tela
 * acompanha o saldo (só o Webhook do Asaas credita) e, se a pessoa veio
 * de uma geração sem saldo, volta para ela automaticamente.
 */
export function AiCreditsManager({
  initialAvailable,
  initialReserved,
  packages,
  initialPurchases,
  initialTransactions,
  creditsPerShortVideo,
  hasBillingCustomer,
  returnTo,
  requiredCredits,
  refundWindowDays,
  returnedFromPayment = false,
}: {
  initialAvailable: number;
  initialReserved: number;
  packages: CreditPackageDto[];
  initialPurchases: CreditPurchaseDto[];
  initialTransactions: CreditTransactionDto[];
  creditsPerShortVideo: number | null;
  hasBillingCustomer: boolean;
  returnTo: string | null;
  /** Custo da geração que levou a pessoa até aqui (para saber quando já dá para voltar). */
  requiredCredits: number | null;
  refundWindowDays: number;
  /** Chegou aqui de volta do checkout do Asaas (?pagamento=…). */
  returnedFromPayment?: boolean;
}) {
  const router = useRouter();
  const [available, setAvailable] = useState(initialAvailable);
  const [reserved, setReserved] = useState(initialReserved);
  const [purchases, setPurchases] = useState(initialPurchases);
  const [transactions, setTransactions] = useState(initialTransactions);
  const [checkoutPackage, setCheckoutPackage] = useState<CreditPackageDto | null>(null);
  const [name, setName] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refundTarget, setRefundTarget] = useState<CreditPurchaseDto | null>(null);
  const [notice, setNotice] = useState<string | null>(
    returnedFromPayment ? "Pagamento enviado! Assim que o Asaas confirmar, seus créditos aparecem aqui sozinhos — normalmente em poucos segundos no Pix e no cartão." : null,
  );
  /** Link do checkout quando o navegador bloqueou a nova aba. */
  const [blockedCheckoutUrl, setBlockedCheckoutUrl] = useState<string | null>(null);
  const hasPending = purchases.some((purchase) => purchase.status === "PENDING");
  const readyToReturn = returnTo !== null && requiredCredits !== null && requiredCredits > 0 && available >= requiredCredits;
  const needed = requiredCredits ? Math.max(0, requiredCredits - available) : 0;

  async function refresh() {
    try {
      const response = await fetch("/api/ai-video/wallet", { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as {
        wallet: { available: number; reserved: number };
        purchases: CreditPurchaseDto[];
        transactions: CreditTransactionDto[];
      };
      setAvailable(payload.wallet.available);
      setReserved(payload.wallet.reserved);
      setPurchases(payload.purchases);
      setTransactions(payload.transactions);
    } catch {
      // tenta de novo no próximo ciclo
    }
  }

  // Pagamento pendente: acompanha o saldo até o Webhook confirmar.
  useEffect(() => {
    if (!hasPending) return;
    const timer = setInterval(refresh, 5000);
    return () => clearInterval(timer);
  }, [hasPending]);

  useEffect(() => {
    if (readyToReturn && returnTo) {
      const timer = setTimeout(() => {
        router.push(returnTo);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [readyToReturn, returnTo, router]);

  /**
   * O checkout do Asaas abre em NOVA ABA — o Alilu continua aberto aqui e
   * acompanha a confirmação sozinho. A aba é aberta já no clique (antes do
   * fetch), senão o navegador bloqueia o pop-up; depois recebe o endereço.
   */
  async function startCheckout(pkg: CreditPackageDto) {
    setBusy(true);
    setError(null);
    setBlockedCheckoutUrl(null);
    const tab = typeof window !== "undefined" ? window.open("", "_blank") : null;
    if (tab) {
      try {
        tab.document.title = "Abrindo pagamento…";
        tab.document.body.innerHTML = '<p style="font-family:sans-serif;padding:24px">Abrindo o pagamento seguro do Asaas…</p>';
      } catch {
        // aba de outra origem/política do navegador: só segue
      }
    }
    try {
      const response = await fetch("/api/ai-video/credits/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageCode: pkg.code, name, cpfCnpj, email: email || undefined, returnTo, requiredCredits }),
      });
      if (!response.ok) throw new Error(await readErrorMessage(response, "Não foi possível iniciar o pagamento."));
      const payload = (await response.json()) as { checkoutUrl: string };
      if (tab && !tab.closed) {
        tab.opener = null;
        tab.location.href = payload.checkoutUrl;
        setNotice("O pagamento abriu em uma nova aba. Pode pagar lá — esta página atualiza o saldo sozinha quando o pagamento for confirmado.");
      } else {
        setBlockedCheckoutUrl(payload.checkoutUrl);
      }
      setCheckoutPackage(null);
      await refresh();
    } catch (err) {
      if (tab && !tab.closed) tab.close();
      setError(err instanceof Error ? err.message : "Não foi possível iniciar o pagamento.");
    } finally {
      setBusy(false);
    }
  }

  function handleBuy(pkg: CreditPackageDto) {
    setError(null);
    if (hasBillingCustomer) {
      void startCheckout(pkg);
      return;
    }
    setCheckoutPackage(pkg);
  }

  async function confirmRefund() {
    if (!refundTarget) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/ai-video/credits/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purchaseId: refundTarget.id }),
      });
      if (!response.ok) throw new Error(await readErrorMessage(response, "Não foi possível reembolsar."));
      setNotice("Reembolso solicitado. O valor volta pelo mesmo meio de pagamento, conforme o prazo do banco ou cartão.");
      setRefundTarget(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível reembolsar.");
      setRefundTarget(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-zinc-200 p-5">
        <p className="text-sm text-zinc-600">Saldo atual</p>
        <p className="text-3xl font-semibold text-zinc-900">{formatCredits(available)}</p>
        {creditsPerShortVideo ? (
          <p className="mt-1 text-sm text-zinc-600">
            ≈ {Math.floor(available / creditsPerShortVideo)} vídeo(s) de 5 segundos na qualidade Econômica
          </p>
        ) : null}
        {reserved > 0 ? <p className="mt-1 text-xs text-zinc-500">{formatCredits(reserved)} reservados em vídeos sendo gerados.</p> : null}
        {returnTo ? (
          <div className="mt-4 rounded-md border border-teal-200 bg-teal-50 p-3 text-sm text-teal-900">
            {readyToReturn ? (
              <>
                Créditos confirmados! Voltando para a sua geração…{" "}
                <a href={returnTo} className="font-medium underline">
                  Voltar agora
                </a>
              </>
            ) : (
              <>
                {needed > 0 ? `Faltam ${formatCredits(needed)} para a sua geração. ` : ""}
                Assim que o pagamento for confirmado, você volta para a geração com a imagem e as configurações salvas.{" "}
                <a href={returnTo} className="font-medium underline">
                  Voltar sem comprar
                </a>
              </>
            )}
          </div>
        ) : null}
      </section>

      {error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {blockedCheckoutUrl ? (
        <div role="status" className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          O navegador bloqueou a nova aba.{" "}
          <a href={blockedCheckoutUrl} target="_blank" rel="noopener noreferrer" className="font-semibold underline" onClick={() => setBlockedCheckoutUrl(null)}>
            Abrir o pagamento
          </a>{" "}
          — esta página continua aberta e atualiza o saldo sozinha.
        </div>
      ) : null}
      {notice ? (
        <p role="status" className="rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-800">
          {notice}
        </p>
      ) : null}

      <section>
        <h2 className="text-lg font-semibold text-zinc-900">Comprar créditos</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {packages.map((pkg) => {
            const total = pkg.credits + pkg.bonusCredits;
            return (
              <div key={pkg.code} className="flex flex-col rounded-lg border border-zinc-200 p-4">
                <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">{pkg.name}</p>
                <p className="mt-1 text-xl font-semibold text-zinc-900">{formatCredits(total)}</p>
                {pkg.bonusCredits > 0 ? <p className="text-xs text-teal-800">inclui {formatCredits(pkg.bonusCredits)} de bônus</p> : null}
                {creditsPerShortVideo ? (
                  <p className="text-xs text-zinc-500">≈ {Math.floor(total / creditsPerShortVideo)} vídeos de 5 s (Econômica)</p>
                ) : null}
                <p className="mt-3 text-lg font-medium text-zinc-900">{formatBrlFromCents(pkg.priceCents)}</p>
                <Button type="button" className="mt-3 justify-center" disabled={busy} onClick={() => handleBuy(pkg)}>
                  Comprar
                </Button>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          Pagamento por Pix, boleto ou cartão no ambiente seguro do Asaas. Os créditos entram assim que o pagamento é
          confirmado. Créditos são para uso nas ferramentas de IA do Alilu — não podem ser sacados, transferidos ou trocados
          por dinheiro. Compras com créditos ainda não usados podem ser reembolsadas em até {refundWindowDays} dias.
        </p>
      </section>

      {purchases.length > 0 ? (
        <section>
          <h2 className="text-lg font-semibold text-zinc-900">Suas compras</h2>
          <ul className="mt-3 space-y-2">
            {purchases.map((purchase) => (
              <li key={purchase.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-200 px-3 py-2 text-sm">
                <span>
                  {formatDateTime(purchase.createdAt)} · {purchase.packageName} · {formatCredits(purchase.credits)} ·{" "}
                  {formatBrlFromCents(purchase.priceCents)}
                </span>
                <span className="flex items-center gap-2">
                  <Badge tone={PURCHASE_STATUS[purchase.status].tone}>{PURCHASE_STATUS[purchase.status].label}</Badge>
                  {purchase.status === "PENDING" && purchase.invoiceUrl ? (
                    <LinkButton href={purchase.invoiceUrl} variant="ghost" target="_blank" rel="noopener noreferrer">
                      Pagar
                    </LinkButton>
                  ) : null}
                  {purchase.refundable ? (
                    <Button type="button" variant="ghost" disabled={busy} onClick={() => setRefundTarget(purchase)}>
                      Pedir reembolso
                    </Button>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="text-lg font-semibold text-zinc-900">Extrato</h2>
        {transactions.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600">Nenhuma movimentação ainda.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-md border border-zinc-200">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Data</th>
                  <th className="px-3 py-2">Movimentação</th>
                  <th className="px-3 py-2 text-right">Créditos</th>
                  <th className="px-3 py-2 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => {
                  const shown = transaction.type === "CONSUME" ? -Math.abs(transaction.reservedDelta) : transaction.amount;
                  return (
                    <tr key={transaction.id} className="border-t border-zinc-100">
                      <td className="px-3 py-2 text-zinc-600">{formatDateTime(transaction.createdAt)}</td>
                      <td className="px-3 py-2">
                        {CREDIT_TRANSACTION_LABEL[transaction.type]}
                        {transaction.description ? <span className="block text-xs text-zinc-500">{transaction.description}</span> : null}
                      </td>
                      <td className={`px-3 py-2 text-right ${shown < 0 ? "text-red-700" : "text-teal-800"}`}>
                        {transaction.type === "CONSUME" ? `(${shown})` : shown > 0 ? `+${shown}` : shown}
                      </td>
                      <td className="px-3 py-2 text-right text-zinc-700">{transaction.availableAfter}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="px-3 py-2 text-xs text-zinc-500">Valores entre parênteses já tinham saído do saldo na reserva.</p>
          </div>
        )}
      </section>

      <Dialog
        open={checkoutPackage !== null}
        title={`Comprar ${checkoutPackage?.name ?? ""}`}
        onClose={busy ? () => undefined : () => setCheckoutPackage(null)}
        footer={
          <>
            <Button type="button" variant="secondary" disabled={busy} onClick={() => setCheckoutPackage(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={busy || !name.trim() || !cpfCnpj.trim() || !checkoutPackage}
              onClick={() => checkoutPackage && startCheckout(checkoutPackage)}
            >
              {busy ? "Aguarde…" : "Continuar para o pagamento"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-zinc-600">O Asaas exige nome e CPF/CNPJ para emitir a cobrança — pedimos só na primeira compra.</p>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-zinc-700">Nome completo</span>
            <input value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-zinc-700">CPF ou CNPJ</span>
            <input
              value={cpfCnpj}
              inputMode="numeric"
              onChange={(event) => setCpfCnpj(event.target.value)}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-zinc-700">E-mail (recomendado)</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
          </label>
        </div>
      </Dialog>

      <ConfirmDialog
        open={refundTarget !== null}
        title="Pedir reembolso?"
        description={
          refundTarget
            ? `Os ${formatCredits(refundTarget.credits)} desta compra saem do seu saldo agora e ${formatBrlFromCents(refundTarget.priceCents)} são estornados pelo mesmo meio de pagamento.`
            : ""
        }
        confirmLabel="Pedir reembolso"
        destructive
        busy={busy}
        onConfirm={confirmRefund}
        onClose={() => setRefundTarget(null)}
      />
    </div>
  );
}
