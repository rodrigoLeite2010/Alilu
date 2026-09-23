/**
 * Datas de agendamento do Instagram: UTC no banco, horário local na tela.
 *
 * Regras (para nunca acontecer "agendei 15:00 e publicou 18:00"):
 *   - O servidor só aceita instantes ABSOLUTOS: ISO 8601 com `Z` ou com
 *     offset explícito (±hh:mm). Uma string como "2026-09-24T15:00" (sem
 *     fuso) é recusada — ela significaria horários diferentes em cada
 *     máquina.
 *   - A tela converte data + hora escolhidas no fuso IANA do usuário
 *     (ex.: America/Sao_Paulo) para UTC com `zonedDateTimeToUtc`, e grava
 *     também o fuso (`timezone_original`) para exibir de volta no mesmo
 *     horário local com `formatInTimeZone`.
 * Sem dependências: usa só `Intl.DateTimeFormat`, disponível no navegador
 * e no Node.
 */

export const DEFAULT_TIME_ZONE = "America/Sao_Paulo";

const ABSOLUTE_ISO_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2})$/i;

export function isValidTimeZone(timeZone: string | null | undefined): timeZone is string {
  if (!timeZone || timeZone.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(0);
    return true;
  } catch {
    return false;
  }
}

/** Fuso do navegador, com fallback seguro. */
export function getBrowserTimeZone(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isValidTimeZone(zone) ? zone : DEFAULT_TIME_ZONE;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

/** Aceita só ISO com fuso explícito. Retorna `null` para entrada ambígua/inválida. */
export function parseAbsoluteIso(value: string): Date | null {
  if (!ABSOLUTE_ISO_RE.test(value.trim())) return null;
  const parsed = new Date(value.trim());
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts: Record<string, number> = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") parts[part.type] = Number(part.value);
  }
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour === 24 ? 0 : parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

/** Diferença (ms) entre o horário de parede no fuso e UTC, naquele instante. */
function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const p = getZonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/**
 * Converte data ("YYYY-MM-DD") + hora ("HH:mm") de parede no fuso
 * informado para o instante UTC correspondente. Trata horário de verão
 * (duas passadas de ajuste de offset).
 */
export function zonedDateTimeToUtc(date: string, time: string, timeZone: string): Date {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);
  if (!dateMatch || !timeMatch) throw new RangeError("Data ou hora em formato inválido.");
  if (!isValidTimeZone(timeZone)) throw new RangeError("Fuso horário inválido.");

  const wallClockAsUtc = Date.UTC(
    Number(dateMatch[1]),
    Number(dateMatch[2]) - 1,
    Number(dateMatch[3]),
    Number(timeMatch[1]),
    Number(timeMatch[2]),
  );
  let guess = wallClockAsUtc - timeZoneOffsetMs(new Date(wallClockAsUtc), timeZone);
  guess = wallClockAsUtc - timeZoneOffsetMs(new Date(guess), timeZone);
  return new Date(guess);
}

/** Data ("YYYY-MM-DD") e hora ("HH:mm") de parede de um instante, no fuso informado. */
export function utcToZonedInputs(iso: string | Date, timeZone: string): { date: string; time: string } {
  const p = getZonedParts(typeof iso === "string" ? new Date(iso) : iso, timeZone);
  const pad = (value: number) => String(value).padStart(2, "0");
  return { date: `${p.year}-${pad(p.month)}-${pad(p.day)}`, time: `${pad(p.hour)}:${pad(p.minute)}` };
}

/** "24/09/2026 18:30" no fuso informado. */
export function formatInTimeZone(iso: string | null, timeZone: string): string | null {
  if (!iso) return null;
  const zone = isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE;
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: zone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "Seu post será publicado em 24/09 às 18:30." */
export function formatScheduleConfirmation(iso: string, timeZone: string): string {
  const { date, time } = utcToZonedInputs(iso, isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE);
  const [, month, day] = date.split("-");
  return `Seu post será publicado em ${day}/${month} às ${time}.`;
}
