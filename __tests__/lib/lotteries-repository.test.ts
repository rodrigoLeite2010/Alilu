// @vitest-environment node
//
// Repositório de "Meus Jogos" contra Postgres real em memória (PGlite,
// mesmas migrações do projeto — inclui 0012_loterias.sql): isolamento
// entre usuários, entre modalidades (Fase B), arrays de números
// (numbers/drawn_numbers), duplicidade, conferência de resultado e
// configurações.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../helpers/pglite-db";

let db: TestDb;
vi.mock("@/lib/db/client", () => ({
  getDb: () => db.sql,
  assertDatabaseConfigured: () => undefined,
}));

const repo = await import("@/lib/lotteries/backend/repository");

let userA: string;
let userB: string;

beforeEach(async () => {
  db = await createTestDb();
  [{ id: userA }, { id: userB }] = (await Promise.all([
    db.sql`insert into users (email) values ('a@example.com') returning id`,
    db.sql`insert into users (email) values ('b@example.com') returning id`,
  ])).map((rows) => rows[0]) as [{ id: string }, { id: string }];
});
afterEach(async () => {
  await db.close();
});

function game(
  numbers: number[],
  overrides: Partial<{ betSize: number; mode: "aleatorio" | "equilibrado" | "personalizado" | "diversificado"; month: number | null }> = {}
) {
  return {
    numbers,
    betSize: overrides.betSize ?? numbers.length,
    mode: overrides.mode ?? ("aleatorio" as const),
    month: overrides.month,
  };
}

const GAME_A = Array.from({ length: 15 }, (_, i) => i + 1); // 1..15
const GAME_B = Array.from({ length: 15 }, (_, i) => i + 6); // 6..20
const GAME_MEGASENA = [1, 2, 3, 4, 5, 6];
const GAME_DIA_DE_SORTE = [1, 2, 3, 4, 5, 6, 7];

