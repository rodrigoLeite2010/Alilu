import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { EmailAdminTestButton } from "@/components/email/EmailAdminTestButton";
import { getAdminSession } from "@/lib/admin/admin-access";
import { getEmailAdminOverview, type EmailWindowStats } from "@/lib/email/admin-overview";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin · E-mails", robots: { index: false, follow: false } };

const TYPE_LABEL: Record<string, string> = {
  LOGIN_CODE: "Código de login",
  AGENDA_REMINDER: "Lembrete da agenda",
  AGENDA_CHANGED: "Agenda alterada",
  AGENDA_CANCELLED: "Agenda cancelada",
  ADMIN_TEST: "Teste do admin",
};

function Stats({ title, stats }: { title: string; stats: EmailWindowStats }) {
  const cells: Array<[string, number, string]> = [
    ["Enviados", stats.total, "text-zinc-900"],
    ["Entregues", stats.delivered, "text-green-700"],
    ["Em trânsito", stats.inFlight, "text-zinc-700"],
    ["Falhas", stats.failed, "text-red-700"],
    ["Bounces", stats.bounced, "text-amber-700"],
    ["Spam", stats.complained, "text-amber-700"],
    ["Suprimidos", stats.suppressed, "text-zinc-500"],
  ];
  return (
    <section className="mt-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">{title}</h2>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {cells.map(([label, value, color]) => (
          <div key={label} className="rounded-lg border border-zinc-200 bg-white p-3">
            <p className="text-xs text-zinc-500">{label}</p>
            <p className={`text-xl font-semibold ${color}`}>{value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const dateFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

/** Admin › E-mails: saúde do envio transacional (Resend) e números agregados da Agenda. */
export default async function AdminEmailsPage() {
  if (!(await getAdminSession())) notFound();
  const overview = await getEmailAdminOverview();
  const configured = Boolean(process.env.RESEND_API_KEY) && Boolean(process.env.EMAIL_FROM || process.env.RESEND_FROM_EMAIL);
  const webhookConfigured = Boolean(process.env.RESEND_WEBHOOK_SECRET);
  return (
    <Container className="max-w-5xl py-10">
      <h1 className="text-2xl font-semibold text-zinc-900">E-mails (Resend)</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Envio: {configured ? <strong className="text-green-700">configurado</strong> : <strong className="text-red-700">faltam variáveis</strong>} · Webhook:{" "}
        {webhookConfigured ? <strong className="text-green-700">configurado</strong> : <strong className="text-amber-700">sem RESEND_WEBHOOK_SECRET</strong>}
      </p>
      <div className="mt-4">
        <EmailAdminTestButton />
      </div>

      <Stats title="Últimas 24 horas" stats={overview.last24h} />
      <Stats title="Últimos 7 dias" stats={overview.last7d} />

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Por tipo (7 dias)</h2>
        <table className="mt-2 w-full text-left text-sm">
          <thead className="text-zinc-500">
            <tr>
              <th className="py-1">Tipo</th>
              <th>Total</th>
              <th>Entregues</th>
              <th>Falhas</th>
            </tr>
          </thead>
          <tbody>
            {overview.byType7d.map((row) => (
              <tr key={row.type} className="border-t border-zinc-100">
                <td className="py-1.5">{TYPE_LABEL[row.type] ?? row.type}</td>
                <td>{row.total}</td>
                <td>{row.delivered}</td>
                <td>{row.failed}</td>
              </tr>
            ))}
            {!overview.byType7d.length ? (
              <tr>
                <td colSpan={4} className="py-2 text-zinc-500">
                  Nenhum envio nos últimos 7 dias.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Últimos erros</h2>
        <ul className="mt-2 divide-y divide-zinc-100 text-sm">
          {overview.recentErrors.map((row, index) => (
            <li key={index} className="py-2">
              <span className="text-zinc-500">{dateFmt.format(new Date(row.at))}</span> · {TYPE_LABEL[row.type] ?? row.type} · <strong>{row.status}</strong> · {row.to}
              {row.error ? <span className="block text-xs text-zinc-500">{row.error}</span> : null}
            </li>
          ))}
          {!overview.recentErrors.length ? <li className="py-2 text-zinc-500">Nenhum erro registrado.</li> : null}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Supressões ({overview.suppressions.total})</h2>
        <p className="mt-1 text-xs text-zinc-500">Endereços com bounce permanente, spam ou bounces repetidos não recebem lembretes (o código de login continua sendo enviado).</p>
        <ul className="mt-2 divide-y divide-zinc-100 text-sm">
          {overview.suppressions.recent.map((row) => (
            <li key={row.email + row.at} className="py-2">
              {row.email} · {row.reason} · <span className="text-zinc-500">{dateFmt.format(new Date(row.at))}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Agenda (só números agregados)</h2>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-lg border border-zinc-200 bg-white p-3">
            <p className="text-xs text-zinc-500">Compromissos ativos</p>
            <p className="text-xl font-semibold">{overview.agenda.activeEvents}</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-3">
            <p className="text-xs text-zinc-500">Usuários com agenda</p>
            <p className="text-xl font-semibold">{overview.agenda.usersWithEvents}</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-3">
            <p className="text-xs text-zinc-500">Lembretes na fila</p>
            <p className="text-xl font-semibold">{overview.agenda.pendingReminders}</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-3">
            <p className="text-xs text-zinc-500">Lembretes 7 dias (enviados / falhas / pulados)</p>
            <p className="text-xl font-semibold">
              {overview.agenda.reminders7d.SENT ?? 0} / {overview.agenda.reminders7d.FAILED ?? 0} / {overview.agenda.reminders7d.SKIPPED ?? 0}
            </p>
          </div>
        </div>
      </section>
    </Container>
  );
}
