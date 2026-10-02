import "server-only";
import { getDb } from "@/lib/db/client";
import type { Recurrence } from "../time";
import type { AgendaCategory, AgendaStatus } from "../types";

/** SQL da Agenda — toda leitura/escrita filtrada pelo dono (user_id da sessão). */

export interface AgendaEventRecord {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  startAt: Date;
  endAt: Date | null;
  isAllDay: boolean;
  timezone: string;
  category: AgendaCategory;
  location: string | null;
  status: AgendaStatus;
  recurrence: Recurrence;
  reminderOffsets: number[];
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  cancelledAt: Date | null;
}

function offsets(value: unknown): number[] {
  if (Array.isArray(value)) return value.map(Number).filter(Number.isFinite);
  if (typeof value === "string") return value.replace(/[{}]/g, "").split(",").filter(Boolean).map(Number);
  return [];
}

const date = (value: unknown) => (value ? new Date(value as string) : null);

function map(row: Record<string, unknown>): AgendaEventRecord {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    title: row.title as string,
    description: (row.description as string | null) ?? null,
    startAt: new Date(row.start_at as string),
    endAt: date(row.end_at),
    isAllDay: Boolean(row.is_all_day),
    timezone: row.timezone as string,
    category: row.category as AgendaCategory,
    location: (row.location as string | null) ?? null,
    status: row.status as AgendaStatus,
    recurrence: row.recurrence as Recurrence,
    reminderOffsets: offsets(row.reminder_offsets).sort((a, b) => b - a),
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
    completedAt: date(row.completed_at),
    cancelledAt: date(row.cancelled_at),
  };
}

/** Postgres int[] literal ("{60,1440}") — o driver HTTP aceita texto. */
const intArray = (values: number[]) => `{${values.map((value) => Math.round(value)).join(",")}}`;

export interface EventWrite {
  title: string;
  description: string | null;
  startAt: Date;
  endAt: Date | null;
  isAllDay: boolean;
  timezone: string;
  category: AgendaCategory;
  location: string | null;
  recurrence: Recurrence;
  reminderOffsets: number[];
}

export async function insertEvent(userId: string, input: EventWrite): Promise<AgendaEventRecord> {
  const db = getDb();
  const rows = await db`
    insert into agenda_events (user_id, title, description, start_at, end_at, is_all_day, timezone, category, location, recurrence, reminder_offsets)
    values (${userId}, ${input.title}, ${input.description}, ${input.startAt.toISOString()}, ${input.endAt?.toISOString() ?? null},
      ${input.isAllDay}, ${input.timezone}, ${input.category}, ${input.location}, ${input.recurrence}, ${intArray(input.reminderOffsets)}::int[])
    returning *
  `;
  return map(rows[0]);
}

export async function updateEvent(id: string, userId: string, input: EventWrite): Promise<AgendaEventRecord | null> {
  const db = getDb();
  const rows = await db`
    update agenda_events set
      title = ${input.title}, description = ${input.description}, start_at = ${input.startAt.toISOString()},
      end_at = ${input.endAt?.toISOString() ?? null}, is_all_day = ${input.isAllDay}, timezone = ${input.timezone},
      category = ${input.category}, location = ${input.location}, recurrence = ${input.recurrence},
      reminder_offsets = ${intArray(input.reminderOffsets)}::int[], updated_at = now()
    where id = ${id} and user_id = ${userId} and deleted_at is null
    returning *
  `;
  return rows[0] ? map(rows[0]) : null;
}

export async function setEventStatus(id: string, userId: string, status: AgendaStatus): Promise<AgendaEventRecord | null> {
  const db = getDb();
  const rows = await db`
    update agenda_events set status = ${status}, updated_at = now(),
      completed_at = case when ${status} = 'COMPLETED' then now() else null end,
      cancelled_at = case when ${status} = 'CANCELLED' then now() else null end
    where id = ${id} and user_id = ${userId} and deleted_at is null
    returning *
  `;
  return rows[0] ? map(rows[0]) : null;
}

