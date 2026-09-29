import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MeusJogos } from "@/components/lotteries/MeusJogos";
import type { LotteryBet } from "@/lib/lotteries/types";

/**
 * Testes de "Meus Jogos" (Fase 2): carregamento, listagem de apostas/
 * jogos, favoritar, excluir jogo/aposta (com confirmação), exportar CSV,
 * investimento (total + limite mensal) e frequência pessoal. A API é
 * mockada inteira (components/lotteries/api.ts) — o que a rota/repositório
 * fazem já está coberto por __tests__/lib/lotteries-repository.test.ts.
 */

const listBets = vi.fn();
const getStats = vi.fn();
const getSettings = vi.fn();
const setFavorite = vi.fn();
const deleteGame = vi.fn();
const deleteBet = vi.fn();
const updateBet = vi.fn();
const conferirBet = vi.fn();
const saveSettings = vi.fn();

vi.mock("@/components/lotteries/api", () => ({
  lotteryApi: {
    listBets: (...args: unknown[]) => listBets(...args),
    getStats: (...args: unknown[]) => getStats(...args),
    getSettings: (...args: unknown[]) => getSettings(...args),
    setFavorite: (...args: unknown[]) => setFavorite(...args),
    deleteGame: (...args: unknown[]) => deleteGame(...args),
    deleteBet: (...args: unknown[]) => deleteBet(...args),
    updateBet: (...args: unknown[]) => updateBet(...args),
    conferirBet: (...args: unknown[]) => conferirBet(...args),
    saveSettings: (...args: unknown[]) => saveSettings(...args),
  },
}));

function bet(overrides: Partial<LotteryBet> = {}): LotteryBet {
  return {
    id: "bet-1",
    modality: "lotofacil",
    contestNumber: 3200,
    drawDate: "2026-10-01",
    amountCents: 250,
    note: null,
    drawnNumbers: null,
    checkedAt: null,
    createdAt: "2026-09-29T00:00:00.000Z",
    games: [
      {
        id: "game-1",
        betId: "bet-1",
        modality: "lotofacil",
        numbers: Array.from({ length: 15 }, (_, i) => i + 1),
        betSize: 15,
        mode: "aleatorio",
        isFavorite: false,
        hits: null,
        createdAt: "2026-09-29T00:00:00.000Z",
      },
    ],
    ...overrides,
  };
}

const originalConfirm = window.confirm;

beforeEach(() => {
  listBets.mockReset().mockResolvedValue([bet()]);
  getStats.mockReset().mockResolvedValue({
    frequency: { totalGames: 1, frequency: { 1: 1 } },
    investment: { totalCents: 250, currentMonthCents: 250 },
  });
  getSettings.mockReset().mockResolvedValue({ monthlyBudgetCents: null });
  setFavorite.mockReset().mockResolvedValue({ ok: true });
  deleteGame.mockReset().mockResolvedValue({ ok: true });
  deleteBet.mockReset().mockResolvedValue({ ok: true });
  updateBet.mockReset().mockResolvedValue({ ok: true });
  conferirBet.mockReset().mockResolvedValue(bet());
  saveSettings.mockReset().mockResolvedValue({ ok: true });
  window.confirm = vi.fn(() => true);
});

afterEach(() => {
  window.confirm = originalConfirm;
});

