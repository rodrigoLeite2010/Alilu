import "server-only";
import { getDb } from "@/lib/db/client";
import type { SaveBetInput, SaveGameInput } from "../validation";
import type { InvestmentSummary, LotteryBet, LotteryGame, LotterySettings } from "../types";

/**
 * Acesso ao banco de "Meus Jogos" (histórico privado — Fase 2 da
 * Lotofácil, generalizado na Fase B para qualquer modalidade, ver
 * lib/lotteries/modalities.ts). TODA consulta filtra por user_id — o
 * usuário nunca enxerga nem altera aposta/jogo de outra pessoa. Mesmo
 * padrão de lib/financas/backend/repository.ts (fin_entries/fin_goals):
 * sem ORM, SQL direto via getDb(), valores monetários em centavos, datas
 * como "YYYY-MM-DD" (to_char). O driver HTTP (getDb()) não mantém
 * transação entre chamadas (ver lib/db/client.ts) — como o módulo
 * financeiro, cada insert/update é uma operação avulsa; para o volume
 * aqui (no máximo 50 jogos por salvamento), o risco de uma falha parcial
 * no meio de um Promise.all é aceito, no mesmo espírito do resto do
 * projeto.
 *
 * As funções que agregam/listam por modalidade (findDuplicateGameKeys,
 * createBetWithGames, listBets, listAllSavedGameNumbers,
 * getInvestmentSummary) recebem `modality` como parâmetro explícito. As
 * que operam sobre uma única linha pelo próprio `id` (updateBetHeader,
 * deleteBet, deleteGame, setGameFavorite, recordDrawnNumbers) não
 * precisam — o `id` (UUID) somado ao `user_id` já é uma checagem de posse
 * suficiente e segura, então não filtram mais por modalidade.
 */

function toGame(row: Record<string, unknown>): LotteryGame {
  return {
    id: row.id as string,
    betId: row.betId as string,
    modality: row.modality as string,
    numbers: row.numbers as number[],
    betSize: Number(row.betSize),
    mode: row.mode as LotteryGame["mode"],
    isFavorite: row.isFavorite as boolean,
    hits: row.hits === null || row.hits === undefined ? null : Number(row.hits),
    month: row.month === null || row.month === undefined ? null : Number(row.month),
    createdAt: row.createdAt as string,
  };
}

function toBet(row: Record<string, unknown>): Omit<LotteryBet, "games"> {
  return {
    id: row.id as string,
    modality: row.modality as string,
    contestNumber: row.contestNumber === null || row.contestNumber === undefined ? null : Number(row.contestNumber),
    drawDate: (row.drawDate as string | null) ?? null,
    amountCents: Number(row.amountCents),
    note: (row.note as string | null) ?? null,
    drawnNumbers: (row.drawnNumbers as number[] | null) ?? null,
    drawnMonth: row.drawnMonth === null || row.drawnMonth === undefined ? null : Number(row.drawnMonth),
    checkedAt: (row.checkedAt as string | null) ?? null,
    createdAt: row.createdAt as string,
  };
}

/**
 * Quais dos conjuntos de números em `candidates` já existem salvos pelo
 * usuário NAQUELA MODALIDADE (mesmo conjunto — a aplicação sempre grava
 * `numbers` ordenado, então compara igualdade de array direto). Usado
 * para "detecção de duplicidade" antes de salvar (Fase 2). A chave de
 * cada conjunto é os números unidos por "-" (ex.: "1-2-3-...").
 */
export async function findDuplicateGameKeys(
  userId: string,
  modality: string,
  candidates: readonly (readonly number[])[]
): Promise<Set<string>> {
  if (candidates.length === 0) return new Set();
  const db = getDb();
  const rows = await db`
    select numbers from lottery_games where user_id = ${userId} and modality = ${modality}
  `;
  const existingKeys = new Set(rows.map((row) => (row.numbers as number[]).join("-")));
  const duplicates = new Set<string>();
  for (const candidate of candidates) {
    const key = candidate.join("-");
    if (existingKeys.has(key)) duplicates.add(key);
  }
  return duplicates;
}

/**
 * Cria uma aposta com um ou mais jogos de uma vez. Não filtra duplicatas —
 * isso é responsabilidade de quem chama (ver findDuplicateGameKeys),
 * porque a rota decide se avisa e pula, ou se ainda assim quer salvar.
 */
