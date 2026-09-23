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
