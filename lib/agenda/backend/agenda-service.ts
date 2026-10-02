import "server-only";
import {
  DEFAULT_TIMEZONE,
  RECURRENCES,
  isValidTimezone,
  occurrencesBetween,
  parseLocalDateTime,
  type Recurrence,
} from "../time";
import { AGENDA_CATEGORIES, type AgendaCategory, type AgendaEventDto, type AgendaOccurrenceDto, type AgendaPreferencesDto } from "../types";
import {
  getEventForUser,
  getPreferences,
  insertEvent,
  listEventsForRange,
  savePreferences,
  setEventStatus,
  softDeleteEvent,
  updateEvent,
  type AgendaEventRecord,
  type EventWrite,
} from "./agenda-repository";
import { cancelEventReminders, rescheduleEventReminders } from "./reminder-service";

/**
 * Regra da Agenda (independente de e-mail). O usuário vem SEMPRE da
 * sessão — nunca do corpo da requisição. Datas chegam como data/hora
 * LOCAIS ("2026-10-10", "14:30") e são convertidas para UTC no fuso das
 * preferências do usuário.
 */

export class AgendaError extends Error {
  constructor(message: string, readonly httpStatus = 400) {
    super(message);
    this.name = "AgendaError";
  }
}

const MAX_REMINDERS = 5;
const MAX_REMINDER_MINUTES = 40320; // 4 semanas

export async function getUserPreferences(userId: string): Promise<AgendaPreferencesDto> {
  return (await getPreferences(userId)) ?? { timezone: DEFAULT_TIMEZONE, defaultReminderMinutes: 60, emailRemindersEnabled: true };
}

export async function updateUserPreferences(userId: string, input: Record<string, unknown>): Promise<AgendaPreferencesDto> {
  const current = await getUserPreferences(userId);
  const timezone = typeof input.timezone === "string" && isValidTimezone(input.timezone) ? input.timezone : current.timezone;
  const defaultReminderMinutes =
    input.defaultReminderMinutes === null
      ? null
      : input.defaultReminderMinutes === undefined
        ? current.defaultReminderMinutes
        : clampReminder(Number(input.defaultReminderMinutes));
  const emailRemindersEnabled = typeof input.emailRemindersEnabled === "boolean" ? input.emailRemindersEnabled : current.emailRemindersEnabled;
  const prefs = { timezone, defaultReminderMinutes, emailRemindersEnabled };
  await savePreferences(userId, prefs);
  return prefs;
}

function clampReminder(value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > MAX_REMINDER_MINUTES) throw new AgendaError("Lembrete inválido.");
  return value;
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

/** Valida o formulário (cadastro rápido: só título e data são obrigatórios). */
export function parseEventInput(input: Record<string, unknown>, prefs: AgendaPreferencesDto): EventWrite {
  const title = text(input.title, 200);
  if (!title) throw new AgendaError("Informe o título.");
  const timezone = typeof input.timezone === "string" && isValidTimezone(input.timezone) ? input.timezone : prefs.timezone;
  const dateStr = typeof input.date === "string" ? input.date : "";
  const time = typeof input.time === "string" && input.time.trim() ? input.time.trim() : null;
  const startAt = parseLocalDateTime(dateStr, time, timezone);
  if (!startAt) throw new AgendaError("Data ou hora inválida.");
  const isAllDay = time === null;

  let endAt: Date | null = null;
  const endTime = typeof input.endTime === "string" && input.endTime.trim() ? input.endTime.trim() : null;
  if (endTime && !isAllDay) {
    endAt = parseLocalDateTime(dateStr, endTime, timezone);
    if (!endAt || endAt <= startAt) throw new AgendaError("O horário de término precisa ser depois do início.");
  }

  const category = (typeof input.category === "string" ? input.category : "PESSOAL") as AgendaCategory;
  if (!AGENDA_CATEGORIES.includes(category)) throw new AgendaError("Categoria inválida.");
  const recurrence = (typeof input.recurrence === "string" ? input.recurrence : "NONE") as Recurrence;
  if (!RECURRENCES.includes(recurrence)) throw new AgendaError("Recorrência inválida.");

  let reminderOffsets: number[];
  if (Array.isArray(input.reminders)) {
    reminderOffsets = [...new Set(input.reminders.map((value) => clampReminder(Number(value))))];
  } else {
    reminderOffsets = prefs.defaultReminderMinutes === null ? [] : [prefs.defaultReminderMinutes];
  }
  if (reminderOffsets.length > MAX_REMINDERS) throw new AgendaError(`No máximo ${MAX_REMINDERS} lembretes por compromisso.`);

  return {
    title,
    description: text(input.description, 2000),
    startAt,
    endAt,
    isAllDay,
    timezone,
    category,
    location: text(input.location, 300),
    recurrence,
    reminderOffsets: reminderOffsets.sort((a, b) => b - a),
  };
}