describe("lotteries repository", () => {
  it("cria uma aposta com vários jogos e devolve tudo já persistido", async () => {
    const bet = await repo.createBetWithGames(
      userA,
      "lotofacil",
      { contestNumber: 3200, drawDate: "2026-10-01", amountCents: 500, note: "teste" },
      [game(GAME_A), game(GAME_B)]
    );

    expect(bet.contestNumber).toBe(3200);
    expect(bet.drawDate).toBe("2026-10-01");
    expect(bet.amountCents).toBe(500);
    expect(bet.modality).toBe("lotofacil");
    expect(bet.games).toHaveLength(2);
    expect(bet.games[0].numbers).toEqual(GAME_A);
    expect(bet.games[1].numbers).toEqual(GAME_B);
    expect(bet.games[0].modality).toBe("lotofacil");
    expect(bet.games[0].isFavorite).toBe(false);
    expect(bet.games[0].hits).toBeNull();
  });

  it("lista apenas as apostas do próprio usuário, com os jogos aninhados", async () => {
    await repo.createBetWithGames(userA, "lotofacil", { contestNumber: null, drawDate: null, amountCents: 0, note: null }, [game(GAME_A)]);
    await repo.createBetWithGames(userB, "lotofacil", { contestNumber: null, drawDate: null, amountCents: 0, note: null }, [game(GAME_B)]);

    const betsA = await repo.listBets(userA, "lotofacil");
    const betsB = await repo.listBets(userB, "lotofacil");

    expect(betsA).toHaveLength(1);
    expect(betsA[0].games[0].numbers).toEqual(GAME_A);
    expect(betsB).toHaveLength(1);
    expect(betsB[0].games[0].numbers).toEqual(GAME_B);
  });

  it("detecta duplicidade contra o histórico do próprio usuário, mas não entre usuários diferentes", async () => {
    await repo.createBetWithGames(userA, "lotofacil", { contestNumber: null, drawDate: null, amountCents: 0, note: null }, [game(GAME_A)]);

    const duplicatesForA = await repo.findDuplicateGameKeys(userA, "lotofacil", [GAME_A, GAME_B]);
    const duplicatesForB = await repo.findDuplicateGameKeys(userB, "lotofacil", [GAME_A]);

    expect(duplicatesForA.has(GAME_A.join("-"))).toBe(true);
    expect(duplicatesForA.has(GAME_B.join("-"))).toBe(false);
    expect(duplicatesForB.size).toBe(0);
  });

  it("atualiza o cabeçalho da aposta só se ela for do usuário", async () => {
    const bet = await repo.createBetWithGames(userA, "lotofacil", { contestNumber: null, drawDate: null, amountCents: 0, note: null }, [game(GAME_A)]);

    const updatedByOwner = await repo.updateBetHeader(userA, bet.id, {
      contestNumber: 3201,
      drawDate: "2026-10-08",
      amountCents: 750,
      note: "atualizado",
    });
    const updatedByOther = await repo.updateBetHeader(userB, bet.id, {
      contestNumber: 1,
      drawDate: null,
      amountCents: 0,
      note: null,
    });

    expect(updatedByOwner).toBe(true);
    expect(updatedByOther).toBe(false);

    const [reloaded] = await repo.listBets(userA, "lotofacil");
    expect(reloaded.contestNumber).toBe(3201);
    expect(reloaded.note).toBe("atualizado");
  });

  it("confere o resultado manualmente e calcula os acertos de cada jogo", async () => {
    const bet = await repo.createBetWithGames(userA, "lotofacil", { contestNumber: 3200, drawDate: "2026-10-01", amountCents: 0, note: null }, [
      game(GAME_A),
      game(GAME_B),
    ]);

    // Sorteio "oficial" (informado manualmente) = exatamente GAME_A: 15
    // acertos para o jogo A, e a interseção para o jogo B.
    const conferido = await repo.recordDrawnNumbers(userA, bet.id, GAME_A);

    expect(conferido).not.toBeNull();
    expect(conferido!.drawnNumbers).toEqual(GAME_A);
    expect(conferido!.checkedAt).not.toBeNull();
    const gameAResult = conferido!.games.find((g) => g.numbers.join(",") === GAME_A.join(","));
    const gameBResult = conferido!.games.find((g) => g.numbers.join(",") === GAME_B.join(","));
    expect(gameAResult?.hits).toBe(15);
    // GAME_A = 1..15, GAME_B = 6..20 → interseção = 6..15 = 10 números.
    expect(gameBResult?.hits).toBe(10);
  });

  it("favorita, exclui um jogo e exclui uma aposta inteira, sempre restrito ao dono", async () => {
    const bet = await repo.createBetWithGames(userA, "lotofacil", { contestNumber: null, drawDate: null, amountCents: 0, note: null }, [
      game(GAME_A),
      game(GAME_B),
    ]);
    const [gameA, gameB] = bet.games;

    expect(await repo.setGameFavorite(userB, gameA.id, true)).toBe(false);
    expect(await repo.setGameFavorite(userA, gameA.id, true)).toBe(true);

    expect(await repo.deleteGame(userB, gameB.id)).toBe(false);
    expect(await repo.deleteGame(userA, gameB.id)).toBe(true);

    const [reloaded] = await repo.listBets(userA, "lotofacil");
    expect(reloaded.games).toHaveLength(1);
    expect(reloaded.games[0].isFavorite).toBe(true);

    expect(await repo.deleteBet(userB, bet.id)).toBe(false);
    expect(await repo.deleteBet(userA, bet.id)).toBe(true);
    expect(await repo.listBets(userA, "lotofacil")).toHaveLength(0);
  });

  it("lista só os números dos jogos salvos, para estatística/diversificação", async () => {
    await repo.createBetWithGames(userA, "lotofacil", { contestNumber: null, drawDate: null, amountCents: 0, note: null }, [game(GAME_A), game(GAME_B)]);
    const numbers = await repo.listAllSavedGameNumbers(userA, "lotofacil");
    expect(numbers).toHaveLength(2);
    expect(numbers).toContainEqual(GAME_A);
    expect(numbers).toContainEqual(GAME_B);
  });

  it("salva e lê o limite mensal de investimento, e calcula o total investido", async () => {
    expect((await repo.getSettings(userA)).monthlyBudgetCents).toBeNull();
    await repo.saveSettings(userA, { monthlyBudgetCents: 10000 });
    expect((await repo.getSettings(userA)).monthlyBudgetCents).toBe(10000);

    await repo.createBetWithGames(userA, "lotofacil", { contestNumber: null, drawDate: null, amountCents: 300, note: null }, [game(GAME_A)]);
    await repo.createBetWithGames(userA, "lotofacil", { contestNumber: null, drawDate: null, amountCents: 200, note: null }, [game(GAME_B)]);

    const investment = await repo.getInvestmentSummary(userA, "lotofacil");
    expect(investment.totalCents).toBe(500);
    expect(investment.currentMonthCents).toBe(500);
  });
});

