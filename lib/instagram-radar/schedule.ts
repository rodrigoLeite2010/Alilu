/**
 * Programação do Radar Instagram (lógica pura — tela e servidor).
 *
 * Regras (todas no fuso do radar, padrão America/Sao_Paulo):
 *   - N publicações por dia, inteiro de 1 a 10 (limite do RADAR, não da Meta);
 *   - intervalo mínimo FIXO entre publicações, de uma lista fechada (30 min a 24 h);
 *   - janela de horário (início/fim) e dias da semana; fim < início = janela que
 *     atravessa a meia-noite (o dia da semana é o do INÍCIO da janela);
 *   - horários = início, início + intervalo, ... (N horários). Se não couberem
 *     na janela a configuração é RECUSADA com sugestões — nunca há
 *     "distribuição diferente" nem redução silenciosa do intervalo;
 *   - limite por CONTA e por dia (dia civil local): conta TODAS as publicações
 *     da conta (outros radares, filas, Piloto, manuais). O teto da conta é o
 *     menor limite entre os radares ativos dela (nunca acima de 10);
 *   - um horário a menos de "intervalo" de QUALQUER publicação da conta é
 *     pulado (não é deslocado para outro horário).
 */
import { isValidTimeZone, utcToZonedInputs, zonedDateTimeToUtc } from "@/lib/instagram/schedule-time";

export const RADAR_MIN_POSTS_PER_DAY = 1;
export const RADAR_MAX_POSTS_PER_DAY = 10;
/** Intervalos oferecidos (minutos). Qualquer outro valor é recusado. */
export const RADAR_INTERVAL_OPTIONS = [30, 60, 120, 180, 240, 360, 480, 720, 1440] as const;
export type RadarIntervalMinutes = (typeof RADAR_INTERVAL_OPTIONS)[number];
export const RADAR_DEFAULT_TIMEZONE = "America/Sao_Paulo";
/** Antecedência mínima para um horário ser usado. */
export const RADAR_LEAD_MINUTES = 5;
const MAX_SEARCH_DAYS = 800;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const RADAR_INTERVAL_LABEL: Record<RadarIntervalMinutes, string> = {
  30: "A cada 30 minutos",
  60: "A cada 1 hora",
  120: "A cada 2 horas",
  180: "A cada 3 horas",
  240: "A cada 4 horas",
  360: "A cada 6 horas",
  480: "A cada 8 horas",
  720: "A cada 12 horas",
  1440: "A cada 24 horas",
};

export interface RadarScheduleConfig {
  timezone: string;
  /** "YYYY-MM-DD" no fuso do radar; null = a partir de hoje. */
  startDate: string | null;
  postsPerDay: number;
  intervalMinutes: RadarIntervalMinutes;
  windowStart: string;
  windowEnd: string;
  /** 0 = domingo … 6 = sábado (dia em que a janela COMEÇA). */
  weekdays: number[];
}

export const DEFAULT_RADAR_SCHEDULE: RadarScheduleConfig = {
  timezone: RADAR_DEFAULT_TIMEZONE,
  startDate: null,
  postsPerDay: 3,
  intervalMinutes: 240,
  windowStart: "09:00",
  windowEnd: "22:00",
  weekdays: [0, 1, 2, 3, 4, 5, 6],
};

export class RadarScheduleError extends Error {
  constructor(
    message: string,
    readonly suggestions: string[] = [],
  ) {
    super(message);
    this.name = "RadarScheduleError";
  }
}