export async function createBetWithGames(
  userId: string,
  modality: string,
  header: Pick<SaveBetInput, "contestNumber" | "drawDate" | "amountCents" | "note">,
  games: readonly SaveGameInput[]
): Promise<LotteryBet> {
  const db = getDb();
  const betRows = await db`
    insert into lottery_bets (user_id, modality, contest_number, draw_date, amount_cents, note)
    values (${userId}, ${modality}, ${header.contestNumber}, ${header.drawDate}::date, ${header.amountCents}, ${header.note})
    returning id, modality, contest_number as "contestNumber", to_char(draw_date, 'YYYY-MM-DD') as "drawDate",
      amount_cents::float8 as "amountCents", note, drawn_numbers as "drawnNumbers", drawn_month as "drawnMonth",
      checked_at::text as "checkedAt", created_at::text as "createdAt"
  `;
  const bet = toBet(betRows[0] as Record<string, unknown>);

  const gameRowLists = await Promise.all(
    games.map(
      (game) => db`
        insert into lottery_games (bet_id, user_id, modality, numbers, bet_size, mode, month)
        values (${bet.id}, ${userId}, ${modality}, ${game.numbers}, ${game.betSize}, ${game.mode}, ${game.month ?? null})
        returning id, bet_id as "betId", modality, numbers, bet_size as "betSize", mode,
          is_favorite as "isFavorite", hits, month, created_at::text as "createdAt"
      `
    )
  );
  const createdGames = gameRowLists.map((rows) => toGame(rows[0] as Record<string, unknown>));

  return { ...bet, games: createdGames };
}

/** Apostas do usuário NAQUELA MODALIDADE, com seus jogos, mais recentes primeiro. */
export async function listBets(userId: string, modality: string, limit = 100): Promise<LotteryBet[]> {
  const db = getDb();
  const betRows = await db`
    select id, modality, contest_number as "contestNumber", to_char(draw_date, 'YYYY-MM-DD') as "drawDate",
      amount_cents::float8 as "amountCents", note, drawn_numbers as "drawnNumbers", drawn_month as "drawnMonth",
      checked_at::text as "checkedAt", created_at::text as "createdAt"
    from lottery_bets
    where user_id = ${userId} and modality = ${modality}
    order by created_at desc
    limit ${limit}
  `;
  if (betRows.length === 0) return [];

  const betIds = betRows.map((row) => row.id as string);
  const gameRows = await db`
    select id, bet_id as "betId", modality, numbers, bet_size as "betSize", mode,
      is_favorite as "isFavorite", hits, month, created_at::text as "createdAt"
    from lottery_games
    where bet_id = any(${betIds}) and user_id = ${userId}
    order by created_at
  `;

  const gamesByBet = new Map<string, LotteryGame[]>();
  for (const row of gameRows) {
    const game = toGame(row as Record<string, unknown>);
    const list = gamesByBet.get(game.betId) ?? [];
    list.push(game);
    gamesByBet.set(game.betId, list);
  }

  return betRows.map((row) => {
    const bet = toBet(row as Record<string, unknown>);
    return { ...bet, games: gamesByBet.get(bet.id) ?? [] };
  });
}

/** Só os números dos jogos salvos NAQUELA MODALIDADE (sem metadado) — para estatística pessoal, diversificação e exportação. */
export async function listAllSavedGameNumbers(userId: string, modality: string, limit = 1000): Promise<number[][]> {
  const db = getDb();
  const rows = await db`
    select numbers from lottery_games where user_id = ${userId} and modality = ${modality}
    order by created_at desc
    limit ${limit}
  `;
  return rows.map((row) => row.numbers as number[]);
}

export interface BetHeaderUpdate {
  contestNumber: number | null;
  drawDate: string | null;
  amountCents: number;
  note: string | null;
}

/** Retorna false se a aposta não existe ou não é do usuário. */
export async function updateBetHeader(userId: string, betId: string, input: BetHeaderUpdate): Promise<boolean> {
  const db = getDb();
  const rows = await db`
    update lottery_bets set
      contest_number = ${input.contestNumber}, draw_date = ${input.drawDate}::date,
      amount_cents = ${input.amountCents}, note = ${input.note}, updated_at = now()
    where id = ${betId} and user_id = ${userId}
    returning id
  `;
  return rows.length > 0;
}

/** Exclui a aposta e, em cascata, seus jogos (on delete cascade na migration). Retorna false se não existe ou não é do usuário. */
export async function deleteBet(userId: string, betId: string): Promise<boolean> {
  const db = getDb();
  const rows = await db`
    delete from lottery_bets where id = ${betId} and user_id = ${userId} returning id
  `;
  return rows.length > 0;
}