describe("lotteries repository — isolamento entre modalidades (Fase B: Mega-Sena ao lado da Lotofácil)", () => {
  it("listBets nunca mistura jogos de modalidades diferentes do mesmo usuário", async () => {
    await repo.createBetWithGames(userA, "lotofacil", { contestNumber: null, drawDate: null, amountCents: 0, note: null }, [game(GAME_A)]);
    await repo.createBetWithGames(userA, "mega-sena", { contestNumber: null, drawDate: null, amountCents: 0, note: null }, [game(GAME_MEGASENA)]);

    const lotofacilBets = await repo.listBets(userA, "lotofacil");
    const megasenaBets = await repo.listBets(userA, "mega-sena");

    expect(lotofacilBets).toHaveLength(1);
    expect(lotofacilBets[0].games[0].numbers).toEqual(GAME_A);
    expect(lotofacilBets[0].modality).toBe("lotofacil");

    expect(megasenaBets).toHaveLength(1);
    expect(megasenaBets[0].games[0].numbers).toEqual(GAME_MEGASENA);
    expect(megasenaBets[0].modality).toBe("mega-sena");
  });

  it("listAllSavedGameNumbers nunca mistura números de modalidades diferentes do mesmo usuário", async () => {
    await repo.createBetWithGames(userA, "lotofacil", { contestNumber: null, drawDate: null, amountCents: 0, note: null }, [game(GAME_A), game(GAME_B)]);
    await repo.createBetWithGames(userA, "mega-sena", { contestNumber: null, drawDate: null, amountCents: 0, note: null }, [game(GAME_MEGASENA)]);

    const lotofacilNumbers = await repo.listAllSavedGameNumbers(userA, "lotofacil");
    const megasenaNumbers = await repo.listAllSavedGameNumbers(userA, "mega-sena");

    expect(lotofacilNumbers).toHaveLength(2);
    expect(lotofacilNumbers).toContainEqual(GAME_A);
    expect(lotofacilNumbers).toContainEqual(GAME_B);
    expect(lotofacilNumbers).not.toContainEqual(GAME_MEGASENA);

    expect(megasenaNumbers).toHaveLength(1);
    expect(megasenaNumbers).toContainEqual(GAME_MEGASENA);
  });

  it("findDuplicateGameKeys só detecta duplicidade dentro da mesma modalidade", async () => {
    // O mesmo conjunto de 6 números salvo como jogo da Mega-Sena não deve
    // aparecer como duplicata ao consultar a Lotofácil (mesmo que, em
    // teoria, os números coincidissem entre as duas faixas).
    await repo.createBetWithGames(userA, "mega-sena", { contestNumber: null, drawDate: null, amountCents: 0, note: null }, [game(GAME_MEGASENA)]);

    const duplicatesInLotofacil = await repo.findDuplicateGameKeys(userA, "lotofacil", [GAME_MEGASENA]);
    const duplicatesInMegasena = await repo.findDuplicateGameKeys(userA, "mega-sena", [GAME_MEGASENA]);

    expect(duplicatesInLotofacil.size).toBe(0);
    expect(duplicatesInMegasena.has(GAME_MEGASENA.join("-"))).toBe(true);
  });

  it("getInvestmentSummary soma só o valor apostado NAQUELA modalidade", async () => {
    await repo.createBetWithGames(userA, "lotofacil", { contestNumber: null, drawDate: null, amountCents: 300, note: null }, [game(GAME_A)]);
    await repo.createBetWithGames(userA, "mega-sena", { contestNumber: null, drawDate: null, amountCents: 600, note: null }, [game(GAME_MEGASENA)]);

    const lotofacilInvestment = await repo.getInvestmentSummary(userA, "lotofacil");
    const megasenaInvestment = await repo.getInvestmentSummary(userA, "mega-sena");

    expect(lotofacilInvestment.totalCents).toBe(300);
    expect(megasenaInvestment.totalCents).toBe(600);
  });

  it("updateBetHeader/deleteBet/deleteGame/setGameFavorite continuam restritos só ao user_id (sem filtro de modalidade, já que o id da aposta/jogo já é único)", async () => {
    const megasenaBet = await repo.createBetWithGames(userA, "mega-sena", { contestNumber: null, drawDate: null, amountCents: 0, note: null }, [
      game(GAME_MEGASENA),
    ]);

    expect(await repo.updateBetHeader(userA, megasenaBet.id, { contestNumber: 2700, drawDate: null, amountCents: 10, note: null })).toBe(true);
    expect(await repo.setGameFavorite(userA, megasenaBet.games[0].id, true)).toBe(true);
    expect(await repo.deleteGame(userA, megasenaBet.games[0].id)).toBe(true);
    expect(await repo.deleteBet(userA, megasenaBet.id)).toBe(true);
    expect(await repo.listBets(userA, "mega-sena")).toHaveLength(0);
  });
});

