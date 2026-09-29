import { describe, expect, it } from "vitest";
import { getLotteryApiConfig } from "@/lib/lotteries/modalities";
import {
  parseDrawnNumbersInput,
  parseFavoriteInput,
  parseSaveBetInput,
  parseSettingsInput,
  parseUpdateBetInput,
} from "@/lib/lotteries/validation";

const LOTOFACIL = getLotteryApiConfig("lotofacil")!;
const MEGASENA = getLotteryApiConfig("mega-sena")!;
const DIA_DE_SORTE = getLotteryApiConfig("dia-de-sorte")!;

const VALID_GAME = { numbers: Array.from({ length: 15 }, (_, i) => i + 1), betSize: 15, mode: "aleatorio" as const };

describe("lotteries/validation — parseSaveBetInput", () => {
  it("aceita um corpo mínimo válido (um jogo, sem concurso/data/valor/observação)", () => {
    const result = parseSaveBetInput({ games: [VALID_GAME] }, LOTOFACIL);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.games).toHaveLength(1);
      expect(result.value.modality).toBe("lotofacil");
      expect(result.value.games[0].modality).toBe("lotofacil");
      expect(result.value.contestNumber).toBeNull();
      expect(result.value.amountCents).toBe(0);
    }
  });

  it("ordena os números do jogo mesmo se vierem fora de ordem", () => {
    const shuffled = { ...VALID_GAME, numbers: [15, 3, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] };
    const result = parseSaveBetInput({ games: [shuffled] }, LOTOFACIL);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.games[0].numbers).toEqual(VALID_GAME.numbers);
  });

  it("rejeita quando 'games' está vazio ou ausente", () => {
    expect(parseSaveBetInput({ games: [] }, LOTOFACIL).ok).toBe(false);
    expect(parseSaveBetInput({}, LOTOFACIL).ok).toBe(false);
  });

  it("rejeita mais de 50 jogos em um único salvamento", () => {
    const games = Array.from({ length: 51 }, () => VALID_GAME);
    expect(parseSaveBetInput({ games }, LOTOFACIL).ok).toBe(false);
  });

  it("rejeita um jogo com números repetidos", () => {
    const withDuplicate = { ...VALID_GAME, numbers: [...VALID_GAME.numbers.slice(0, 14), VALID_GAME.numbers[0]] };
    expect(parseSaveBetInput({ games: [withDuplicate] }, LOTOFACIL).ok).toBe(false);
  });

  it("rejeita um jogo cujo tamanho não bate com betSize", () => {
    expect(parseSaveBetInput({ games: [{ ...VALID_GAME, betSize: 16 }] }, LOTOFACIL).ok).toBe(false);
  });

  it("rejeita modo de geração desconhecido", () => {
    expect(parseSaveBetInput({ games: [{ ...VALID_GAME, mode: "adivinhacao" }] }, LOTOFACIL).ok).toBe(false);
  });

  it("rejeita número de concurso <= 0 e data de sorteio inválida", () => {
    expect(parseSaveBetInput({ contestNumber: 0, games: [VALID_GAME] }, LOTOFACIL).ok).toBe(false);
    expect(parseSaveBetInput({ drawDate: "31/12/2026", games: [VALID_GAME] }, LOTOFACIL).ok).toBe(false);
  });

  it("rejeita valor apostado negativo", () => {
    expect(parseSaveBetInput({ amountCents: -1, games: [VALID_GAME] }, LOTOFACIL).ok).toBe(false);
  });

  it("aceita e recorta observação, tratando string vazia como null", () => {
    const result = parseSaveBetInput({ note: "  aposta do mês  ", games: [VALID_GAME] }, LOTOFACIL);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.note).toBe("aposta do mês");

    const empty = parseSaveBetInput({ note: "   ", games: [VALID_GAME] }, LOTOFACIL);
    expect(empty.ok).toBe(true);
    if (empty.ok) expect(empty.value.note).toBeNull();
  });
});

