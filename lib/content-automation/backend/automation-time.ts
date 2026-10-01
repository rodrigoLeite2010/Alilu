import { isValidTimeZone, utcToZonedInputs, zonedDateTimeToUtc } from "@/lib/instagram/schedule-time";
import type { DayOfWeek } from "./automation-types";

/**
 * Matemática pura de fuso horário do Piloto Automático — nenhum acesso a
 * banco, testável sem mocks (mesmo princípio de lib/instagram/schedule-
 * time.ts, que é reaproveitado aqui, nunca reimplementado).
 */

const DAY_INDEX: DayOfWeek[] = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
];

export interface ZonedToday {
  /** "YYYY-MM-DD" no fuso da automação — a chave usada em automation_runs.run_date. */
  date: string;
  dayOfWeek: DayOfWeek;
}

/** Que dia (da semana) e que data civil é "agora" no fuso da automação. */
export function zonedToday(now: Date, timeZone: string): ZonedToday {
  const zone = isValidTimeZone(timeZone) ? timeZone : "America/Sao_Paulo";
  const { date } = utcToZonedInputs(now, zone);
  // Meio-dia UTC evita qualquer ambiguidade de fuso ao extrair o dia da semana da data civil.
  const dayIndex = new Date(`${date}T12:00:00Z`).getUTCDay();
  return { date, dayOfWeek: DAY_INDEX[dayIndex] };
}

/** Instante UTC (Date) de "HH:mm" numa data civil, no fuso da automação. */
export function publishInstantUtc(date: string, publishTime: string, timeZone: string): Date {
  const zone = isValidTimeZone(timeZone) ? timeZone : "America/Sao_Paulo";
  return zonedDateTimeToUtc(date, publishTime, zone);
}

/**
 * A execução deve começar a gerar conteúdo quando faltar
 * `generationLeadMinutes` (ou menos) para o horário de publicação —
 * "pré-geração" (seção 25). Sem limite superior: se o cron ficou parado e
 * o horário já passou, ainda assim gera (mais vale publicar atrasado do
 * que nunca) — a idempotência garante que nunca gera duas vezes no mesmo
 * dia mesmo assim.
 */
export function isDueForGeneration(
  now: Date,
  publishAtUtc: Date,
  generationLeadMinutes: number,
): boolean {
  const leadMs = generationLeadMinutes * 60_000;
  return now.getTime() >= publishAtUtc.getTime() - leadMs;
}

export interface NextSlotInput {
  dayOfWeek: DayOfWeek;
  publishTime: string;
  enabled: boolean;
}

/**
 * Próximo horário habilitado (de qualquer tipo) a partir de `now`, no fuso
 * da automação — procura até 7 dias à frente. Devolve a data civil, o
 * instante UTC e o próprio horário; `null` se nenhum horário está ligado.
 * Usado pelo painel ("Próximo Story: hoje às 19:00").
 */
export function findNextSlot<T extends NextSlotInput>(
  slots: T[],
  now: Date,
  timeZone: string,
): { slot: T; date: string; atUtc: Date; daysAhead: number } | null {
  const enabled = slots.filter((slot) => slot.enabled);
  if (enabled.length === 0) return null;
  const { date: today } = zonedToday(now, timeZone);
  for (let offset = 0; offset <= 7; offset += 1) {
    const base = new Date(`${today}T12:00:00Z`);
    base.setUTCDate(base.getUTCDate() + offset);
    const date = base.toISOString().slice(0, 10);
    const dayOfWeek = DAY_INDEX[base.getUTCDay()];
    const candidates = enabled
      .filter((slot) => slot.dayOfWeek === dayOfWeek)
      .map((slot) => ({ slot, atUtc: publishInstantUtc(date, slot.publishTime, timeZone) }))
      .filter((candidate) => candidate.atUtc.getTime() > now.getTime())
      .sort((a, b) => a.atUtc.getTime() - b.atUtc.getTime());
    if (candidates[0]) return { slot: candidates[0].slot, date, atUtc: candidates[0].atUtc, daysAhead: offset };
  }
  return null;
}
