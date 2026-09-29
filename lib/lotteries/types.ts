/**
 * Tipos de "Meus Jogos" (histórico privado de jogos salvos — Fase 2).
 * Valores monetários em CENTAVOS (inteiro), datas em "YYYY-MM-DD".
 */
import type { LotofacilMode } from "./lotofacil-generator";

export interface LotteryGame {
  id: string;
  betId: string;
  modality: string;
  numbers: number[];
  betSize: number;
  mode: LotofacilMode;
  isFavorite: boolean;
  /** Acertos contra `LotteryBet.drawnNumbers` — null enquanto não conferido. */
  hits: number | null;
  createdAt: string;
}

export interface LotteryBet {
  id: string;
  modality: string;
  contestNumber: number | null;
  drawDate: string | null;
  amountCents: number;
  note: string | null;
  /** Números realmente sorteados, informados manualmente na conferência. */
  drawnNumbers: number[] | null;
  checkedAt: string | null;
  createdAt: string;
  games: LotteryGame[];
}

export interface LotterySettings {
  monthlyBudgetCents: number | null;
}

/** Estatística de frequência PESSOAL — nunca chamada de "probabilidade". */
export interface LotteryFrequencyStats {
  /** Quantos jogos salvos entram nesta contagem. */
  totalGames: number;
  /** Quantas vezes cada número (1..maxNumber) apareceu nos jogos salvos do usuário. */
  frequency: Record<number, number>;
}

/** Total investido e o total do mês corrente — só para acompanhamento, nunca alerta (ver MeusJogos.tsx). */
export interface InvestmentSummary {
  totalCents: number;
  currentMonthCents: number;
}