const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const toTime = (minutes: number) => {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

export function intervalLabel(minutes: number): string {
  return RADAR_INTERVAL_LABEL[minutes as RadarIntervalMinutes] ?? `${minutes} min`;
}

/** Duração da janela em minutos (início == fim = 24 h). */
export function windowLengthMinutes(windowStart: string, windowEnd: string): number {
  const length = (toMinutes(windowEnd) - toMinutes(windowStart) + 1440) % 1440;
  return length === 0 ? 1440 : length;
}

export function crossesMidnight(windowStart: string, windowEnd: string): boolean {
  return toMinutes(windowEnd) < toMinutes(windowStart);
}

/** Quantas publicações cabem na janela com o intervalo dado (teto de 10). */
export function maxPostsThatFit(windowStart: string, windowEnd: string, intervalMinutes: number): number {
  const byWindow = Math.floor(windowLengthMinutes(windowStart, windowEnd) / intervalMinutes) + 1;
  const byDay = Math.floor(1440 / intervalMinutes);
  return Math.max(0, Math.min(byWindow, byDay, RADAR_MAX_POSTS_PER_DAY));
}

/**
 * Confere se N publicações com o intervalo cabem na janela. Também exige
 * N × intervalo ≤ 24 h, para que a última do dia e a primeira do dia
 * seguinte respeitem o mesmo intervalo mínimo.
 */
export function checkRadarFit(config: Pick<RadarScheduleConfig, "postsPerDay" | "intervalMinutes" | "windowStart" | "windowEnd">): { ok: true } | { ok: false; message: string; suggestions: string[] } {
  const { postsPerDay: n, intervalMinutes: interval, windowStart, windowEnd } = config;
  const length = windowLengthMinutes(windowStart, windowEnd);
  const span = (n - 1) * interval;
  if (span <= length && n * interval <= 1440) return { ok: true };

  const fit = maxPostsThatFit(windowStart, windowEnd, interval);
  const suggestions: string[] = [];
  if (fit >= 1) suggestions.push(`Diminuir para ${fit} publicação(ões) por dia (é o que cabe com ${intervalLabel(interval).toLowerCase()}).`);
  const smaller = [...RADAR_INTERVAL_OPTIONS].reverse().find((option) => option < interval && (n - 1) * option <= length && n * option <= 1440);
  if (smaller) suggestions.push(`Usar intervalo menor: ${intervalLabel(smaller).toLowerCase()}.`);
  if (n * interval <= 1440 && span < 1440) {
    suggestions.push(`Aumentar a janela: das ${windowStart} até as ${toTime(toMinutes(windowStart) + span)}${toMinutes(windowStart) + span >= 1440 ? " (do dia seguinte)" : ""}.`);
  }
  const why =
    n * interval > 1440
      ? `${n} publicações ${intervalLabel(interval).toLowerCase()} ocupam mais de 24 horas.`
      : `Das ${windowStart} às ${windowEnd} cabem no máximo ${fit} publicação(ões) ${intervalLabel(interval).toLowerCase()}.`;
  return { ok: false, message: `Configuração incompatível: ${why} Ajuste a quantidade, o intervalo ou a janela.`, suggestions };
}

/** Horários do dia (a partir do início da janela). `dayOffset` = 1 quando passa da meia-noite. */
export function radarDailySlots(config: Pick<RadarScheduleConfig, "postsPerDay" | "intervalMinutes" | "windowStart">): Array<{ time: string; dayOffset: number }> {
  const start = toMinutes(config.windowStart);
  return Array.from({ length: config.postsPerDay }, (_, index) => {
    const total = start + index * config.intervalMinutes;
    return { time: toTime(total), dayOffset: Math.floor(total / 1440) };
  });
}

function int(value: unknown): number | null {
  const parsed = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : null;
}

/** Valida/normaliza a programação recebida da tela (usada no frontend E no backend). */
export function normalizeRadarSchedule(raw: Partial<Record<keyof RadarScheduleConfig, unknown>>, base: RadarScheduleConfig = DEFAULT_RADAR_SCHEDULE): RadarScheduleConfig {
  const timezone = raw.timezone === undefined || raw.timezone === "" ? base.timezone : raw.timezone;
  if (typeof timezone !== "string" || !isValidTimeZone(timezone)) throw new RadarScheduleError("Fuso horário inválido.");

  let startDate = raw.startDate === undefined ? base.startDate : raw.startDate;
  if (startDate === "" || startDate === null) startDate = null;
  if (startDate !== null && (typeof startDate !== "string" || !DATE_RE.test(startDate) || Number.isNaN(Date.parse(`${startDate}T00:00:00Z`)))) {
    throw new RadarScheduleError("Data de início inválida (use AAAA-MM-DD).");
  }

  const postsRaw = raw.postsPerDay === undefined ? base.postsPerDay : raw.postsPerDay;
  const postsPerDay = int(postsRaw);
  if (postsPerDay === null || !Number.isInteger(postsPerDay) || postsPerDay < RADAR_MIN_POSTS_PER_DAY || postsPerDay > RADAR_MAX_POSTS_PER_DAY) {
    throw new RadarScheduleError(`Quantas publicações por dia? Escolha um número inteiro de ${RADAR_MIN_POSTS_PER_DAY} a ${RADAR_MAX_POSTS_PER_DAY}.`);
  }

  const intervalRaw = int(raw.intervalMinutes === undefined ? base.intervalMinutes : raw.intervalMinutes);
  if (intervalRaw === null || !(RADAR_INTERVAL_OPTIONS as readonly number[]).includes(intervalRaw)) {
    throw new RadarScheduleError("Intervalo mínimo inválido: escolha uma das opções (30 minutos a 24 horas).");
  }
  const intervalMinutes = intervalRaw as RadarIntervalMinutes;

  const windowStart = raw.windowStart === undefined ? base.windowStart : raw.windowStart;
  const windowEnd = raw.windowEnd === undefined ? base.windowEnd : raw.windowEnd;
  if (typeof windowStart !== "string" || !TIME_RE.test(windowStart)) throw new RadarScheduleError("Horário inicial inválido (use HH:MM, ex.: 09:00).");
  if (typeof windowEnd !== "string" || !TIME_RE.test(windowEnd)) throw new RadarScheduleError("Horário final inválido (use HH:MM, ex.: 22:00).");

  const weekdaysRaw = raw.weekdays === undefined ? base.weekdays : raw.weekdays;
  if (!Array.isArray(weekdaysRaw) || weekdaysRaw.some((day) => !Number.isInteger(day) || (day as number) < 0 || (day as number) > 6)) {
    throw new RadarScheduleError("Dias da semana inválidos.");
  }
  const weekdays = [...new Set(weekdaysRaw as number[])].sort();
  if (weekdays.length === 0) throw new RadarScheduleError("Escolha pelo menos um dia da semana.");

  const config: RadarScheduleConfig = { timezone, startDate: startDate as string | null, postsPerDay, intervalMinutes, windowStart, windowEnd, weekdays };
  const fit = checkRadarFit(config);
  if (!fit.ok) throw new RadarScheduleError(fit.message, fit.suggestions);
  return config;
}

// ─────────────────────────── Alocação ───────────────────────────

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export interface RadarOccupiedSlot {
  at: Date;
  /** true = publicação DESTE radar. */
  own: boolean;
}

export type RadarSkipReason = "ACCOUNT_DAILY_LIMIT" | "INTERVAL_CONFLICT";

export interface AllocateRadarSlotsInput {
  config: RadarScheduleConfig;
  now: Date;
  /** Todas as publicações (agendadas/em andamento/publicadas) da MESMA conta Instagram. */
  occupied: RadarOccupiedSlot[];
  count: number;
  /** Teto combinado da conta por dia (outros radares, filas, Piloto, manuais). */
  accountDailyCap: number;
  until?: Date | null;
}

export interface AllocateRadarSlotsResult {
  slots: Date[];
  skipped: Array<{ at: Date; reason: RadarSkipReason }>;
}

/** Próximos `count` horários do radar que respeitam janela, limites e intervalo. Nunca desloca um horário. */
export function allocateRadarSlots(input: AllocateRadarSlotsInput): AllocateRadarSlotsResult {
  const { config, now } = input;
  const slots: Date[] = [];
  const skipped: AllocateRadarSlotsResult["skipped"] = [];
  if (input.count <= 0) return { slots, skipped };
  const tz = config.timezone;
  const intervalMs = config.intervalMinutes * 60_000;
  const earliest = now.getTime() + RADAR_LEAD_MINUTES * 60_000;
  const until = input.until ? input.until.getTime() : null;
  const cap = Math.max(0, Math.min(input.accountDailyCap, RADAR_MAX_POSTS_PER_DAY));
  const daily = radarDailySlots(config);
  const weekdays = new Set(config.weekdays);

  const occupied = input.occupied.map((slot) => ({ at: slot.at.getTime(), own: slot.own }));
  const ownByDay = new Map<string, number>();
  const accountByDay = new Map<string, number>();
  const bump = (map: Map<string, number>, key: string) => map.set(key, (map.get(key) ?? 0) + 1);
  for (const slot of occupied) {
    const key = utcToZonedInputs(new Date(slot.at), tz).date;
    bump(accountByDay, key);
    if (slot.own) bump(ownByDay, key);
  }

  const today = utcToZonedInputs(now, tz).date;
  // Começa no dia anterior: uma janela que atravessa a meia-noite pode ter horários hoje.
  let day = config.startDate && config.startDate > today ? config.startDate : addDays(today, -1);
  for (let step = 0; step < MAX_SEARCH_DAYS && slots.length < input.count; step += 1, day = addDays(day, 1)) {
    if (!weekdays.has(weekdayOf(day))) continue;
    for (const entry of daily) {
      if (slots.length >= input.count) break;
      const at = zonedDateTimeToUtc(addDays(day, entry.dayOffset), entry.time, tz).getTime();
      if (at < earliest) continue;
      if (until !== null && at > until) return { slots, skipped };
      const key = utcToZonedInputs(new Date(at), tz).date;
      if (config.startDate && key < config.startDate) continue;
      if (occupied.some((slot) => slot.own && slot.at === at)) continue; // já agendado por este radar
      if ((ownByDay.get(key) ?? 0) >= config.postsPerDay) continue;
      if ((accountByDay.get(key) ?? 0) >= cap) {
        skipped.push({ at: new Date(at), reason: "ACCOUNT_DAILY_LIMIT" });
        continue;
      }
      if (occupied.some((slot) => Math.abs(slot.at - at) < intervalMs)) {
        skipped.push({ at: new Date(at), reason: "INTERVAL_CONFLICT" });
        continue;
      }
      slots.push(new Date(at));
      occupied.push({ at, own: true });
      bump(ownByDay, key);
      bump(accountByDay, key);
    }
  }
  return { slots, skipped };
}

/**
 * Teto combinado de publicações por dia numa conta: o MENOR limite entre os
 * radares ativos dela (inclui o radar que está sendo planejado) — nunca acima de 10.
 */
export function accountDailyCap(postsPerDayOfActiveRadars: number[]): number {
  const valid = postsPerDayOfActiveRadars.filter((value) => Number.isInteger(value) && value >= 1);
  if (valid.length === 0) return RADAR_MAX_POSTS_PER_DAY;
  return Math.min(RADAR_MAX_POSTS_PER_DAY, ...valid);
}

/** Dias (corridos, contando o primeiro) entre o primeiro e o último horário previstos. */
export function estimateDaysToConsume(slots: Date[], timezone: string): number {
  if (slots.length === 0) return 0;
  const first = utcToZonedInputs(slots[0], timezone).date;
  const last = utcToZonedInputs(slots[slots.length - 1], timezone).date;
  return Math.round((Date.parse(`${last}T00:00:00Z`) - Date.parse(`${first}T00:00:00Z`)) / 86_400_000) + 1;
}

export const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Resumo legível: "9h, 13h e 17h". */
export function describeDailyTimes(config: Pick<RadarScheduleConfig, "postsPerDay" | "intervalMinutes" | "windowStart">): string {
  const labels = radarDailySlots(config).map(({ time, dayOffset }) => `${time.endsWith(":00") ? `${Number(time.slice(0, 2))}h` : time.replace(":", "h")}${dayOffset ? " (+1 dia)" : ""}`);
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} e ${labels[labels.length - 1]}`;
}