/** Exclui um jogo individual (a aposta continua existindo, mesmo que fique sem nenhum jogo). Retorna false se não existe ou não é do usuário. */
export async function deleteGame(userId: string, gameId: string): Promise<boolean> {
  const db = getDb();
  const rows = await db`
    delete from lottery_games where id = ${gameId} and user_id = ${userId} returning id
  `;
  return rows.length > 0;
}

/** Retorna false se o jogo não existe ou não é do usuário. */
export async function setGameFavorite(userId: string, gameId: string, isFavorite: boolean): Promise<boolean> {
  const db = getDb();
  const rows = await db`
    update lottery_games set is_favorite = ${isFavorite}
    where id = ${gameId} and user_id = ${userId}
    returning id
  `;
  return rows.length > 0;
}

/**
 * Conferência manual (Seção "conferência de resultado" da Fase 2): grava
 * os números REALMENTE sorteados (informados pelo próprio usuário — nunca
 * de nenhuma fonte automática) na aposta, e calcula/grava os acertos de
 * cada jogo dela. `drawnMonth` (Fase B) é o Mês da Sorte REALMENTE
 * sorteado, também informado manualmente — só usado pelo Dia de Sorte; o
 * valor padrão `null` mantém toda chamada existente (Lotofácil/Mega-Sena/
 * Quina/Lotomania, que nunca passam esse quarto argumento) idêntica a
 * antes. Retorna a aposta atualizada com os jogos já conferidos, ou null
 * se a aposta não existe/não é do usuário.
 */
export async function recordDrawnNumbers(
  userId: string,
  betId: string,
  drawnNumbers: readonly number[],
  drawnMonth: number | null = null
): Promise<LotteryBet | null> {
  const db = getDb();
  const betRows = await db`
    update lottery_bets set drawn_numbers = ${drawnNumbers}, drawn_month = ${drawnMonth}, checked_at = now(), updated_at = now()
    where id = ${betId} and user_id = ${userId}
    returning id, modality, contest_number as "contestNumber", to_char(draw_date, 'YYYY-MM-DD') as "drawDate",
      amount_cents::float8 as "amountCents", note, drawn_numbers as "drawnNumbers", drawn_month as "drawnMonth",
      checked_at::text as "checkedAt", created_at::text as "createdAt"
  `;
  if (betRows.length === 0) return null;
  const bet = toBet(betRows[0] as Record<string, unknown>);

  const gameRows = await db`
    select id, bet_id as "betId", modality, numbers, bet_size as "betSize", mode,
      is_favorite as "isFavorite", hits, month, created_at::text as "createdAt"
    from lottery_games where bet_id = ${betId} and user_id = ${userId}
  `;
  const drawnSet = new Set(drawnNumbers);
  const updatedGames = await Promise.all(
    gameRows.map(async (row) => {
      const game = toGame(row as Record<string, unknown>);
      const hits = game.numbers.filter((n) => drawnSet.has(n)).length;
      await db`update lottery_games set hits = ${hits} where id = ${game.id}`;
      return { ...game, hits };
    })
  );

  return { ...bet, games: updatedGames };
}

export async function getSettings(userId: string): Promise<LotterySettings> {
  const db = getDb();
  const rows = await db`
    select monthly_budget_cents::float8 as "monthlyBudgetCents" from lottery_settings where user_id = ${userId}
  `;
  const value = rows[0]?.monthlyBudgetCents;
  return { monthlyBudgetCents: value === null || value === undefined ? null : Number(value) };
}

export async function saveSettings(userId: string, settings: LotterySettings): Promise<void> {
  const db = getDb();
  await db`
    insert into lottery_settings (user_id, monthly_budget_cents)
    values (${userId}, ${settings.monthlyBudgetCents})
    on conflict (user_id) do update set monthly_budget_cents = excluded.monthly_budget_cents, updated_at = now()
  `;
}

/** Total investido (soma de amount_cents de todas as apostas) NAQUELA MODALIDADE e o total do mês corrente — só para acompanhamento, nunca alerta. */
export async function getInvestmentSummary(userId: string, modality: string): Promise<InvestmentSummary> {
  const db = getDb();
  const rows = await db`
    select
      coalesce(sum(amount_cents), 0)::float8 as "totalCents",
      coalesce(sum(amount_cents) filter (where date_trunc('month', created_at) = date_trunc('month', now())), 0)::float8 as "currentMonthCents"
    from lottery_bets
    where user_id = ${userId} and modality = ${modality}
  `;
  return {
    totalCents: Number(rows[0]?.totalCents ?? 0),
    currentMonthCents: Number(rows[0]?.currentMonthCents ?? 0),
  };
}
