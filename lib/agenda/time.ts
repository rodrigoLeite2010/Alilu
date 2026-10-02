/**
 * Datas da Agenda (módulo puro — tela e servidor). Regra: no banco tudo é
 * UTC (timestamptz); a conversão para o relógio do usuário usa o fuso IANA
 * (ex.: America/Sao_Paulo) via Intl — sem biblioteca extra e respeitando
 * horário de verão onde existir.
 *
 * Recorrência é calculada no RELÓGIO LOCAL do fuso do compromisso: "toda
 * segunda às 9h" continua às 9h mesmo se o fuso mudar de offset.
 */

export type Recurrence = "NONE" | "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
export const RECURRENCES: Recurrence[] = ["NONE", "DAILY", "WEEKLY", "MONTHLY", "YEARLY"];
export const RECURRENCE_LABEL: Record<Recurrence, string> = {
  NONE: "Não repete",
  DAILY: "Todo dia",
  WEEKLY: "Toda semana",
  MONTHLY: "Todo mês",
  YEARLY: "Todo ano",
};

export const DEFAULT_TIMEZONE = "America/Sao_Paulo";

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export interface LocalParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0 = domingo
}

const partsFormatters = new Map<string, Intl.DateTimeFormat>();
function partsFormatter(tz: string): Intl.DateTimeFormat {
  let formatter = partsFormatters.get(tz);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    partsFormatters.set(tz, formatter);
  }
  return formatter;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function toLocalParts(date: Date, tz: string): LocalParts {
  const parts: Record<string, string> = {};
  for (const part of partsFormatter(tz).formatToParts(date)) parts[part.type] = part.value;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    weekday: WEEKDAYS.indexOf(parts.weekday),
  };
}

/** Diferença (ms) entre o relógio local do fuso e UTC naquele instante. */
function offsetMs(date: Date, tz: string): number {
  const p = toLocalParts(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, date.getUTCSeconds(), date.getUTCMilliseconds());
  return asUtc - date.getTime();
}

/** Relógio local (ano, mês, dia, hora, minuto) no fuso → instante UTC. */
export function localToUtc(year: number, month: number, day: number, hour: number, minute: number, tz: string): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  let result = guess - offsetMs(new Date(guess), tz);
  // Segunda passada corrige a virada de horário de verão.
  result = guess - offsetMs(new Date(result), tz);
  return new Date(result);
}

