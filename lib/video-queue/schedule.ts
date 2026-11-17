/**
 * Programação da fila (lógica pura, sem banco — testável e reusada na tela
 * para a prévia).
 *
 * `allocateSlots` encontra os próximos horários livres:
 *   - só nos dias da semana e horários escolhidos, no fuso da fila;
 *   - a partir da data de início (ou de hoje) e nunca no passado
 *     (antecedência mínima de LEAD_MINUTES);
 *   - no máximo `postsPerDay` publicações DA FILA por dia;
 *   - sem conflitar com publicações já agendadas nas MESMAS contas de
 *     destino (Instagram/Páginas): nenhum horário a menos de
 *     `minIntervalMinutes` de outra publicação. `allowSameSlot` libera o
 *     conflito com publicações de fora da fila (nunca com a própria fila);
 *   - nunca substitui um agendamento existente: só ocupa horários livres.
 */
import { isValidTimeZone, utcToZonedInputs, zonedDateTimeToUtc } from "@/lib/instagram/schedule-time";
import { MAX_PUBLISH_TIMES, type VideoQueueNotReadyPolicy, type VideoQueueOrderMode } from "./types";

export const LEAD_MINUTES = 5;
export const MAX_SEARCH_DAYS = 800;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface QueueScheduleConfig {
  timezone: string;
  /** "YYYY-MM-DD" no fuso da fila; null = a partir de hoje. */
  startDate: string | null;
  postsPerDay: number;
  /** "HH:MM", ordenados e sem repetição. */
  publishTimes: string[];
  /** 0 = domingo … 6 = sábado. */
  weekdays: number[];
  minIntervalMinutes: number;
  allowSameSlot: boolean;
  orderMode: VideoQueueOrderMode;
  notReadyPolicy: VideoQueueNotReadyPolicy;
  materializeAheadHours: number;
}

export interface OccupiedSlot {
  at: Date;
  /** true = publicação desta mesma fila (conta para o limite diário). */
  own: boolean;
}

export class QueueScheduleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QueueScheduleError";
  }
}

export const DEFAULT_SCHEDULE: QueueScheduleConfig = {
  timezone: "America/Sao_Paulo",
  startDate: null,
  postsPerDay: 3,
  publishTimes: ["09:00", "15:00", "20:00"],
  weekdays: [0, 1, 2, 3, 4, 5, 6],
  minIntervalMinutes: 60,
  allowSameSlot: false,
  orderMode: "POSITION",
  notReadyPolicy: "NEXT_READY",
  materializeAheadHours: 48,
};

function int(value: unknown, fallback: number): number {
  const parsed = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof parsed === "number" && Number.isInteger(parsed) ? parsed : fallback;
}

/** Valida/normaliza a configuração recebida da tela. Lança QueueScheduleError com mensagem para o usuário. */
export function normalizeScheduleConfig(raw: Partial<Record<keyof QueueScheduleConfig, unknown>>, base: QueueScheduleConfig = DEFAULT_SCHEDULE): QueueScheduleConfig {
  const timezone = raw.timezone === undefined ? base.timezone : raw.timezone;
  if (typeof timezone !== "string" || !isValidTimeZone(timezone)) throw new QueueScheduleError("Fuso horário inválido.");

  let startDate = raw.startDate === undefined ? base.startDate : raw.startDate;
  if (startDate === "" || startDate === null) startDate = null;
  if (startDate !== null && (typeof startDate !== "string" || !DATE_RE.test(startDate) || Number.isNaN(Date.parse(`${startDate}T00:00:00Z`)))) {
    throw new QueueScheduleError("Data de início inválida (use AAAA-MM-DD).");
  }

  const timesRaw = raw.publishTimes === undefined ? base.publishTimes : raw.publishTimes;
  if (!Array.isArray(timesRaw) || timesRaw.some((time) => typeof time !== "string" || !TIME_RE.test(time))) {
    throw new QueueScheduleError("Horários inválidos (use HH:MM, ex.: 09:00).");
  }
  const publishTimes = [...new Set(timesRaw as string[])].sort();
  if (publishTimes.length === 0) throw new QueueScheduleError("Escolha pelo menos um horário de publicação.");
  if (publishTimes.length > MAX_PUBLISH_TIMES) throw new QueueScheduleError(`No máximo ${MAX_PUBLISH_TIMES} horários por dia.`);

  const postsPerDay = int(raw.postsPerDay, base.postsPerDay);
  if (postsPerDay < 1 || postsPerDay > 24) throw new QueueScheduleError("Publicações por dia: escolha entre 1 e 24.");
  if (postsPerDay > publishTimes.length) {
    throw new QueueScheduleError(`Você escolheu ${postsPerDay} publicações por dia, mas só ${publishTimes.length} horário(s). Adicione horários ou diminua a quantidade.`);
  }

  const weekdaysRaw = raw.weekdays === undefined ? base.weekdays : raw.weekdays;
  if (!Array.isArray(weekdaysRaw) || weekdaysRaw.some((day) => !Number.isInteger(day) || (day as number) < 0 || (day as number) > 6)) {
    throw new QueueScheduleError("Dias da semana inválidos.");
  }
  const weekdays = [...new Set(weekdaysRaw as number[])].sort();
  if (weekdays.length === 0) throw new QueueScheduleError("Escolha pelo menos um dia da semana.");

  const minIntervalMinutes = int(raw.minIntervalMinutes, base.minIntervalMinutes);
  if (minIntervalMinutes < 0 || minIntervalMinutes > 1440) throw new QueueScheduleError("Intervalo mínimo: entre 0 e 1440 minutos.");

  const orderMode = raw.orderMode === undefined ? base.orderMode : raw.orderMode;
  if (orderMode !== "POSITION" && orderMode !== "REVERSE") throw new QueueScheduleError("Ordem de publicação inválida.");
  const notReadyPolicy = raw.notReadyPolicy === undefined ? base.notReadyPolicy : raw.notReadyPolicy;
  if (notReadyPolicy !== "WAIT" && notReadyPolicy !== "NEXT_READY") throw new QueueScheduleError("Regra para vídeo não pronto inválida.");

  const materializeAheadHours = int(raw.materializeAheadHours, base.materializeAheadHours);
  if (materializeAheadHours < 1 || materializeAheadHours > 720) throw new QueueScheduleError("Antecedência de agendamento: entre 1 e 720 horas.");

  const allowSameSlot = raw.allowSameSlot === undefined ? base.allowSameSlot : raw.allowSameSlot === true;

  return { timezone, startDate: startDate as string | null, postsPerDay, publishTimes, weekdays, minIntervalMinutes, allowSameSlot, orderMode, notReadyPolicy, materializeAheadHours };
}

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return next.toISOString().slice(0, 10);
}

