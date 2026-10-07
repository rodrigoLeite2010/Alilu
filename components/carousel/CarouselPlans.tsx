"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { carouselApi, formatBrl, type BillingDto, type PlanOfferDto } from "./carousel-client";

type Action = { kind: "subscribe" | "upgrade" | "downgrade"; plan: PlanOfferDto } | { kind: "cancel" | "reactivate" | "undo" } | null;

export function CarouselPlans({ loggedIn, userName, userEmail }: { loggedIn: boolean; userName: string; userEmail: string }) {
  const [data, setData] = useState<BillingDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<Action>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(userName);
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [email, setEmail] = useState(userEmail);

  useEffect(() => {
    if (!loggedIn) return;
    let active = true;
    carouselApi<BillingDto>("/api/carousel/billing")
      .then((d) => active && setData(d))
      .catch((e: unknown) => active && setError(e instanceof Error ? e.message : "Não foi possível carregar os planos."));
    return () => {
      active = false;
    };
  }, [loggedIn]);

  async function confirm() {
    if (!action) return;
    setBusy(true);
    setError(null);
    try {
      if (action.kind === "subscribe") {
        const r = await carouselApi<{ checkoutUrl: string }>("/api/carousel/billing", { body: { action: "checkout", planCode: action.plan.code, name, cpfCnpj, email: email || undefined } });
        window.location.href = r.checkoutUrl;
        return;
      }
      if (action.kind === "upgrade" || action.kind === "downgrade") {
        const r = await carouselApi<{ kind: string; checkoutUrl?: string }>("/api/carousel/billing", { body: { action: "change-plan", planCode: action.plan.code } });
        if (r.kind === "upgrade" && r.checkoutUrl) {
          window.location.href = r.checkoutUrl;
          return;
        }
      } else {
        await carouselApi("/api/carousel/billing", { body: { action: action.kind === "cancel" ? "cancel" : action.kind === "reactivate" ? "reactivate" : "cancel-plan-change" } });
      }
      setData(await carouselApi<BillingDto>("/api/carousel/billing"));
      setAction(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível concluir agora.");
    } finally {
      setBusy(false);
    }
  }

  const sub = data?.subscription ?? null;
  const paying = sub !== null && (sub.status === "ACTIVE" || sub.status === "PAST_DUE") && !sub.complimentary;
  const currentRank = data?.plans.findIndex((p) => p.current) ?? -1;

  return (
    <div className="space-y-6">
      {data?.existingAliluCustomer && !paying ? (
        <p className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">Você já é cliente Alilu: seus planos abaixo já mostram <strong>10% de desconto</strong> permanente.</p>
      ) : null}
      {sub?.status === "PAST_DUE" ? <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">Seu último pagamento está pendente. Regularize para continuar criando carrosséis.</p> : null}
      {sub?.status === "CANCELED" && sub.currentPeriodEndsAt ? <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800">Assinatura cancelada — o acesso vai até {new Date(sub.currentPeriodEndsAt).toLocaleDateString("pt-BR")}. <button type="button" className="font-medium underline" onClick={() => setAction({ kind: "reactivate" })}>Reativar</button></p> : null}
      {sub?.pendingPlanCode ? <p className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">Troca para o plano {data?.plans.find((p) => p.code === sub.pendingPlanCode)?.name} agendada para o próximo ciclo. <button type="button" className="font-medium underline" onClick={() => setAction({ kind: "undo" })}>Desfazer</button></p> : null}
      {error && !action ? <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</p> : null}

      {!loggedIn ? (
        <p className="text-sm text-zinc-700">
          <a className="font-medium text-brand-primary underline" href="/entrar?callbackUrl=%2Finstagram%2Fcarrossel-inteligente%2Fplanos">Entre na sua conta</a> para assinar. Seu primeiro carrossel é grátis.
        </p>
      ) : null}

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(data?.plans ?? []).map((plan, index) => {
          const discounted = plan.priceCents < plan.listPriceCents;
          return (
            <li key={plan.code} className={`flex flex-col rounded-lg border p-5 ${plan.highlighted ? "border-brand-primary ring-1 ring-brand-primary" : "border-zinc-200"}`}>
              {plan.highlighted ? <span className="mb-2 w-fit rounded-full bg-brand-accent-soft px-2.5 py-1 text-xs font-medium text-brand-accent-dark">Mais escolhido</span> : null}
              <h2 className="text-lg font-semibold text-zinc-900">{plan.name}</h2>
              <p className="mt-2">
                {discounted ? <span className="mr-2 text-sm text-zinc-500 line-through">{formatBrl(plan.listPriceCents)}</span> : null}
                <span className="text-2xl font-bold text-zinc-900">{formatBrl(plan.priceCents)}</span>
                <span className="text-sm text-zinc-600"> /mês</span>
              </p>
              {discounted ? <p className="text-xs font-medium text-teal-800">{plan.discountPercent}% de desconto para clientes Alilu</p> : null}
              <p className="mt-2 text-sm text-zinc-700">{plan.carouselsPerCycle} carrosséis por mês · até {plan.maxProfiles} perfis</p>
              <ul className="mt-3 flex-1 list-disc space-y-1 pl-5 text-sm text-zinc-600">
                {plan.features.slice(0, 7).map((f) => <li key={f}>{f}</li>)}
                {plan.upcoming.map((f) => <li key={f} className="text-zinc-400">{f} (em breve)</li>)}
              </ul>
              <div className="mt-4">
                {plan.current ? <p className="text-center text-sm font-medium text-brand-primary">Seu plano atual</p> : !loggedIn ? null : sub?.complimentary ? <p className="text-center text-xs text-zinc-500">Disponível quando a cortesia terminar.</p> : paying ? (
                  <Button type="button" variant={index > currentRank ? "primary" : "secondary"} className="w-full justify-center" onClick={() => setAction({ kind: index > currentRank ? "upgrade" : "downgrade", plan })}>{index > currentRank ? "Fazer upgrade" : "Mudar para este"}</Button>
                ) : (
                  <Button type="button" className="w-full justify-center" onClick={() => setAction({ kind: "subscribe", plan })}>Assinar</Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {paying ? <p className="text-center text-sm"><button type="button" className="text-zinc-600 underline" onClick={() => setAction({ kind: "cancel" })}>Cancelar assinatura</button></p> : null}

      <Dialog
        open={action !== null}
        title={action?.kind === "subscribe" ? `Assinar ${action.plan.name}` : action?.kind === "upgrade" ? `Upgrade para ${action.plan.name}` : action?.kind === "downgrade" ? `Mudar para ${action.plan.name}` : action?.kind === "cancel" ? "Cancelar assinatura?" : action?.kind === "reactivate" ? "Reativar assinatura" : "Desfazer a troca de plano"}
        onClose={() => (busy ? undefined : (setAction(null), setError(null)))}
        footer={<><Button type="button" variant="secondary" disabled={busy} onClick={() => { setAction(null); setError(null); }}>Voltar</Button><Button type="button" disabled={busy || (action?.kind === "subscribe" && (!name.trim() || !cpfCnpj.trim()))} onClick={() => void confirm()}>{busy ? "Aguarde…" : action?.kind === "subscribe" ? "Ir para o pagamento" : "Confirmar"}</Button></>}
      >
        <div className="space-y-3 text-sm text-zinc-700">
          {action?.kind === "subscribe" ? (
            <>
              <p>{formatBrl(action.plan.priceCents)}/mês{action.plan.discountPercent ? ` (já com ${action.plan.discountPercent}% de desconto)` : ""}. O pagamento é feito no ambiente seguro do Asaas.</p>
              <label className="block">Nome completo<input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 block min-h-11 w-full rounded-md border border-zinc-300 px-3 text-base" autoComplete="name" /></label>
              <label className="block">CPF ou CNPJ<input value={cpfCnpj} onChange={(e) => setCpfCnpj(e.target.value)} inputMode="numeric" className="mt-1 block min-h-11 w-full rounded-md border border-zinc-300 px-3 text-base" /></label>
              <label className="block">E-mail (opcional)<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 block min-h-11 w-full rounded-md border border-zinc-300 px-3 text-base" autoComplete="email" /></label>
            </>
          ) : action?.kind === "upgrade" ? <p>Você paga só a diferença proporcional ao tempo restante do ciclo e a nova cota vale já. O desconto contratado é mantido.</p>
            : action?.kind === "downgrade" ? <p>A troca vale a partir do próximo ciclo; até lá você mantém o plano atual.</p>
            : action?.kind === "cancel" ? <p>Você continua usando até o fim do período já pago. Pode reativar quando quiser.</p>
            : action?.kind === "reactivate" ? <p>A cobrança volta a ser feita normalmente.</p>
            : <p>O plano atual continua no próximo ciclo.</p>}
          {error ? <p className="text-red-700" role="alert">{error}</p> : null}
        </div>
      </Dialog>
    </div>
  );
}