describe("MeusJogos", () => {
  it("mostra estado de carregamento e depois a lista de apostas com seus jogos", async () => {
    render(<MeusJogos modality="lotofacil" minNumber={1} maxNumber={25} drawnNumbers={15} reusePath="/loterias/lotofacil" />);
    expect(screen.getByText(/carregando/i)).toBeInTheDocument();

    expect(await screen.findByText("Concurso 3200 · 01/10/2026")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*2,50 apostado/)).toBeInTheDocument();
  });

  it("mostra estado vazio quando não há apostas salvas", async () => {
    listBets.mockResolvedValue([]);
    getStats.mockResolvedValue({ frequency: { totalGames: 0, frequency: {} }, investment: { totalCents: 0, currentMonthCents: 0 } });
    render(<MeusJogos modality="lotofacil" minNumber={1} maxNumber={25} drawnNumbers={15} reusePath="/loterias/lotofacil" />);

    expect(await screen.findByText(/ainda não salvou nenhum jogo/i)).toBeInTheDocument();
    expect(screen.queryByText(/baixar csv/i)).not.toBeInTheDocument();
  });

  it("favorita um jogo", async () => {
    render(<MeusJogos modality="lotofacil" minNumber={1} maxNumber={25} drawnNumbers={15} reusePath="/loterias/lotofacil" />);
    const favoriteButton = await screen.findByRole("button", { name: /marcar como favorito/i });
    fireEvent.click(favoriteButton);

    await waitFor(() => expect(setFavorite).toHaveBeenCalledWith("game-1", true));
  });

  it("exclui um jogo depois de confirmar", async () => {
    render(<MeusJogos modality="lotofacil" minNumber={1} maxNumber={25} drawnNumbers={15} reusePath="/loterias/lotofacil" />);
    const deleteGameButton = await screen.findByRole("button", { name: /excluir jogo/i });
    fireEvent.click(deleteGameButton);

    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => expect(deleteGame).toHaveBeenCalledWith("game-1"));
  });

  it("exclui uma aposta inteira depois de confirmar", async () => {
    render(<MeusJogos modality="lotofacil" minNumber={1} maxNumber={25} drawnNumbers={15} reusePath="/loterias/lotofacil" />);
    const deleteBetButton = await screen.findByRole("button", { name: /^excluir$/i });
    fireEvent.click(deleteBetButton);

    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => expect(deleteBet).toHaveBeenCalledWith("bet-1"));
  });

  it("não exclui quando a confirmação é cancelada", async () => {
    window.confirm = vi.fn(() => false);
    render(<MeusJogos modality="lotofacil" minNumber={1} maxNumber={25} drawnNumbers={15} reusePath="/loterias/lotofacil" />);
    const deleteGameButton = await screen.findByRole("button", { name: /excluir jogo/i });
    fireEvent.click(deleteGameButton);

    expect(deleteGame).not.toHaveBeenCalled();
  });

  it("mostra o link de baixar CSV quando há jogos salvos", async () => {
    render(<MeusJogos modality="lotofacil" minNumber={1} maxNumber={25} drawnNumbers={15} reusePath="/loterias/lotofacil" />);
    const link = await screen.findByRole("link", { name: /baixar csv/i });
    expect(link).toHaveAttribute("href", "/api/loterias/exportar?modalidade=lotofacil");
  });

  it("mostra o total investido e permite salvar um limite mensal", async () => {
    getStats.mockResolvedValue({
      frequency: { totalGames: 1, frequency: { 1: 1 } },
      investment: { totalCents: 750, currentMonthCents: 250 },
    });
    render(<MeusJogos modality="lotofacil" minNumber={1} maxNumber={25} drawnNumbers={15} reusePath="/loterias/lotofacil" />);
    expect(await screen.findByText("R$ 7,50")).toBeInTheDocument();
    expect(screen.getByText("R$ 2,50")).toBeInTheDocument();

    const input = screen.getByLabelText(/limite mensal/i);
    fireEvent.change(input, { target: { value: "100,00" } });
    fireEvent.click(screen.getByRole("button", { name: /^salvar$/i }));

    await waitFor(() => expect(saveSettings).toHaveBeenCalledWith({ monthlyBudgetCents: 10000 }));
  });

  it("confere o resultado de uma aposta ao marcar 15 números e confirmar", async () => {
    render(<MeusJogos modality="lotofacil" minNumber={1} maxNumber={25} drawnNumbers={15} reusePath="/loterias/lotofacil" />);
    fireEvent.click(await screen.findByRole("button", { name: /conferir resultado/i }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    for (let n = 1; n <= 15; n += 1) {
      const label = String(n).padStart(2, "0");
      fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}`) }));
    }
    fireEvent.click(screen.getByRole("button", { name: "Conferir" }));

    await waitFor(() =>
      expect(conferirBet).toHaveBeenCalledWith("lotofacil", "bet-1", Array.from({ length: 15 }, (_, i) => i + 1))
    );
  });

  it("abre o modo de edição do cabeçalho da aposta e salva as alterações", async () => {
    render(<MeusJogos modality="lotofacil" minNumber={1} maxNumber={25} drawnNumbers={15} reusePath="/loterias/lotofacil" />);
    const editButton = await screen.findByRole("button", { name: /^editar$/i });
    const betCard = editButton.closest("li") as HTMLElement;
    fireEvent.click(editButton);

    const amountField = within(betCard).getByLabelText("Valor apostado");
    fireEvent.change(amountField, { target: { value: "5,00" } });
    fireEvent.click(within(betCard).getByRole("button", { name: /^salvar$/i }));

    await waitFor(() =>
      expect(updateBet).toHaveBeenCalledWith("bet-1", { contestNumber: 3200, drawDate: "2026-10-01", amountCents: 500, note: null })
    );
  });
});