function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export interface AllocateSlotsInput {
  config: QueueScheduleConfig;
  now: Date;
  occupied: OccupiedSlot[];
  count: number;
  /** Não devolve horários depois deste instante (horizonte de materialização). */
  until?: Date | null;
}

/** Próximos `count` horários livres (UTC, em ordem crescente). Pode devolver menos (horizonte). */
export function allocateSlots(input: AllocateSlotsInput): Date[] {
  const { config, now } = input;
  const result: Date[] = [];
  if (input.count <= 0) return result;
  const occupied = input.occupied.map((slot) => ({ at: slot.at.getTime(), own: slot.own }));
  const tz = config.timezone;
  const intervalMs = Math.max(config.minIntervalMinutes, 1) * 60_000;
  const earliest = now.getTime() + LEAD_MINUTES * 60_000;
  const today = utcToZonedInputs(now, tz).date;
  let day = config.startDate && config.startDate > today ? config.startDate : today;
  const weekdays = new Set(config.weekdays);
  const times = [...config.publishTimes].sort();
  const perDay = Math.min(config.postsPerDay, times.length);
  const until = input.until ? input.until.getTime() : null;

  for (let step = 0; step < MAX_SEARCH_DAYS && result.length < input.count; step += 1, day = addDays(day, 1)) {
    if (!weekdays.has(weekdayOf(day))) continue;
    const dayStart = zonedDateTimeToUtc(day, "00:00", tz).getTime();
    const dayEnd = zonedDateTimeToUtc(addDays(day, 1), "00:00", tz).getTime();
    if (until !== null && dayStart > until) break;
    let ownToday = occupied.filter((slot) => slot.own && slot.at >= dayStart && slot.at < dayEnd).length;
    for (const time of times) {
      if (ownToday >= perDay || result.length >= input.count) break;
      const at = zonedDateTimeToUtc(day, time, tz).getTime();
      if (at < earliest) continue;
      if (until !== null && at > until) return result;
      const conflict = occupied.some((slot) => (config.allowSameSlot && !slot.own ? false : Math.abs(slot.at - at) < intervalMs));
      if (conflict) continue;
      result.push(new Date(at));
      occupied.push({ at, own: true });
      ownToday += 1;
    }
  }
  return result;
}

/** Itens elegíveis para receber horário agora, conforme a regra de "vídeo não pronto". */
export function pickPlannableItems<T extends { id: string; status: string; position: number }>(
  items: T[],
  config: Pick<QueueScheduleConfig, "orderMode" | "notReadyPolicy">,
): T[] {
  const ordered = [...items].sort((a, b) => (config.orderMode === "REVERSE" ? b.position - a.position : a.position - b.position));
  const result: T[] = [];
  for (const item of ordered) {
    if (item.status === "READY") {
      result.push(item);
      continue;
    }
    // Aguardar: um vídeo ainda em importação (ou aguardando arquivo) segura os seguintes.
    if (config.notReadyPolicy === "WAIT" && ["PENDING", "VALIDATING", "IMPORTING", "PROCESSING", "WAITING_FILE"].includes(item.status)) break;
  }
  return result;
}
