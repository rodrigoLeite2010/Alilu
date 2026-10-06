"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/instagram/ConfirmDialog";
import { PLAN_CODES, PLAN_DEFINITIONS } from "@/lib/billing/plans";

type ActionKey = "adjust-credits" | "grant-plan" | "end-plan" | "extend-trial" | "disable" | "enable";

interface Pending {
  key: ActionKey;
  title: string;
  description: string;
  confirmLabel: string;
  destructive: boolean;
  payload: Record<string, unknown>;
}

const inputClass = "min-h-10 w-full rounded-md border border-zinc-300 px-3 text-sm";

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-zinc-200 p-4">
      <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
      {hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs text-zinc-500">{label}</span>
      {children}
    </label>
  );
}

function Submit({ children, tone = "default", disabled }: { children: React.ReactNode; tone?: "default" | "danger"; disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className={`min-h-10 rounded-md px-4 text-sm font-semibold text-white disabled:opacity-50 ${tone === "danger" ? "bg-red-700" : "bg-zinc-900"}`}
    >
      {children}
    </button>
  );
}

/** Ações manuais do admin sobre um cliente. Toda ação pede confirmação e exige motivo (vai para o histórico). */
export function UserAdminActions({
  userId,
  email,
  disabled,
  isAdmin,
  hasPaidSubscription,
  hasPlan,
  canExtendTrial,
}: {
  userId: string;
  email: string;
  disabled: boolean;
  isAdmin: boolean;
  /** Assinatura paga (Asaas) em andamento: cortesia só depois de cancelar. */
  hasPaidSubscription: boolean;
  /** Existe plano/assinatura em andamento que pode ser encerrado. */
  hasPlan: boolean;
  canExtendTrial: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const [credits, setCredits] = useState("");
  const [creditsReason, setCreditsReason] = useState("");
  const [planCode, setPlanCode] = useState<string>(PLAN_CODES[1] ?? PLAN_CODES[0]);
  const [days, setDays] = useState("30");
  const [note, setNote] = useState("");
  const [immediate, setImmediate] = useState(false);
  const [endReason, setEndReason] = useState("");
  const [trialDays, setTrialDays] = useState("7");
  const [trialReason, setTrialReason] = useState("");
  const [statusReason, setStatusReason] = useState("");

  async function run() {
    if (!pending) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: pending.key, ...pending.payload }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setMessage({ type: "error", text: data.error ?? "Não foi possível concluir a ação." });
      } else {
        setMessage({ type: "ok", text: "Pronto — ação registrada no histórico." });
        router.refresh();
      }
    } catch {
      setMessage({ type: "error", text: "Sem conexão. Tente novamente." });
    } finally {
      setBusy(false);
      setPending(null);
    }
  }

  const creditsNumber = Number(credits);
  const planName = PLAN_DEFINITIONS[planCode as keyof typeof PLAN_DEFINITIONS]?.name ?? planCode;

  return (
    <div className="space-y-4">
      {message ? (
        <p
          role="status"
          className={`rounded-md border p-3 text-sm ${message.type === "ok" ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-red-300 bg-red-50 text-red-900"}`}
        >
          {message.text}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Créditos de IA" hint="Positivo dá créditos; negativo retira (nunca deixa o saldo abaixo de zero).">
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (!Number.isInteger(creditsNumber) || creditsNumber === 0) {
                setMessage({ type: "error", text: "Informe uma quantidade inteira diferente de zero." });
                return;
              }
              setPending({
                key: "adjust-credits",
                title: creditsNumber > 0 ? `Dar ${creditsNumber} créditos?` : `Retirar ${Math.abs(creditsNumber)} créditos?`,
                description: `Cliente: ${email}. Motivo: ${creditsReason || "(sem motivo)"}.`,
                confirmLabel: creditsNumber > 0 ? "Dar créditos" : "Retirar créditos",
                destructive: creditsNumber < 0,
                payload: { credits: creditsNumber, reason: creditsReason },
              });
            }}
          >
            <Field label="Créditos (ex.: 100 ou -50)">
              <input value={credits} onChange={(e) => setCredits(e.target.value)} inputMode="numeric" className={inputClass} placeholder="100" />
            </Field>
            <Field label="Motivo (fica no histórico)">
              <input value={creditsReason} onChange={(e) => setCreditsReason(e.target.value)} maxLength={300} className={inputClass} placeholder="ex.: compensação por erro" />
            </Field>
            <Submit disabled={busy}>Aplicar</Submit>
          </form>
        </Card>

        <Card
          title="Conceder plano (cortesia)"
          hint={
            hasPaidSubscription
              ? "Este cliente tem assinatura paga em andamento — cancele a assinatura antes de conceder cortesia."
              : "O cliente usa o plano sem cobrança até a data. Termina sozinho no vencimento."
          }
        >
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              setPending({
                key: "grant-plan",
                title: `Conceder plano ${planName} por ${days} dias?`,
                description: `Cliente: ${email}. Sem cobrança. Motivo: ${note || "(sem motivo)"}.`,
                confirmLabel: "Conceder plano",
                destructive: false,
                payload: { planCode, days: Number(days), note },
              });
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <Field label="Plano">
                <select value={planCode} onChange={(e) => setPlanCode(e.target.value)} className={inputClass}>
                  {PLAN_CODES.map((code) => (
                    <option key={code} value={code}>
                      {PLAN_DEFINITIONS[code].name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Dias">
                <input value={days} onChange={(e) => setDays(e.target.value)} inputMode="numeric" className={inputClass} />
              </Field>
            </div>
            <Field label="Motivo (fica no histórico)">
              <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} className={inputClass} placeholder="ex.: parceiro / influenciador" />
            </Field>
            <Submit disabled={busy || hasPaidSubscription}>Conceder</Submit>
          </form>
        </Card>

        <Card
          title="Encerrar plano / assinatura"
          hint="Cortesia termina agora. Assinatura paga é cancelada no Asaas (sem novas cobranças); marque “agora” para também cortar o acesso já."
        >
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              setPending({
                key: "end-plan",
                title: "Encerrar o plano deste cliente?",
                description: `Cliente: ${email}. ${immediate ? "O acesso termina agora." : "Cortesia termina agora; assinatura paga mantém o acesso até o fim do período já pago."} Motivo: ${endReason || "(sem motivo)"}.`,
                confirmLabel: "Encerrar plano",
                destructive: true,
                payload: { immediate, reason: endReason },
              });
            }}
          >
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={immediate} onChange={(e) => setImmediate(e.target.checked)} />
              Cortar o acesso agora (não esperar o fim do período pago)
            </label>
            <Field label="Motivo (fica no histórico)">
              <input value={endReason} onChange={(e) => setEndReason(e.target.value)} maxLength={300} className={inputClass} />
            </Field>
            <Submit tone="danger" disabled={busy || !hasPlan}>
              Encerrar plano
            </Submit>
            {!hasPlan ? <p className="text-xs text-zinc-500">Sem plano em andamento.</p> : null}
          </form>
        </Card>

        <Card title="Estender teste grátis" hint="Só para quem está em teste, expirado ou cancelado sem acesso.">
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              setPending({
                key: "extend-trial",
                title: `Estender o teste em ${trialDays} dias?`,
                description: `Cliente: ${email}. Motivo: ${trialReason || "(sem motivo)"}.`,
                confirmLabel: "Estender teste",
                destructive: false,
                payload: { days: Number(trialDays), reason: trialReason },
              });
            }}
          >
            <Field label="Dias">
              <input value={trialDays} onChange={(e) => setTrialDays(e.target.value)} inputMode="numeric" className={inputClass} />
            </Field>
            <Field label="Motivo (fica no histórico)">
              <input value={trialReason} onChange={(e) => setTrialReason(e.target.value)} maxLength={300} className={inputClass} />
            </Field>
            <Submit disabled={busy || !canExtendTrial}>Estender</Submit>
          </form>
        </Card>
      </div>

      <Card
        title={disabled ? "Conta desativada" : "Desativar conta"}
        hint={
          disabled
            ? "Reativar libera o login. As automações continuam pausadas até o cliente ligá-las."
            : "Bloqueia o login na hora, derruba a sessão aberta em segundos e pausa as automações. Nada é apagado."
        }
      >
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            setPending({
              key: disabled ? "enable" : "disable",
              title: disabled ? "Reativar esta conta?" : "Desativar esta conta?",
              description: `Cliente: ${email}. Motivo: ${statusReason || "(sem motivo)"}.`,
              confirmLabel: disabled ? "Reativar conta" : "Desativar conta",
              destructive: !disabled,
              payload: { reason: statusReason },
            });
          }}
        >
          <Field label={disabled ? "Observação (opcional)" : "Motivo (obrigatório, fica no histórico)"}>
            <input value={statusReason} onChange={(e) => setStatusReason(e.target.value)} maxLength={300} className={inputClass} />
          </Field>
          <Submit tone={disabled ? "default" : "danger"} disabled={busy || (!disabled && isAdmin)}>
            {disabled ? "Reativar conta" : "Desativar conta"}
          </Submit>
          {isAdmin && !disabled ? <p className="text-xs text-zinc-500">Contas de administrador não podem ser desativadas por aqui.</p> : null}
        </form>
      </Card>

      <ConfirmDialog
        open={pending !== null}
        title={pending?.title ?? ""}
        description={pending?.description}
        confirmLabel={pending?.confirmLabel ?? "Confirmar"}
        destructive={pending?.destructive ?? false}
        busy={busy}
        onConfirm={run}
        onClose={() => setPending(null)}
      />
    </div>
  );
}