export async function softDeleteEvent(id: string, userId: string): Promise<boolean> {
  const db = getDb();
  const rows = await db`
    update agenda_events set deleted_at = now(), updated_at = now()
    where id = ${id} and user_id = ${userId} and deleted_at is null returning id
  `;
  return rows.length > 0;
}

export async function getEventForUser(id: string, userId: string): Promise<AgendaEventRecord | null> {
  const db = getDb();
  const rows = await db`select * from agenda_events where id = ${id} and user_id = ${userId} and deleted_at is null`;
  return rows[0] ? map(rows[0]) : null;
}

export async function getEventById(id: string): Promise<(AgendaEventRecord & { deleted: boolean }) | null> {
  const db = getDb();
  const rows = await db`select * from agenda_events where id = ${id}`;
  return rows[0] ? { ...map(rows[0]), deleted: rows[0].deleted_at !== null } : null;
}

/**
 * Eventos que PODEM ter ocorrência em [from, to): não recorrentes no
 * intervalo + recorrentes que começaram antes de `to`. Busca opcional por
 * título/descrição/local e filtro por categoria.
 */
export async function listEventsForRange(
  userId: string,
  from: Date,
  to: Date,
  filters: { q?: string | null; category?: string | null } = {},
): Promise<AgendaEventRecord[]> {
  const db = getDb();
  const q = filters.q?.trim() ? `%${filters.q.trim().replace(/[%_\\]/g, (c) => `\\${c}`)}%` : null;
  const rows = await db`
    select * from agenda_events
    where user_id = ${userId} and deleted_at is null
      and (
        (recurrence = 'NONE' and start_at >= ${from.toISOString()} and start_at < ${to.toISOString()})
        or (recurrence <> 'NONE' and start_at < ${to.toISOString()})
      )
      and (${q}::text is null or title ilike ${q} or coalesce(description, '') ilike ${q} or coalesce(location, '') ilike ${q})
      and (${filters.category ?? null}::text is null or category = ${filters.category ?? null})
    order by start_at
    limit 1000
  `;
  return rows.map(map);
}

// ---------------------------------------------------------------------------
// Preferências
// ---------------------------------------------------------------------------

export interface AgendaPreferences {
  timezone: string;
  defaultReminderMinutes: number | null;
  emailRemindersEnabled: boolean;
}

export async function getPreferences(userId: string): Promise<AgendaPreferences | null> {
  const db = getDb();
  const rows = await db`select * from agenda_preferences where user_id = ${userId}`;
  const row = rows[0];
  if (!row) return null;
  return {
    timezone: row.timezone as string,
    defaultReminderMinutes: row.default_reminder_minutes === null ? null : Number(row.default_reminder_minutes),
    emailRemindersEnabled: Boolean(row.email_reminders_enabled),
  };
}

export async function savePreferences(userId: string, prefs: AgendaPreferences): Promise<void> {
  const db = getDb();
  await db`
    insert into agenda_preferences (user_id, timezone, default_reminder_minutes, email_reminders_enabled, updated_at)
    values (${userId}, ${prefs.timezone}, ${prefs.defaultReminderMinutes}, ${prefs.emailRemindersEnabled}, now())
    on conflict (user_id) do update set timezone = excluded.timezone, default_reminder_minutes = excluded.default_reminder_minutes,
      email_reminders_enabled = excluded.email_reminders_enabled, updated_at = now()
  `;
}

// ---------------------------------------------------------------------------
// Lembretes
// ---------------------------------------------------------------------------

export interface ReminderRecord {
  id: string;
  eventId: string;
  userId: string;
  occurrenceStartAt: Date;
  offsetMinutes: number;
  remindAt: Date;
  channel: string;
  status: string;
  attemptCount: number;
  lockToken: string | null;
}

function mapReminder(row: Record<string, unknown>): ReminderRecord {
  return {
    id: row.id as string,
    eventId: row.event_id as string,
    userId: row.user_id as string,
    occurrenceStartAt: new Date(row.occurrence_start_at as string),
    offsetMinutes: Number(row.offset_minutes),
    remindAt: new Date(row.remind_at as string),
    channel: row.channel as string,
    status: row.status as string,
    attemptCount: Number(row.attempt_count),
    lockToken: (row.lock_token as string | null) ?? null,
  };
}

