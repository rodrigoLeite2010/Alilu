/**
 * Datas "YYYY-MM-DD" sem fuso. Toda conta usa UTC internamente só como
 * ferramenta de calendário (nunca depende do fuso do servidor/navegador).
 */

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidISODate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = ISO_RE.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (month < 1 || month > 12 || day < 1) return false;
  return day <= daysInMonth(year, month);
}

export function isValidMonth(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function parseISO(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split("-").map(Number);
  return { year, month, day };
}

export function toISO(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function addDays(iso: string, days: number): string {
  const { year, month, day } = parseISO(iso);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return toISO(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

/** Diferença em dias (b - a). */
export function diffDays(a: string, b: string): number {
  const pa = parseISO(a);
  const pb = parseISO(b);
  return Math.round((Date.UTC(pb.year, pb.month - 1, pb.day) - Date.UTC(pa.year, pa.month - 1, pa.day)) / 86_400_000);
}

/**
 * Soma meses mantendo o "dia âncora" (ex.: dia 31 → 28/fev, depois volta a
 * 31/mar), sem acumular o recuo de meses curtos.
 */
export function addMonthsAnchored(anchorISO: string, months: number): string {
  const { year, month, day } = parseISO(anchorISO);
  const total = year * 12 + (month - 1) + months;
  const newYear = Math.floor(total / 12);
  const newMonth = (total % 12) + 1;
  return toISO(newYear, newMonth, Math.min(day, daysInMonth(newYear, newMonth)));
}

export function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

export function monthRange(month: string): { from: string; to: string } {
  const [year, m] = month.split("-").map(Number);
  return { from: toISO(year, m, 1), to: toISO(year, m, daysInMonth(year, m)) };
}

export function addMonthsToMonth(month: string, delta: number): string {
  const [year, m] = month.split("-").map(Number);
  const total = year * 12 + (m - 1) + delta;
  return `${String(Math.floor(total / 12)).padStart(4, "0")}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/** Data de hoje no fuso de Brasília (o produto é brasileiro). */
export function todayISO(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parts; // en-CA => YYYY-MM-DD
}
