import "server-only";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db/client";
import { SITE_URL } from "@/lib/seo/site";
import { nextOccurrence, reminderBase, whenLabel } from "../time";
import {
  cancelPendingReminders,
  claimDueReminders,
  deletePendingReminders,
  finishReminder,
  getEventById,
  getPreferences,
  insertReminderOnce,
  listRecurringWithoutPending,
  type AgendaEventRecord,
  type ReminderRecord,
} from "./agenda-repository";
import { getReminderSender } from "./reminder-channels";

/**
 * Lembretes da Agenda:
 *   - cada compromisso tem 0..N lembretes (minutos antes); só a PRÓXIMA
 *     ocorrência tem lembretes criados (recorrentes: depois de enviar, o
 *     cron agenda a ocorrência seguinte);
 *   - cron a cada 1 min: claim atômico (FOR UPDATE SKIP LOCKED + lock com
 *     validade) → envia → SENT; falha temporária: tenta de novo em 1, 5 e
 *     15 min; depois FAILED. Duplicidade impossível: claim + chave única
 *     (evento, ocorrência, minutos, canal) + Idempotency-Key na Resend.
 *   - lembrete que perdeu a hora (cron fora do ar) depois que o compromisso
 *     já começou é marcado SKIPPED — não faz sentido avisar depois.
 */

export const REMINDER_RETRY_DELAYS_MINUTES = [1, 5, 15];
export const REMINDER_MAX_ATTEMPTS = 1 + REMINDER_RETRY_DELAYS_MINUTES.length;

/** Cria os lembretes da próxima ocorrência que ainda tem algum aviso no futuro. */
export async function ensureUpcomingReminders(event: AgendaEventRecord, now: Date): Promise<number> {
  if (event.status !== "SCHEDULED" || event.reminderOffsets.length === 0) return 0;
  let from = now;
  for (let guard = 0; guard < 10; guard += 1) {
    const occurrence = nextOccurrence(event.startAt, event.recurrence, from, event.timezone);
    if (!occurrence) return 0;
    const base = reminderBase(occurrence, event.isAllDay, event.timezone);
    const future = event.reminderOffsets
      .map((offset) => ({ offset, remindAt: new Date(base.getTime() - offset * 60_000) }))
      .filter((item) => item.remindAt.getTime() > now.getTime());
    if (future.length > 0) {
      for (const item of future) {
        await insertReminderOnce({ eventId: event.id, userId: event.userId, occurrenceStartAt: occurrence, offsetMinutes: item.offset, remindAt: item.remindAt });
      }
      return future.length;
    }
    if (event.recurrence === "NONE") return 0;
    from = new Date(occurrence.getTime() + 60_000);
  }
  return 0;
}

/** Ao criar/editar: apaga os pendentes e recria a partir do horário novo. */
export async function rescheduleEventReminders(event: AgendaEventRecord, now: Date): Promise<void> {
  await deletePendingReminders(event.id);
  await ensureUpcomingReminders(event, now);
}

export async function cancelEventReminders(eventId: string): Promise<void> {
  await cancelPendingReminders(eventId);
}

async function loadUser(userId: string): Promise<{ email: string; name: string | null } | null> {
  const db = getDb();
  const rows = await db`select email, name from users where id = ${userId}`;
  return rows[0] ? { email: rows[0].email as string, name: (rows[0].name as string | null) ?? null } : null;
}

function firstName(name: string | null): string | null {
  const first = name?.trim().split(/\s+/)[0];
  return first ? first.slice(0, 40) : null;
}

