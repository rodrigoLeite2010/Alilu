import { isValidISODate } from "@/lib/financas/dates";
import { LOTTERY_MODES, type LotteryApiConfig, type LotteryMode } from "./modalities";

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

const MAX_AMOUNT_CENTS = 100_000_000_00; // R$ 100 milhões — mesmo teto do módulo financeiro.

export interface SaveGameInput {
  numbers: number[];
  betSize: number;
  mode: LotteryMode;
  /** Preenchido pela própria validação (parseGameInput) a partir do `config.id` da rota — opcional para quem monta o objeto antes de validar (ex.: o gerador no cliente, antes de enviar para a API). */
  modality?: string;
  /**
   * Mês da Sorte (1-12) escolhido para este jogo — só existe/é exigido
   * quando `config.hasMonthPick` (só o Dia de Sorte, por enquanto).
   * Opcional pelo mesmo motivo de `modality`: quem monta o objeto antes
   * de validar (o gerador no cliente) simplesmente não inclui o campo
   * para as outras quatro modalidades. Depois de validado por
   * parseGameInput, sempre vem preenchido (com o mês escolhido, ou
   * `null` fora do Dia de Sorte).
   */
  month?: number | null;
}

export interface SaveBetInput {
  contestNumber: number | null;
  drawDate: string | null;
  amountCents: number;
  note: string | null;
  modality: string;
  games: SaveGameInput[];
}

function validGameNumbers(numbers: unknown, betSize: number, config: LotteryApiConfig): numbers is number[] {
  if (!Array.isArray(numbers) || numbers.length !== betSize) return false;
  const set = new Set<number>();
  for (const n of numbers) {
    if (
      typeof n !== "number" ||
      !Number.isInteger(n) ||
      n < config.minNumber ||
      n > config.maxNumber
    ) {
      return false;
    }
    set.add(n);
  }
  return set.size === numbers.length;
}

function parseGameInput(raw: unknown, config: LotteryApiConfig): ParseResult<SaveGameInput> {
  if (typeof raw !== "object" || raw === null) return { ok: false, error: "Jogo inválido." };
  const value = raw as Record<string, unknown>;

  const betSize = value.betSize;
  if (
    typeof betSize !== "number" ||
    !Number.isInteger(betSize) ||
    betSize < config.minBetNumbers ||
    betSize > config.maxBetNumbers
  ) {
    return { ok: false, error: `Escolha entre ${config.minBetNumbers} e ${config.maxBetNumbers} números.` };
  }

  if (!validGameNumbers(value.numbers, betSize, config)) {
    return { ok: false, error: "Números do jogo inválidos ou repetidos." };
  }

  const mode = value.mode;
  if (typeof mode !== "string" || !LOTTERY_MODES.includes(mode as LotteryMode)) {
    return { ok: false, error: "Modo de geração inválido." };
  }

  // Mês da Sorte: só exigido/validado quando a modalidade tem essa segunda
  // dimensão (Dia de Sorte) — em toda outra modalidade, força null mesmo
  // que o cliente tenha enviado algo em `month` (defensivo: um bug em
  // outra parte do código não consegue "vazar" um mês para uma modalidade
  // que não tem essa noção).
  let month: number | null = null;
  if (config.hasMonthPick) {
    const rawMonth = value.month;
    if (typeof rawMonth !== "number" || !Number.isInteger(rawMonth) || rawMonth < 1 || rawMonth > 12) {
      return { ok: false, error: "Escolha um mês da sorte entre 1 e 12." };
    }
    month = rawMonth;
  }

  return {
    ok: true,
    value: {
      numbers: [...(value.numbers as number[])].sort((a, b) => a - b),
      betSize,
      mode: mode as LotteryMode,
      modality: config.id,
      month,
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

/** Valida o corpo de POST /api/loterias/apostas — cria uma aposta com um ou mais jogos de uma vez. `config` já resolvido pela rota a partir de `modality`. */
export function parseSaveBetInput(body: unknown, config: LotteryApiConfig): ParseResult<SaveBetInput> {
  if (typeof body !== "object" || body === null) return { ok: false, error: "Dados inválidos." };
  const raw = body as Record<string, unknown>;

  const header = parseBetHeaderInput(raw);
  if (!header.ok) return header;

  if (!Array.isArray(raw.games) || raw.games.length === 0 || raw.games.length > MAX_GAMES_PER_SAVE) {
    return { ok: false, error: `Informe de 1 a ${MAX_GAMES_PER_SAVE} jogos.` };
  }

  const games: SaveGameInput[] = [];
  for (const rawGame of raw.games) {
    const parsed = parseGameInput(rawGame, config);
    if (!parsed.ok) return parsed;
    games.push(parsed.value);
  }

  return { ok: true, value: { ...header.value, modality: config.id, games } };
}

export type UpdateBetInput = BetHeaderInput;

/** Valida o corpo de PATCH /api/loterias/apostas/[id] — mesmos campos "de cabeçalho" de SaveBetInput, sem os jogos. */
export function parseUpdateBetInput(body: unknown): ParseResult<UpdateBetInput> {
  if (typeof body !== "object" || body === null) return { ok: false, error: "Dados inválidos." };
  return parseBetHeaderInput(body as Record<string, unknown>);
}

export interface DrawnNumbersInput {
  drawnNumbers: number[];
  /** Mês REALMENTE sorteado, informado manualmente — só exigido/aceito quando `config.hasMonthPick` (Dia de Sorte); `null` em toda outra modalidade, mesmo que enviado no corpo. */
  drawnMonth: number | null;
}

/** Valida o corpo de POST /api/loterias/apostas/[id]/conferir — números (e, no Dia de Sorte, o mês) realmente sorteados, informados manualmente. `config` já resolvido pela rota a partir de `modality`. */
export function parseDrawnNumbersInput(body: unknown, config: LotteryApiConfig): ParseResult<DrawnNumbersInput> {
  if (typeof body !== "object" || body === null) return { ok: false, error: "Dados inválidos." };
  const rawBody = body as Record<string, unknown>;
  const raw = rawBody.drawnNumbers;
  if (!Array.isArray(raw) || raw.length !== config.drawnNumbers) {
    return { ok: false, error: `Informe exatamente ${config.drawnNumbers} números sorteados.` };
  }
  const set = new Set<number>();
  for (const n of raw) {
    if (typeof n !== "number" || !Number.isInteger(n) || n < config.minNumber || n > config.maxNumber) {
      return { ok: false, error: "Números sorteados inválidos." };
    }
    set.add(n);
  }
  if (set.size !== raw.length) return { ok: false, error: "Números sorteados repetidos." };

  let drawnMonth: number | null = null;
  if (config.hasMonthPick) {
    const rawMonth = rawBody.drawnMonth;
    if (typeof rawMonth !== "number" || !Number.isInteger(rawMonth) || rawMonth < 1 || rawMonth > 12) {
      return { ok: false, error: "Informe o mês sorteado, entre 1 e 12." };
    }
    drawnMonth = rawMonth;
  }

  return { ok: true, value: { drawnNumbers: [...(raw as number[])].sort((a, b) => a - b), drawnMonth } };
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
