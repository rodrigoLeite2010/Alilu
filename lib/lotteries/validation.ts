import { isValidISODate } from "@/lib/financas/dates";
import { LOTOFACIL_CONFIG } from "./lotofacil-config";
import type { LotofacilMode } from "./lotofacil-generator";

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

const MAX_AMOUNT_CENTS = 100_000_000_00; // R$ 100 milhões — mesmo teto do módulo financeiro.
const MODES: LotofacilMode[] = ["aleatorio", "equilibrado", "personalizado", "diversificado"];

export interface SaveGameInput {
  numbers: number[];
  betSize: number;
  mode: LotofacilMode;
}

export interface SaveBetInput {
  contestNumber: number | null;
  drawDate: string | null;
  amountCents: number;
  note: string | null;
  games: SaveGameInput[];
}

function validGameNumbers(numbers: unknown, betSize: number): numbers is number[] {
  if (!Array.isArray(numbers) || numbers.length !== betSize) return false;
  const set = new Set<number>();
  for (const n of numbers) {
    if (
      typeof n !== "number" ||
      !Number.isInteger(n) ||
      n < LOTOFACIL_CONFIG.minNumber ||
      n > LOTOFACIL_CONFIG.maxNumber
    ) {
      return false;
    }
    set.add(n);
  }
  return set.size === numbers.length;
}

function parseGameInput(raw: unknown): ParseResult<SaveGameInput> {
  if (typeof raw !== "object" || raw === null) return { ok: false, error: "Jogo inválido." };
  const value = raw as Record<string, unknown>;

  const betSize = value.betSize;
  if (
    typeof betSize !== "number" ||
    !Number.isInteger(betSize) ||
    betSize < LOTOFACIL_CONFIG.minBetNumbers ||
    betSize > LOTOFACIL_CONFIG.maxBetNumbers
  ) {
    return { ok: false, error: `Escolha entre ${LOTOFACIL_CONFIG.minBetNumbers} e ${LOTOFACIL_CONFIG.maxBetNumbers} números.` };
  }

  if (!validGameNumbers(value.numbers, betSize)) {
    return { ok: false, error: "Números do jogo inválidos ou repetidos." };
  }

  const mode = value.mode;
  if (typeof mode !== "string" || !MODES.includes(mode as LotofacilMode)) {
    return { ok: false, error: "Modo de geração inválido." };
  }

  return {
    ok: true,
    value: {
      numbers: [...(value.numbers as number[])].sort((a, b) => a - b),
      betSize,
      mode: mode as LotofacilMode,
    },
  };
}

const MAX_GAMES_PER_SAVE = 50; // mesmo teto da geração múltipla no gerador.

export interface BetHeaderInput {
  contestNumber: number | null;
  drawDate: string | null;
  amountCents: number;
  note: string | null;
}

/**
 * Valida os campos "de cabeçalho" de uma aposta (concurso, data do
 * sorteio, valor apostado, observação) — comuns a criar (com jogos) e
 * editar (sem jogos). Nunca chamada diretamente por uma rota; sempre via
 * parseSaveBetInput/parseUpdateBetInput, para não duplicar a validação.
 */
function parseBetHeaderInput(raw: Record<string, unknown>): ParseResult<BetHeaderInput> {
  let contestNumber: number | null = null;
  if (raw.contestNumber !== undefined && raw.contestNumber !== null) {
    if (typeof raw.contestNumber !== "number" || !Number.isInteger(raw.contestNumber) || raw.contestNumber <= 0) {
      return { ok: false, error: "Número do concurso inválido." };
    }
    contestNumber = raw.contestNumber;
  }

  let drawDate: string | null = null;
  if (raw.drawDate !== undefined && raw.drawDate !== null && raw.drawDate !== "") {
    if (!isValidISODate(raw.drawDate)) return { ok: false, error: "Data do sorteio inválida." };
    drawDate = raw.drawDate;
  }

  const amountCents = raw.amountCents ?? 0;
  if (typeof amountCents !== "number" || !Number.isInteger(amountCents) || amountCents < 0 || amountCents > MAX_AMOUNT_CENTS) {
    return { ok: false, error: "Valor apostado inválido." };
  }

  let note: string | null = null;
  if (raw.note !== undefined && raw.note !== null) {
    if (typeof raw.note !== "string" || raw.note.length > 300) return { ok: false, error: "Observação muito longa." };
    const trimmed = raw.note.trim();
    note = trimmed === "" ? null : trimmed;
  }

  return { ok: true, value: { contestNumber, drawDate, amountCents, note } };
}