/** "2026-10-10" + "14:30" (ou null = dia inteiro) no fuso → UTC. */
export function parseLocalDateTime(date: string, time: string | null, tz: string): Date | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!d) return null;
  const [year, month, day] = [Number(d[1]), Number(d[2]), Number(d[3])];
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  let hour = 0;
  let minute = 0;
  if (time) {
    const t = /^(\d{2}):(\d{2})$/.exec(time);
    if (!t) return null;
    hour = Number(t[1]);
    minute = Number(t[2]);
    if (hour > 23 || minute > 59) return null;
  }
  return localToUtc(year, month, day, hour, minute, tz);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function localDateKey(date: Date, tz: string): string {
  const p = toLocalParts(date, tz);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function localTimeKey(date: Date, tz: string): string {
  const p = toLocalParts(date, tz);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

/** k-ésima ocorrência (k = 0 é a original), no relógio local do fuso do compromisso. */
export function occurrenceAt(startAt: Date, recurrence: Recurrence, k: number, tz: string): Date {
  if (recurrence === "NONE" || k === 0) return startAt;
  const p = toLocalParts(startAt, tz);
  let { year, month, day } = p;
  if (recurrence === "DAILY" || recurrence === "WEEKLY") {
    const base = new Date(Date.UTC(year, month - 1, day));
    base.setUTCDate(base.getUTCDate() + k * (recurrence === "DAILY" ? 1 : 7));
    year = base.getUTCFullYear();
    month = base.getUTCMonth() + 1;
    day = base.getUTCDate();
  } else if (recurrence === "MONTHLY") {
    const total = (month - 1) + k;
    year = year + Math.floor(total / 12);
    month = (total % 12) + 1;
    day = Math.min(p.day, daysInMonth(year, month)); // dia 31 → último dia do mês
  } else {
    year = year + k;
    day = Math.min(p.day, daysInMonth(year, month)); // 29/02 → 28/02
  }
  return localToUtc(year, month, day, p.hour, p.minute, tz);
}

const APPROX_PERIOD_MS: Record<Exclude<Recurrence, "NONE">, number> = {
  DAILY: 86_400_000,
  WEEKLY: 7 * 86_400_000,
  MONTHLY: 28 * 86_400_000,
  YEARLY: 365 * 86_400_000,
};

/** Primeira ocorrência com início >= `from` (ou null se não repete e já passou). */
export function nextOccurrence(startAt: Date, recurrence: Recurrence, from: Date, tz: string): Date | null {
  if (startAt.getTime() >= from.getTime()) return startAt;
  if (recurrence === "NONE") return null;
  // Pula direto para perto de `from` e ajusta (sem iterar desde o início).
  let k = Math.max(0, Math.floor((from.getTime() - startAt.getTime()) / APPROX_PERIOD_MS[recurrence]) - 2);
  for (let guard = 0; guard < 400; guard += 1, k += 1) {
    const occurrence = occurrenceAt(startAt, recurrence, k, tz);
    if (occurrence.getTime() >= from.getTime()) return occurrence;
  }
  return null;
}

/** Ocorrências com início em [from, to) — para montar mês/semana/lista. */
export function occurrencesBetween(startAt: Date, recurrence: Recurrence, from: Date, to: Date, tz: string, max = 400): Date[] {
  const result: Date[] = [];
  if (recurrence === "NONE") {
    if (startAt >= from && startAt < to) result.push(startAt);
    return result;
  }
  let current = nextOccurrence(startAt, recurrence, from, tz);
  let k = 0;
  if (current) {
    // descobre o índice k da ocorrência encontrada
    k = Math.max(0, Math.floor((current.getTime() - startAt.getTime()) / APPROX_PERIOD_MS[recurrence]) - 2);
    while (occurrenceAt(startAt, recurrence, k, tz).getTime() < current.getTime()) k += 1;
  }
  while (current && current < to && result.length < max) {
    result.push(current);
    k += 1;
    current = occurrenceAt(startAt, recurrence, k, tz);
  }
  return result;
}

const WEEKDAY_SHORT = ["dom.", "seg.", "ter.", "qua.", "qui.", "sex.", "sáb."];

/** "Hoje às 14:30", "Amanhã (dia inteiro)", "sex., 10/10 às 09:00" — no fuso do usuário. */
export function whenLabel(occurrence: Date, isAllDay: boolean, tz: string, now: Date = new Date()): string {
  const target = localDateKey(occurrence, tz);
  const today = localDateKey(now, tz);
  const tomorrow = localDateKey(new Date(now.getTime() + 86_400_000), tz);
  const p = toLocalParts(occurrence, tz);
  const dayLabel =
    target === today
      ? "Hoje"
      : target === tomorrow
        ? "Amanhã"
        : `${WEEKDAY_SHORT[p.weekday]}, ${String(p.day).padStart(2, "0")}/${String(p.month).padStart(2, "0")}${p.year !== toLocalParts(now, tz).year ? `/${p.year}` : ""}`;
  return isAllDay ? `${dayLabel} (dia inteiro)` : `${dayLabel} às ${localTimeKey(occurrence, tz)}`;
}

/** Hora-base do lembrete de compromisso de dia inteiro: 9h locais do dia. */
export const ALL_DAY_REMINDER_BASE_HOUR = 9;

export function reminderBase(occurrence: Date, isAllDay: boolean, tz: string): Date {
  if (!isAllDay) return occurrence;
  const p = toLocalParts(occurrence, tz);
  return localToUtc(p.year, p.month, p.day, ALL_DAY_REMINDER_BASE_HOUR, 0, tz);
}
