import type { InvestmentSummary, LotteryBet, LotteryFrequencyStats, LotterySettings } from "@/lib/lotteries/types";
import type { SaveBetInput } from "@/lib/lotteries/validation";

/**
 * Cliente HTTP de "Meus Jogos" (Fase 2, generalizado por modalidade na
 * Fase B) — mesmo padrão de components/financas/api.ts: uma função por
 * rota de /api/loterias/*, lançando com a mensagem de erro que a própria
 * API devolveu. Toda função cujo endpoint precisa saber a modalidade
 * recebe `modality` como parâmetro; `saveBet`/`conferirBet` já carregam a
 * modalidade dentro do próprio corpo (SaveBetInput.modality).
 */
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "Algo deu errado. Tente novamente.");
  return data;
}

export interface SaveBetResult {
  bet: LotteryBet;
  skippedDuplicates: number;
}

export interface StatsResult {
  frequency: LotteryFrequencyStats;
  investment: InvestmentSummary;
}

export const lotteryApi = {
  listBets: (modality: string) =>
    request<{ bets: LotteryBet[] }>(`/api/loterias/apostas?modalidade=${modality}`).then((r) => r.bets),
  saveBet: (input: SaveBetInput) =>
    request<SaveBetResult>("/api/loterias/apostas", { method: "POST", body: JSON.stringify(input) }),
  updateBet: (id: string, input: Omit<SaveBetInput, "games" | "modality">) =>
    request<{ ok: true }>(`/api/loterias/apostas/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  deleteBet: (id: string) => request<{ ok: true }>(`/api/loterias/apostas/${id}`, { method: "DELETE" }),
  conferirBet: (modality: string, id: string, drawnNumbers: number[], drawnMonth?: number | null) =>
    request<{ bet: LotteryBet }>(`/api/loterias/apostas/${id}/conferir`, {
      method: "POST",
      body: JSON.stringify({ modality, drawnNumbers, drawnMonth }),
    }).then((r) => r.bet),
  setFavorite: (gameId: string, isFavorite: boolean) =>
    request<{ ok: true }>(`/api/loterias/jogos/${gameId}`, { method: "PATCH", body: JSON.stringify({ isFavorite }) }),
  deleteGame: (gameId: string) => request<{ ok: true }>(`/api/loterias/jogos/${gameId}`, { method: "DELETE" }),
  getStats: (modality: string) => request<StatsResult>(`/api/loterias/estatisticas?modalidade=${modality}`),
  getSettings: () => request<LotterySettings>("/api/loterias/configuracoes"),
  saveSettings: (input: LotterySettings) =>
    request<{ ok: true }>("/api/loterias/configuracoes", { method: "PUT", body: JSON.stringify(input) }),
};
