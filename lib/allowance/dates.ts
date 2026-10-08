import { DEFAULT_TIMEZONE, daysInMonth, toLocalParts } from "@/lib/agenda/time";

/** Datas da Mesada: "dia" (YYYY-MM-DD) no fuso do projeto — sem horário, sem UTC. */

export const ALLOWANCE_TIMEZONE = DEFAULT_TIMEZONE;

const pad = (value: number) => String(value).padStart(2, "0");

export function isoDate(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function todayInTimezone(now: Date = new Date(), tz: string = ALLOWANCE_TIMEZONE): string {
  const p = toLocalParts(now, tz);
  return isoDate(p.year, p.month, p.day);
}

export function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  return year >= 2000 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

export function monthKey(year: number, month: number): string {
  return `${year}-${pad(month)}`;
}

/** Dia do pagamento no mês (31 em fevereiro vira 28/29). */
export function paymentDateFor(year: number, month: number, paymentDay: number): string {
  return isoDate(year, month, Math.min(Math.max(1, paymentDay), daysInMonth(year, month)));
}

export function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** Primeiro e último dia (YYYY-MM-DD) do mês. */
export function monthRange(year: number, month: number): { from: string; to: string } {
  return { from: isoDate(year, month, 1), to: isoDate(year, month, daysInMonth(year, month)) };
}

/** Semana de segunda a domingo que contém `day`. */
export function weekRange(day: string): { from: string; to: string } {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const weekday = (date.getUTCDay() + 6) % 7; // segunda = 0
  const start = new Date(date.getTime() - weekday * 86_400_000);
  const end = new Date(start.getTime() + 6 * 86_400_000);
  const fmt = (value: Date) => isoDate(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
  return { from: fmt(start), to: fmt(end) };
}

/** Próxima data de pagamento DEPOIS de hoje (a de hoje, se houver, já foi lançada). */
export function nextPaymentDate(today: string, paymentDay: number): string {
  const [y, m] = today.split("-").map(Number);
  const thisMonth = paymentDateFor(y, m, paymentDay);
  if (thisMonth > today) return thisMonth;
  const next = addMonths(y, m, 1);
  return paymentDateFor(next.year, next.month, paymentDay);
}