describe("lotteries repository — Dia de Sorte (Fase B: Mês da Sorte, segunda dimensão exclusiva desta modalidade)", () => {
  it("salva um jogo com month e lê de volta corretamente", async () => {
    const bet = await repo.createBetWithGames(
      userA,
      "dia-de-sorte",
      { contestNumber: null, drawDate: null, amountCents: 0, note: null },
      [game(GAME_DIA_DE_SORTE, { betSize: 7, month: 5 })]
    );

    expect(bet.modality).toBe("dia-de-sorte");
    expect(bet.games[0].month).toBe(5);
    expect(bet.drawnMonth).toBeNull();

    const [reloaded] = await repo.listBets(userA, "dia-de-sorte");
    expect(reloaded.games[0].month).toBe(5);
  });

  it("confere com drawnMonth e lê de volta corretamente", async () => {
    const bet = await repo.createBetWithGames(
      userA,
      "dia-de-sorte",
      { contestNumber: null, drawDate: null, amountCents: 0, note: null },
      [game(GAME_DIA_DE_SORTE, { betSize: 7, month: 5 })]
    );

    const conferido = await repo.recordDrawnNumbers(userA, bet.id, GAME_DIA_DE_SORTE, 5);

    expect(conferido).not.toBeNull();
    expect(conferido!.drawnMonth).toBe(5);
    expect(conferido!.games[0].hits).toBe(7);
    expect(conferido!.games[0].month).toBe(5);

    const [reloaded] = await repo.listBets(userA, "dia-de-sorte");
    expect(reloaded.drawnMonth).toBe(5);
  });

  it("confere sem informar drawnMonth (default) grava drawn_month null, mesmo para uma aposta do Dia de Sorte", async () => {
    const bet = await repo.createBetWithGames(
      userA,
      "dia-de-sorte",
      { contestNumber: null, drawDate: null, amountCents: 0, note: null },
      [game(GAME_DIA_DE_SORTE, { betSize: 7, month: 5 })]
    );

    const conferido = await repo.recordDrawnNumbers(userA, bet.id, GAME_DIA_DE_SORTE);
    expect(conferido!.drawnMonth).toBeNull();
  });

  it("um fluxo Lotofácil-style (sem month/drawnMonth) continua devolvendo month/drawnMonth null e 100% inalterado (regressão)", async () => {
    const bet = await repo.createBetWithGames(
      userA,
      "lotofacil",
      { contestNumber: 3200, drawDate: "2026-10-01", amountCents: 500, note: "teste" },
      [game(GAME_A)]
    );

    expect(bet.games[0].month).toBeNull();
    expect(bet.drawnMonth).toBeNull();

    const conferido = await repo.recordDrawnNumbers(userA, bet.id, GAME_A);
    expect(conferido!.drawnMonth).toBeNull();
    expect(conferido!.drawnNumbers).toEqual(GAME_A);
    expect(conferido!.games[0].hits).toBe(15);

    const [reloaded] = await repo.listBets(userA, "lotofacil");
    expect(reloaded.games[0].month).toBeNull();
    expect(reloaded.drawnMonth).toBeNull();
  });
});