/** Valida o corpo de POST /api/loterias/apostas — cria uma aposta com um ou mais jogos de uma vez. */
export function parseSaveBetInput(body: unknown): ParseResult<SaveBetInput> {
  if (typeof body !== "object" || body === null) return { ok: false, error: "Dados inválidos." };
  const raw = body as Record<string, unknown>;

  const header = parseBetHeaderInput(raw);
  if (!header.ok) return header;

  if (!Array.isArray(raw.games) || raw.games.length === 0 || raw.games.length > MAX_GAMES_PER_SAVE) {
    return { ok: false, error: `Informe de 1 a ${MAX_GAMES_PER_SAVE} jogos.` };
  }

  const games: SaveGameInput[] = [];
  for (const rawGame of raw.games) {
    const parsed = parseGameInput(rawGame);
    if (!parsed.ok) return parsed;
    games.push(parsed.value);
  }

  return { ok: true, value: { ...header.value, games } };
}

export type UpdateBetInput = BetHeaderInput;

/** Valida o corpo de PATCH /api/loterias/apostas/[id] — mesmos campos "de cabeçalho" de SaveBetInput, sem os jogos. */
export function parseUpdateBetInput(body: unknown): ParseResult<UpdateBetInput> {
  if (typeof body !== "object" || body === null) return { ok: false, error: "Dados inválidos." };
  return parseBetHeaderInput(body as Record<string, unknown>);
}

/** Valida o corpo de POST /api/loterias/apostas/[id]/conferir — números realmente sorteados, informados manualmente. */
export function parseDrawnNumbersInput(body: unknown): ParseResult<number[]> {
  if (typeof body !== "object" || body === null) return { ok: false, error: "Dados inválidos." };
  const raw = (body as Record<string, unknown>).drawnNumbers;
  if (!Array.isArray(raw) || raw.length !== LOTOFACIL_CONFIG.drawnNumbers) {
    return { ok: false, error: `Informe exatamente ${LOTOFACIL_CONFIG.drawnNumbers} números sorteados.` };
  }
  const set = new Set<number>();
  for (const n of raw) {
    if (typeof n !== "number" || !Number.isInteger(n) || n < LOTOFACIL_CONFIG.minNumber || n > LOTOFACIL_CONFIG.maxNumber) {
      return { ok: false, error: "Números sorteados inválidos." };
    }
    set.add(n);
  }
  if (set.size !== raw.length) return { ok: false, error: "Números sorteados repetidos." };
  return { ok: true, value: [...(raw as number[])].sort((a, b) => a - b) };
}

/** Valida o corpo de PUT /api/loterias/configuracoes — limite mensal opcional, só para acompanhamento. */
export function parseSettingsInput(body: unknown): ParseResult<{ monthlyBudgetCents: number | null }> {
  if (typeof body !== "object" || body === null) return { ok: false, error: "Dados inválidos." };
  const raw = (body as Record<string, unknown>).monthlyBudgetCents;
  if (raw === null || raw === undefined) return { ok: true, value: { monthlyBudgetCents: null } };
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 0 || raw > MAX_AMOUNT_CENTS) {
    return { ok: false, error: "Limite mensal inválido." };
  }
  return { ok: true, value: { monthlyBudgetCents: raw } };
}

/** Valida o corpo de PATCH /api/loterias/jogos/[id] — só o favorito, por enquanto. */
export function parseFavoriteInput(body: unknown): ParseResult<{ isFavorite: boolean }> {
  if (typeof body !== "object" || body === null) return { ok: false, error: "Dados inválidos." };
  const raw = (body as Record<string, unknown>).isFavorite;
  if (typeof raw !== "boolean") return { ok: false, error: "Valor inválido." };
  return { ok: true, value: { isFavorite: raw } };
}