export function serializeEvent(event: AgendaEventRecord): AgendaEventDto {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    startAt: event.startAt.toISOString(),
    endAt: event.endAt ? event.endAt.toISOString() : null,
    isAllDay: event.isAllDay,
    timezone: event.timezone,
    category: event.category,
    location: event.location,
    status: event.status,
    recurrence: event.recurrence,
    reminderOffsets: event.reminderOffsets,
  };
}

export async function createAgendaEvent(userId: string, input: Record<string, unknown>, now = new Date()): Promise<AgendaEventRecord> {
  const prefs = await getUserPreferences(userId);
  const event = await insertEvent(userId, parseEventInput(input, prefs));
  await rescheduleEventReminders(event, now);
  console.info(JSON.stringify({ scope: "agenda", event: "created", agendaEventId: event.id, reminders: event.reminderOffsets.length, recurrence: event.recurrence }));
  return event;
}

export async function editAgendaEvent(userId: string, id: string, input: Record<string, unknown>, now = new Date()): Promise<AgendaEventRecord> {
  const current = await getEventForUser(id, userId);
  if (!current) throw new AgendaError("Compromisso não encontrado.", 404);
  const prefs = await getUserPreferences(userId);
  const updated = await updateEvent(id, userId, parseEventInput(input, { ...prefs, timezone: current.timezone }));
  if (!updated) throw new AgendaError("Compromisso não encontrado.", 404);
  // Recalcula só os futuros; os já enviados ficam no histórico e nunca são reenviados.
  if (updated.status === "SCHEDULED") await rescheduleEventReminders(updated, now);
  return updated;
}

export async function changeAgendaStatus(userId: string, id: string, status: "COMPLETED" | "CANCELLED" | "SCHEDULED", now = new Date()): Promise<AgendaEventRecord> {
  const event = await setEventStatus(id, userId, status);
  if (!event) throw new AgendaError("Compromisso não encontrado.", 404);
  if (status === "SCHEDULED") await rescheduleEventReminders(event, now);
  else await cancelEventReminders(event.id);
  return event;
}

export async function deleteAgendaEvent(userId: string, id: string): Promise<void> {
  const event = await getEventForUser(id, userId);
  if (!event) throw new AgendaError("Compromisso não encontrado.", 404);
  await cancelEventReminders(id);
  await softDeleteEvent(id, userId);
}

export async function getAgendaEvent(userId: string, id: string): Promise<AgendaEventRecord> {
  const event = await getEventForUser(id, userId);
  if (!event) throw new AgendaError("Compromisso não encontrado.", 404);
  return event;
}

/** Eventos + ocorrências no intervalo (mês/semana/lista). Cancelados aparecem riscados. */
export async function listAgenda(
  userId: string,
  from: Date,
  to: Date,
  filters: { q?: string | null; category?: string | null } = {},
): Promise<{ events: AgendaEventDto[]; occurrences: AgendaOccurrenceDto[] }> {
  if (!(from < to) || to.getTime() - from.getTime() > 400 * 86_400_000) throw new AgendaError("Período inválido.");
  const events = await listEventsForRange(userId, from, to, filters);
  const occurrences: AgendaOccurrenceDto[] = [];
  for (const event of events) {
    for (const start of occurrencesBetween(event.startAt, event.recurrence, from, to, event.timezone)) {
      occurrences.push({ eventId: event.id, startAt: start.toISOString() });
    }
  }
  occurrences.sort((a, b) => a.startAt.localeCompare(b.startAt));
  const used = new Set(occurrences.map((occurrence) => occurrence.eventId));
  return { events: events.filter((event) => used.has(event.id)).map(serializeEvent), occurrences };
}

/** Próximo compromisso (card da home). */
export async function nextAgendaItem(userId: string, now = new Date()): Promise<{ event: AgendaEventDto; startAt: string } | null> {
  const from = new Date(now.getTime() - 12 * 3600_000);
  const to = new Date(now.getTime() + 60 * 86_400_000);
  const { events, occurrences } = await listAgenda(userId, from, to);
  const byId = new Map(events.map((event) => [event.id, event]));
  for (const occurrence of occurrences) {
    const event = byId.get(occurrence.eventId);
    if (!event || event.status !== "SCHEDULED") continue;
    const start = new Date(occurrence.startAt);
    // dia inteiro de hoje ainda conta; com horário, só o que não começou
    if (event.isAllDay ? start.getTime() + 86_400_000 > now.getTime() : start >= now) return { event, startAt: occurrence.startAt };
  }
  return null;
}
