/**
 * Registro de modalidades na CAMADA DE API/VALIDAÇÃO (Fase B — "Meus
 * Jogos" da Mega-Sena, mesma estrutura já existente da Lotofácil).
 *
 * Diferente de lotofacil-config.ts/megasena-config.ts (que continuam
 * sendo a fonte da verdade para o gerador/UI de cada modalidade), este
 * arquivo serve só para o backend/validação resolverem "qual modalidade é
 * esta requisição" a partir de uma string vinda do cliente (query string
 * ou corpo JSON) — nunca redeclara os números, sempre importa das
 * configs de cada modalidade.
 */
import { LOTOFACIL_CONFIG } from "./lotofacil-config";
import { MEGASENA_CONFIG } from "./megasena-config";
import { QUINA_CONFIG } from "./quina-config";
import { LOTOMANIA_CONFIG } from "./lotomania-config";
import { DIA_DE_SORTE_CONFIG } from "./dia-de-sorte-config";

export interface LotteryApiConfig {
  id: string;
  minNumber: number;
  maxNumber: number;
  drawnNumbers: number;
  minBetNumbers: number;
  maxBetNumbers: number;
  /**
   * Só true para o Dia de Sorte: além dos números, toda aposta também
   * exige escolher 1 "Mês da Sorte" (1-12), uma segunda dimensão de
   * sorteio independente (ver lib/lotteries/dia-de-sorte-config.ts).
   * undefined/false em toda outra modalidade — nunca exige nem valida
   * `month`/`drawnMonth`, mesmo que o cliente envie algo nesses campos
   * (ver parseGameInput/parseDrawnNumbersInput em validation.ts).
   */
  hasMonthPick?: boolean;
}

const LOTTERY_API_CONFIGS: Record<string, LotteryApiConfig> = {
  lotofacil: { id: "lotofacil", ...LOTOFACIL_CONFIG },
  "mega-sena": { id: "mega-sena", ...MEGASENA_CONFIG },
  quina: { id: "quina", ...QUINA_CONFIG },
  lotomania: { id: "lotomania", ...LOTOMANIA_CONFIG },
  "dia-de-sorte": { id: "dia-de-sorte", ...DIA_DE_SORTE_CONFIG, hasMonthPick: true },
};

/** Resolve uma modalidade a partir de uma string qualquer (query string ou corpo JSON) — undefined se não reconhecida. */
export function getLotteryApiConfig(modality: unknown): LotteryApiConfig | undefined {
  if (typeof modality !== "string") return undefined;
  return LOTTERY_API_CONFIGS[modality];
}

/** Modos de geração comuns a todas as modalidades (Lotofácil, Mega-Sena, Quina e Lotomania suportam os mesmos 4). */
export const LOTTERY_MODES = ["aleatorio", "equilibrado", "personalizado", "diversificado"] as const;
export type LotteryMode = (typeof LOTTERY_MODES)[number];