/** Cria (se ainda não existir — chave única) um lembrete pendente. */
export async function insertReminderOnce(input: {
  eventId: string;
  userId: string;
  occurrenceStartAt: Date;
  offsetMinutes: number;
  remindAt: Date;
}): Promise<void> {
  const db = getDb();
  await db`
    insert into agenda_reminders (event_id, user_id, occurrence_start_at, offset_minutes, remind_at, next_attempt_at)
    values (${input.eventId}, ${input.userId}, ${input.occurrenceStartAt.toISOString()}, ${input.offsetMinutes},
      ${input.remindAt.toISOString()}, ${input.remindAt.toISOString()})
    on conflict (event_id, occurrence_start_at, offset_minutes, channel) do nothing
  `;
}

/** Ao editar: remove os pendentes ainda não iniciados (os já enviados ficam no histórico). */
/** Antes de recalcular: tira os pendentes e os cancelados (reabrir/editar recria). Enviados ficam — nunca reenvia. */
export async function deletePendingReminders(eventId: string): Promise<void> {
  const db = getDb();
  await db`delete from agenda_reminders where event_id = ${eventId} and status in ('PENDING', 'CANCELLED')`;
}

export async function cancelPendingReminders(eventId: string): Promise<void> {
  const db = getDb();
  await db`update agenda_reminders set status = 'CANCELLED' where event_id = ${eventId} and status = 'PENDING'`;
}

export const REMINDER_LOCK_SECONDS = 120;

/** Claim atômico dos lembretes vencidos (dois crons ao mesmo tempo nunca pegam o mesmo). */
export async function claimDueReminders(now: Date, lockToken: string, limit: number): Promise<ReminderRecord[]> {
  const db = getDb();
  const rows = await db`
    update agenda_reminders set status = 'SENDING', lock_token = ${lockToken},
      lock_expires_at = ${new Date(now.getTime() + REMINDER_LOCK_SECONDS * 1000).toISOString()},
      attempt_count = attempt_count + 1
    where id in (
      select id from agenda_reminders
      where (status = 'PENDING' and coalesce(next_attempt_at, remind_at) <= ${now.toISOString()})
         or (status = 'SENDING' and lock_expires_at < ${now.toISOString()})
      order by remind_at
      limit ${limit}
      for update skip locked
    )
    returning *
  `;
  return rows.map(mapReminder);
}

export async function finishReminder(
  id: string,
  lockToken: string,
  patch: { status: "SENT" | "PENDING" | "FAILED" | "CANCELLED" | "SKIPPED"; providerMessageId?: string | null; lastError?: string | null; nextAttemptAt?: Date | null },
): Promise<boolean> {
  const db = getDb();
  const rows = await db`
    update agenda_reminders set status = ${patch.status},
      provider_message_id = coalesce(${patch.providerMessageId ?? null}, provider_message_id),
      last_error = ${patch.lastError ?? null},
      next_attempt_at = ${patch.nextAttemptAt ? patch.nextAttemptAt.toISOString() : null},
      sent_at = case when ${patch.status} = 'SENT' then now() else sent_at end,
      lock_token = null, lock_expires_at = null
    where id = ${id} and lock_token = ${lockToken}
    returning id
  `;
  return rows.length > 0;
}

export async function listRemindersForEvent(eventId: string): Promise<ReminderRecord[]> {
  const db = getDb();
  const rows = await db`select * from agenda_reminders where event_id = ${eventId} order by remind_at`;
  return rows.map(mapReminder);
}

/** Recorrentes ativos sem lembrete pendente (para agendar a próxima ocorrência). */
export async function listRecurringWithoutPending(limit: number): Promise<AgendaEventRecord[]> {
  const db = getDb();
  const rows = await db`
    select e.* from agenda_events e
    where e.deleted_at is null and e.status = 'SCHEDULED' and e.recurrence <> 'NONE' and cardinality(e.reminder_offsets) > 0
      and not exists (select 1 from agenda_reminders r where r.event_id = e.id and r.status in ('PENDING', 'SENDING'))
    limit ${limit}
  `;
  return rows.map(map);
}