describe("lotteries/validation — parseSaveBetInput com config da Mega-Sena (Fase B: parametrização por modalidade)", () => {
  const VALID_MEGASENA_GAME = { numbers: [1, 2, 3, 4, 5, 60], betSize: 6, mode: "aleatorio" as const };

  it("aceita uma aposta de 6 a 60 números sob a config da Mega-Sena", () => {
    const result = parseSaveBetInput({ games: [VALID_MEGASENA_GAME] }, MEGASENA);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.modality).toBe("mega-sena");
      expect(result.value.games[0].modality).toBe("mega-sena");
      expect(result.value.games[0].numbers).toEqual([1, 2, 3, 4, 5, 60]);
    }
  });

  it("rejeita um jogo com número fora da faixa 1-60 sob a config da Mega-Sena", () => {
    const outOfRange = { numbers: [1, 2, 3, 4, 5, 99], betSize: 6, mode: "aleatorio" as const };
    expect(parseSaveBetInput({ games: [outOfRange] }, MEGASENA).ok).toBe(false);
  });

  it("rejeita um jogo de 15-25 números (faixa da Lotofácil) sob a config da Mega-Sena quando o betSize excede o teto de 20", () => {
    const lotofacilStyle = { numbers: Array.from({ length: 25 }, (_, i) => i + 1), betSize: 25, mode: "aleatorio" as const };
    expect(parseSaveBetInput({ games: [lotofacilStyle] }, MEGASENA).ok).toBe(false);
  });

  it("rejeita a mesma aposta válida da Mega-Sena quando avaliada sob a config da Lotofácil (faixa 1-25, jogo tem o número 60)", () => {
    expect(parseSaveBetInput({ games: [VALID_MEGASENA_GAME] }, LOTOFACIL).ok).toBe(false);
  });
});

describe("lotteries/validation — parseSaveBetInput com config do Dia de Sorte (Fase B: Mês da Sorte, segunda dimensão exclusiva desta modalidade)", () => {
  const VALID_DIA_DE_SORTE_GAME = { numbers: [1, 2, 3, 4, 5, 6, 7], betSize: 7, mode: "aleatorio" as const, month: 5 };

  it("aceita um jogo com month entre 1 e 12 sob a config do Dia de Sorte", () => {
    const result = parseSaveBetInput({ games: [VALID_DIA_DE_SORTE_GAME] }, DIA_DE_SORTE);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.modality).toBe("dia-de-sorte");
      expect(result.value.games[0].month).toBe(5);
    }
  });

  it("rejeita quando month está ausente sob a config do Dia de Sorte", () => {
    const withoutMonth = { numbers: VALID_DIA_DE_SORTE_GAME.numbers, betSize: VALID_DIA_DE_SORTE_GAME.betSize, mode: VALID_DIA_DE_SORTE_GAME.mode };
    expect(parseSaveBetInput({ games: [withoutMonth] }, DIA_DE_SORTE).ok).toBe(false);
  });

  it("rejeita month fora da faixa 1-12 (0, 13 ou não inteiro) sob a config do Dia de Sorte", () => {
    expect(parseSaveBetInput({ games: [{ ...VALID_DIA_DE_SORTE_GAME, month: 0 }] }, DIA_DE_SORTE).ok).toBe(false);
    expect(parseSaveBetInput({ games: [{ ...VALID_DIA_DE_SORTE_GAME, month: 13 }] }, DIA_DE_SORTE).ok).toBe(false);
    expect(parseSaveBetInput({ games: [{ ...VALID_DIA_DE_SORTE_GAME, month: 5.5 }] }, DIA_DE_SORTE).ok).toBe(false);
  });

  it("outras modalidades (sem hasMonthPick) nunca exigem month, e qualquer month enviado é silenciosamente ignorado (força null)", () => {
    const gameWithStrayMonth = { ...VALID_GAME, month: 7 };
    const result = parseSaveBetInput({ games: [gameWithStrayMonth] }, LOTOFACIL);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.games[0].month).toBeNull();

    const withoutMonth = parseSaveBetInput({ games: [VALID_GAME] }, LOTOFACIL);
    expect(withoutMonth.ok).toBe(true);
    if (withoutMonth.ok) expect(withoutMonth.value.games[0].month).toBeNull();
  });
});