async function processReminder(reminder: ReminderRecord, lockToken: string, now: Date): Promise<"SENT" | "RETRY" | "FAILED" | "SKIPPED" | "CANCELLED"> {
  const log = (status: string, extra: Record<string, unknown> = {}) =>
    console.info(
      JSON.stringify({ scope: "agenda", event: "reminder", reminderId: reminder.id, agendaEventId: reminder.eventId, scheduledAt: reminder.remindAt.toISOString(), attemptCount: reminder.attemptCount, status, ...extra }),
    );

  const event = await getEventById(reminder.eventId);
  if (!event || event.deleted || event.status !== "SCHEDULED") {
    await finishReminder(reminder.id, lockToken, { status: "CANCELLED", lastError: "compromisso cancelado/excluído" });
    log("CANCELLED");
    return "CANCELLED";
  }
  const lateLimit = event.isAllDay ? reminder.occurrenceStartAt.getTime() + 86_400_000 : reminder.occurrenceStartAt.getTime();
  if (now.getTime() >= lateLimit) {
    await finishReminder(reminder.id, lockToken, { status: "SKIPPED", lastError: "perdeu a hora (o compromisso já começou)" });
    log("SKIPPED", { reason: "late" });
    return "SKIPPED";
  }
  const prefs = await getPreferences(event.userId);
  if (prefs && !prefs.emailRemindersEnabled && reminder.channel === "EMAIL") {
    await finishReminder(reminder.id, lockToken, { status: "SKIPPED", lastError: "lembretes por e-mail desligados" });
    log("SKIPPED", { reason: "disabled" });
    return "SKIPPED";
  }
  const user = await loadUser(event.userId);
  const sender = getReminderSender(reminder.channel);
  if (!user || !sender) {
    await finishReminder(reminder.id, lockToken, { status: "FAILED", lastError: !user ? "usuário não encontrado" : "canal indisponível" });
    log("FAILED");
    return "FAILED";
  }

  const tz = prefs?.timezone ?? event.timezone;
  const result = await sender.send({
    reminderId: reminder.id,
    userId: event.userId,
    to: user.email,
    firstName: firstName(user.name),
    title: event.title,
    whenLabel: whenLabel(reminder.occurrenceStartAt, event.isAllDay, tz, now),
    location: event.location,
    url: `${SITE_URL}/agenda?evento=${event.id}`,
  });

  if (result.ok) {
    await finishReminder(reminder.id, lockToken, { status: "SENT", providerMessageId: result.providerMessageId });
    log("SENT", { providerMessageId: result.providerMessageId });
    return "SENT";
  }
  if (result.skipped) {
    await finishReminder(reminder.id, lockToken, { status: "SKIPPED", lastError: "endereço suprimido (bounce/spam)" });
    log("SKIPPED", { reason: "suppressed" });
    return "SKIPPED";
  }
  if (result.retryable && reminder.attemptCount < REMINDER_MAX_ATTEMPTS) {
    const delay = REMINDER_RETRY_DELAYS_MINUTES[Math.min(reminder.attemptCount, REMINDER_RETRY_DELAYS_MINUTES.length) - 1];
    await finishReminder(reminder.id, lockToken, {
      status: "PENDING",
      lastError: result.error,
      nextAttemptAt: new Date(now.getTime() + delay * 60_000),
    });
    log("RETRY", { retryInMinutes: delay });
    return "RETRY";
  }
  await finishReminder(reminder.id, lockToken, { status: "FAILED", lastError: result.error });
  log("FAILED", { error: result.error?.slice(0, 120) });
  return "FAILED";
}

export interface AgendaCronResult {
  claimed: number;
  sent: number;
  retried: number;
  failed: number;
  skipped: number;
  scheduled: number;
}

export async function runAgendaReminderCron(options: { now?: () => Date; limit?: number; budgetMs?: number } = {}): Promise<AgendaCronResult> {
  const now = options.now ?? (() => new Date());
  const budget = options.budgetMs ?? 45_000;
  const started = Date.now();
  const result: AgendaCronResult = { claimed: 0, sent: 0, retried: 0, failed: 0, skipped: 0, scheduled: 0 };

  const lockToken = randomUUID();
  const reminders = await claimDueReminders(now(), lockToken, Math.min(Math.max(options.limit ?? 50, 1), 200));
  result.claimed = reminders.length;
  for (const reminder of reminders) {
    if (Date.now() - started > budget) break; // o lock vence e o próximo ciclo retoma
    try {
      const outcome = await processReminder(reminder, lockToken, now());
      if (outcome === "SENT") result.sent += 1;
      else if (outcome === "RETRY") result.retried += 1;
      else if (outcome === "FAILED") result.failed += 1;
      else result.skipped += 1;
    } catch (error) {
      console.error(JSON.stringify({ scope: "agenda", event: "reminder_crash", reminderId: reminder.id, message: (error as Error)?.message?.slice(0, 200) }));
      await finishReminder(reminder.id, lockToken, {
        status: reminder.attemptCount < REMINDER_MAX_ATTEMPTS ? "PENDING" : "FAILED",
        lastError: "erro interno",
        nextAttemptAt: new Date(now().getTime() + 60_000),
      });
    }
  }

  // Recorrentes: agenda os lembretes da próxima ocorrência.
  if (Date.now() - started < budget) {
    for (const event of await listRecurringWithoutPending(100)) {
      result.scheduled += await ensureUpcomingReminders(event, now());
    }
  }
  return result;
}
