import { describe, expect, it } from "vitest";
import {
  parseDrawnNumbersInput,
  parseFavoriteInput,
  parseSaveBetInput,
  parseSettingsInput,
  parseUpdateBetInput,
} from "@/lib/lotteries/validation";

const VALID_GAME = { numbers: Array.from({ length: 15 }, (_, i) => i + 1), betSize: 15, mode: "aleatorio" as const };

describe("lotteries/validation — parseSaveBetInput", () => {
  it("aceita um corpo mínimo válido (um jogo, sem concurso/data/valor/observação)", () => {
    const result = parseSaveBetInput({ games: [VALID_GAME] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.games).toHaveLength(1);
      expect(result.value.contestNumber).toBeNull();
      expect(result.value.amountCents).toBe(0);
    }
  });

  it("ordena os números do jogo mesmo se vierem fora de ordem", () => {
    const shuffled = { ...VALID_GAME, numbers: [15, 3, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] };
    const result = parseSaveBetInput({ games: [shuffled] });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.games[0].numbers).toEqual(VALID_GAME.numbers);
  });

  it("rejeita quando 'games' está vazio ou ausente", () => {
    expect(parseSaveBetInput({ games: [] }).ok).toBe(false);
    expect(parseSaveBetInput({}).ok).toBe(false);
  });

  it("rejeita mais de 50 jogos em um único salvamento", () => {
    const games = Array.from({ length: 51 }, () => VALID_GAME);
    expect(parseSaveBetInput({ games }).ok).toBe(false);
  });

  it("rejeita um jogo com números repetidos", () => {
    const withDuplicate = { ...VALID_GAME, numbers: [...VALID_GAME.numbers.slice(0, 14), VALID_GAME.numbers[0]] };
    expect(parseSaveBetInput({ games: [withDuplicate] }).ok).toBe(false);
  });

  it("rejeita um jogo cujo tamanho não bate com betSize", () => {
    expect(parseSaveBetInput({ games: [{ ...VALID_GAME, betSize: 16 }] }).ok).toBe(false);
  });

  it("rejeita modo de geração desconhecido", () => {
    expect(parseSaveBetInput({ games: [{ ...VALID_GAME, mode: "adivinhacao" }] }).ok).toBe(false);
  });

  it("rejeita número de concurso <= 0 e data de sorteio inválida", () => {
    expect(parseSaveBetInput({ contestNumber: 0, games: [VALID_GAME] }).ok).toBe(false);
    expect(parseSaveBetInput({ drawDate: "31/12/2026", games: [VALID_GAME] }).ok).toBe(false);
  });

  it("rejeita valor apostado negativo", () => {
    expect(parseSaveBetInput({ amountCents: -1, games: [VALID_GAME] }).ok).toBe(false);
  });

  it("aceita e recorta observação, tratando string vazia como null", () => {
    const result = parseSaveBetInput({ note: "  aposta do mês  ", games: [VALID_GAME] });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.note).toBe("aposta do mês");

    const empty = parseSaveBetInput({ note: "   ", games: [VALID_GAME] });
    expect(empty.ok).toBe(true);
    if (empty.ok) expect(empty.value.note).toBeNull();
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
  it("aceita exatamente 15 números válidos e devolve ordenado", () => {
    const result = parseDrawnNumbersInput({ drawnNumbers: [15, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
  });

  it("rejeita quantidade diferente de 15", () => {
    expect(parseDrawnNumbersInput({ drawnNumbers: [1, 2, 3] }).ok).toBe(false);
  });

  it("rejeita números repetidos ou fora da faixa 1-25", () => {
    const withDuplicate = [1, 1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
    expect(parseDrawnNumbersInput({ drawnNumbers: withDuplicate }).ok).toBe(false);
    const outOfRange = [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
    expect(parseDrawnNumbersInput({ drawnNumbers: outOfRange }).ok).toBe(false);
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