describe("lotteries/validation — parseDrawnNumbersInput com config do Dia de Sorte (drawnMonth)", () => {
  it("aceita exatamente 7 números e um drawnMonth entre 1 e 12 sob a config do Dia de Sorte", () => {
    const result = parseDrawnNumbersInput({ drawnNumbers: [7, 1, 2, 3, 4, 5, 6], drawnMonth: 9 }, DIA_DE_SORTE);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.drawnNumbers).toEqual([1, 2, 3, 4, 5, 6, 7]);
      expect(result.value.drawnMonth).toBe(9);
    }
  });

  it("rejeita quando drawnMonth está ausente ou fora da faixa sob a config do Dia de Sorte", () => {
    const numbers = [1, 2, 3, 4, 5, 6, 7];
    expect(parseDrawnNumbersInput({ drawnNumbers: numbers }, DIA_DE_SORTE).ok).toBe(false);
    expect(parseDrawnNumbersInput({ drawnNumbers: numbers, drawnMonth: 0 }, DIA_DE_SORTE).ok).toBe(false);
    expect(parseDrawnNumbersInput({ drawnNumbers: numbers, drawnMonth: 13 }, DIA_DE_SORTE).ok).toBe(false);
  });

  it("outras modalidades (sem hasMonthPick) nunca exigem drawnMonth, e qualquer drawnMonth enviado é silenciosamente ignorado (força null)", () => {
    const numbers = Array.from({ length: 15 }, (_, i) => i + 1);
    const withStrayMonth = parseDrawnNumbersInput({ drawnNumbers: numbers, drawnMonth: 4 }, LOTOFACIL);
    expect(withStrayMonth.ok).toBe(true);
    if (withStrayMonth.ok) expect(withStrayMonth.value.drawnMonth).toBeNull();

    const withoutMonth = parseDrawnNumbersInput({ drawnNumbers: numbers }, LOTOFACIL);
    expect(withoutMonth.ok).toBe(true);
    if (withoutMonth.ok) expect(withoutMonth.value.drawnMonth).toBeNull();
  });
});

describe("lotteries/validation — parseUpdateBetInput", () => {
  it("valida os mesmos campos de cabeçalho, sem exigir jogos", () => {
    const result = parseUpdateBetInput({ contestNumber: 3200, drawDate: "2026-10-01", amountCents: 500, note: "ok" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ contestNumber: 3200, drawDate: "2026-10-01", amountCents: 500, note: "ok" });
    }
  });

  it("rejeita corpo que não é objeto", () => {
    expect(parseUpdateBetInput(null).ok).toBe(false);
    expect(parseUpdateBetInput("nada").ok).toBe(false);
    expect(parseUpdateBetInput(5).ok).toBe(false);
  });

  it("rejeita valor apostado inválido, igual a parseSaveBetInput", () => {
    expect(parseUpdateBetInput({ amountCents: -10 }).ok).toBe(false);
  });
});

describe("lotteries/validation — parseDrawnNumbersInput", () => {
  it("aceita exatamente 15 números válidos e devolve ordenado, com drawnMonth null (config da Lotofácil)", () => {
    const result = parseDrawnNumbersInput({ drawnNumbers: [15, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] }, LOTOFACIL);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.drawnNumbers).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
      expect(result.value.drawnMonth).toBeNull();
    }
  });

  it("rejeita quantidade diferente de 15 (config da Lotofácil)", () => {
    expect(parseDrawnNumbersInput({ drawnNumbers: [1, 2, 3] }, LOTOFACIL).ok).toBe(false);
  });

  it("rejeita números repetidos ou fora da faixa 1-25 (config da Lotofácil)", () => {
    const withDuplicate = [1, 1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
    expect(parseDrawnNumbersInput({ drawnNumbers: withDuplicate }, LOTOFACIL).ok).toBe(false);
    const outOfRange = [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
    expect(parseDrawnNumbersInput({ drawnNumbers: outOfRange }, LOTOFACIL).ok).toBe(false);
  });

  it("aceita exatamente 6 números válidos entre 1 e 60 sob a config da Mega-Sena", () => {
    const result = parseDrawnNumbersInput({ drawnNumbers: [60, 1, 30, 2, 45, 6] }, MEGASENA);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.drawnNumbers).toEqual([1, 2, 6, 30, 45, 60]);
      expect(result.value.drawnMonth).toBeNull();
    }
  });

  it("rejeita 15 números sob a config da Mega-Sena (que exige exatamente 6)", () => {
    const lotofacilStyle = Array.from({ length: 15 }, (_, i) => i + 1);
    expect(parseDrawnNumbersInput({ drawnNumbers: lotofacilStyle }, MEGASENA).ok).toBe(false);
  });
});

describe("lotteries/validation — parseSettingsInput e parseFavoriteInput", () => {
  it("aceita um limite mensal válido, ou null para remover o limite", () => {
    expect(parseSettingsInput({ monthlyBudgetCents: 10000 })).toEqual({ ok: true, value: { monthlyBudgetCents: 10000 } });
    expect(parseSettingsInput({ monthlyBudgetCents: null })).toEqual({ ok: true, value: { monthlyBudgetCents: null } });
  });

  it("rejeita limite mensal negativo", () => {
    expect(parseSettingsInput({ monthlyBudgetCents: -1 }).ok).toBe(false);
  });

  it("parseFavoriteInput exige um booleano", () => {
    expect(parseFavoriteInput({ isFavorite: true })).toEqual({ ok: true, value: { isFavorite: true } });
    expect(parseFavoriteInput({ isFavorite: "sim" }).ok).toBe(false);
  });
});
