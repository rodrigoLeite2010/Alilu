import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { UserAdminActions } from "@/components/admin/UserAdminActions";
import { getAdminSession } from "@/lib/admin/admin-access";
import { getUserAdminDetail } from "@/lib/admin/user-admin-service";
import { PLAN_DEFINITIONS, formatPriceBrl } from "@/lib/billing/plans";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin · Cliente", robots: { index: false, follow: false } };

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Ativo",
  PAST_DUE: "Em atraso",
  PENDING_PAYMENT: "Aguardando pagamento",
  CANCELED: "Cancelado",
  TRIAL: "Em teste",
  EXPIRED: "Expirado",
};

const ACTION_LABEL: Record<string, string> = {
  CREDITS_GRANTED: "Créditos concedidos",
  CREDITS_REMOVED: "Créditos retirados",
  PLAN_GRANTED: "Plano de cortesia concedido",
  PLAN_ENDED: "Plano de cortesia encerrado",
  SUBSCRIPTION_CANCELED: "Assinatura cancelada",
  TRIAL_EXTENDED: "Teste estendido",
  USER_DISABLED: "Conta desativada",
  USER_ENABLED: "Conta reativada",
};

function fmt(value: Date | null | undefined, withTime = false): string {
  if (!value) return "—";
  return value.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    ...(withTime ? { timeStyle: "short" } : {}),
  });
}

function detailsText(details: Record<string, unknown>): string {
  return Object.entries(details)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(" · ");
}

/** Teste só pode ser estendido para quem não tem plano em andamento. */
function isTrialExtendable(subscription: Awaited<ReturnType<typeof getUserAdminDetail>> extends infer D ? (D extends { subscription: infer S } ? S : never) : never): boolean {
  if (!subscription) return true;
  if (subscription.status === "TRIAL" || subscription.status === "EXPIRED") return true;
  return subscription.status === "CANCELED" && (!subscription.currentPeriodEndsAt || subscription.currentPeriodEndsAt.getTime() <= Date.now());
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-zinc-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-zinc-900">{value}</dd>
    </div>
  );
}

/** Admin > Cliente: situação completa e ações manuais (créditos, plano de cortesia, encerrar, teste, ativar/desativar). */
export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await getAdminSession())) notFound();
  const { id } = await params;
  const uuid = /^[0-9a-f-]{36}$/i.test(id);
  const detail = uuid ? await getUserAdminDetail(id) : null;
  if (!detail) notFound();

  const { user, subscription } = detail;
  const planName = subscription?.planCode ? PLAN_DEFINITIONS[subscription.planCode]?.name : null;
  const live = subscription && ["ACTIVE", "PAST_DUE", "PENDING_PAYMENT"].includes(subscription.status);
  const paidLive = Boolean(live && !subscription!.complimentary);
  const canExtendTrial = isTrialExtendable(subscription);

  return (
    <Container className="max-w-5xl py-10">
      <Link href="/admin/assinaturas/usuarios" className="text-sm font-medium text-teal-800 hover:underline">
        ← Usuários e planos
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-zinc-900">{user.email}</h1>
        {user.disabledAt ? <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800">Desativado</span> : null}
        {detail.isAdmin ? <span className="rounded-full bg-zinc-200 px-2.5 py-0.5 text-xs font-semibold text-zinc-800">Admin</span> : null}
      </div>
      {user.disabledAt ? (
        <p className="mt-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          Conta desativada em {fmt(user.disabledAt, true)}
          {user.disabledReason ? ` — motivo: ${user.disabledReason}` : ""}.
        </p>
      ) : null}

      <dl className="mt-5 grid grid-cols-2 gap-4 rounded-lg border border-zinc-200 p-4 sm:grid-cols-4">
        <Info label="Nome" value={user.name ?? "—"} />
        <Info label="Cadastro" value={fmt(user.createdAt)} />
        <Info label="Instagram" value={detail.instagramConnected ? "Conectado" : "Não conectado"} />
        <Info label="Automações" value={`${detail.automations.active} ativas de ${detail.automations.total}`} />
        <Info
          label="Plano"
          value={
            subscription && planName
              ? `${planName}${subscription.complimentary ? " (cortesia)" : ` · ${formatPriceBrl(subscription.monthlyPriceCents)}/mês`}`
              : "Sem plano"
          }
        />
        <Info label="Situação" value={subscription ? (STATUS_LABEL[subscription.status] ?? subscription.status) : "Sem assinatura"} />
        <Info
          label={subscription?.status === "TRIAL" ? "Teste até" : subscription?.complimentary ? "Cortesia até" : "Renova / acesso até"}
          value={fmt(subscription?.status === "TRIAL" ? subscription.trialEndsAt : subscription?.currentPeriodEndsAt)}
        />
        <Info label="Créditos" value={`${detail.credits.available.toLocaleString("pt-BR")}${detail.credits.reserved ? ` (+${detail.credits.reserved} reservados)` : ""}`} />
      </dl>
      {subscription?.adminNote ? <p className="mt-2 text-xs text-zinc-500">Nota da cortesia: {subscription.adminNote}</p> : null}

      <h2 className="mt-8 text-base font-semibold text-zinc-900">Ações</h2>
      <div className="mt-3">
        <UserAdminActions
          userId={user.id}
          email={user.email}
          disabled={Boolean(user.disabledAt)}
          isAdmin={detail.isAdmin}
          hasPaidSubscription={paidLive}
          hasPlan={Boolean(live)}
          canExtendTrial={canExtendTrial}
        />
      </div>

      <h2 className="mt-8 text-base font-semibold text-zinc-900">Histórico de ações do admin</h2>
      {detail.audit.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500">Nenhuma ação manual registrada para este cliente.</p>
      ) : (
        <ul className="mt-3 divide-y divide-zinc-100 rounded-md border border-zinc-200 text-sm">
          {detail.audit.map((entry) => (
            <li key={entry.id} className="px-3 py-2">
              <p className="font-medium text-zinc-900">
                {ACTION_LABEL[entry.action] ?? entry.action} <span className="font-normal text-zinc-500">· {fmt(entry.createdAt, true)} · {entry.adminEmail}</span>
              </p>
              <p className="text-xs text-zinc-500">{detailsText(entry.details)}</p>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-8 text-base font-semibold text-zinc-900">Últimas movimentações de créditos</h2>
      {detail.transactions.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500">Sem movimentações.</p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-md border border-zinc-200">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                {["Data", "Tipo", "Créditos", "Saldo", "Descrição"].map((label) => (
                  <th key={label} className="px-3 py-2">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 tabular-nums">
              {detail.transactions.map((tx) => (
                <tr key={tx.id}>
                  <td className="px-3 py-2">{fmt(tx.createdAt, true)}</td>
                  <td className="px-3 py-2">{tx.type}</td>
                  <td className="px-3 py-2">{tx.amount > 0 ? `+${tx.amount}` : tx.amount}</td>
                  <td className="px-3 py-2">{tx.availableAfter}</td>
                  <td className="px-3 py-2 text-zinc-600">{tx.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Container>
  );
}
