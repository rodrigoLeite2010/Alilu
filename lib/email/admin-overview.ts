import "server-only";
import { getDb } from "@/lib/db/client";

/**
 * Métricas do Admin › E-mails. Só números agregados e metadados de envio;
 * o conteúdo da agenda dos usuários nunca aparece aqui, e os e-mails dos
 * destinatários são mascarados.
 */

export interface EmailWindowStats {
  total: number;
  delivered: number;
  inFlight: number;
  failed: number;
  bounced: number;
  complained: number;
  suppressed: number;
}

export interface EmailAdminOverview {
  last24h: EmailWindowStats;
  last7d: EmailWindowStats;
  byType7d: Array<{ type: string; total: number; delivered: number; failed: number }>;
  recentErrors: Array<{ at: string; type: string; status: string; to: string; error: string | null }>;
  suppressions: { total: number; recent: Array<{ email: string; reason: string; at: string }> };
  agenda: { activeEvents: number; usersWithEvents: number; reminders7d: Record<string, number>; pendingReminders: number };
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  return `${local.slice(0, 2)}***@${domain}`;
}

const FAILED = ["ERROR", "FAILED"];

async function windowStats(hours: number): Promise<EmailWindowStats> {
  const db = getDb();
  const since = new Date(Date.now() - hours * 3600_000);
  const rows = await db`
    select status, count(*)::int as total from email_delivery_logs where created_at >= ${since} group by status
  `;
  const by = new Map(rows.map((row) => [row.status as string, Number(row.total)]));
  const sum = (statuses: string[]) => statuses.reduce((acc, status) => acc + (by.get(status) ?? 0), 0);
  return {
    total: [...by.values()].reduce((acc, value) => acc + value, 0),
    delivered: sum(["DELIVERED"]),
    inFlight: sum(["SENDING", "QUEUED", "SENT", "DELAYED"]),
    failed: sum(FAILED),
    bounced: sum(["BOUNCED"]),
    complained: sum(["COMPLAINED"]),
    suppressed: sum(["SUPPRESSED"]),
  };
}

export async function getEmailAdminOverview(): Promise<EmailAdminOverview> {
  const db = getDb();
  const since7d = new Date(Date.now() - 7 * 86_400_000);
  const [last24h, last7d, byType, errors, suppressionCount, suppressionRows, agendaEvents, reminderRows, pending] = await Promise.all([
    windowStats(24),
    windowStats(24 * 7),
    db`
      select email_type,
        count(*)::int as total,
        count(*) filter (where status = 'DELIVERED')::int as delivered,
        count(*) filter (where status in ('ERROR', 'FAILED', 'BOUNCED', 'COMPLAINED'))::int as failed
      from email_delivery_logs where created_at >= ${since7d} group by email_type order by email_type
    `,
    db`
      select created_at, email_type, status, to_email, error_message from email_delivery_logs
      where status in ('ERROR', 'FAILED', 'BOUNCED', 'COMPLAINED', 'SUPPRESSED')
      order by created_at desc limit 15
    `,
    db`select count(*)::int as total from email_suppressions`,
    db`select email, reason, last_event_at from email_suppressions order by last_event_at desc limit 10`,
    db`select count(*)::int as events, count(distinct user_id)::int as users from agenda_events where deleted_at is null and status = 'SCHEDULED'`,
    db`select status, count(*)::int as total from agenda_reminders where remind_at >= ${since7d} and remind_at <= now() group by status`,
    db`select count(*)::int as total from agenda_reminders where status in ('PENDING', 'SENDING')`,
  ]);
  return {
    last24h,
    last7d,
    byType7d: byType.map((row) => ({ type: row.email_type as string, total: Number(row.total), delivered: Number(row.delivered), failed: Number(row.failed) })),
    recentErrors: errors.map((row) => ({
      at: new Date(row.created_at as string).toISOString(),
      type: row.email_type as string,
      status: row.status as string,
      to: maskEmail(row.to_email as string),
      error: (row.error_message as string | null)?.slice(0, 200) ?? null,
    })),
    suppressions: {
      total: Number(suppressionCount[0]?.total ?? 0),
      recent: suppressionRows.map((row) => ({ email: maskEmail(row.email as string), reason: row.reason as string, at: new Date(row.last_event_at as string).toISOString() })),
    },
    agenda: {
      activeEvents: Number(agendaEvents[0]?.events ?? 0),
      usersWithEvents: Number(agendaEvents[0]?.users ?? 0),
      reminders7d: Object.fromEntries(reminderRows.map((row) => [row.status as string, Number(row.total)])),
      pendingReminders: Number(pending[0]?.total ?? 0),
    },
  };
}
