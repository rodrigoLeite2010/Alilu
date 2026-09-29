/**
 * Configuração central da Mega-Sena (Alilu Loterias).
 *
 * Único lugar com os números "oficiais" do jogo — nenhuma função ou
 * componente deve espalhar 1/60/6/20 como números soltos pelo código;
 * tudo lê daqui, para facilitar uma atualização futura caso a CAIXA mude
 * as regras.
 */
export const MEGASENA_CONFIG = {
  minNumber: 1,
  maxNumber: 60,
  drawnNumbers: 6,
  minBetNumbers: 6,
  maxBetNumbers: 20,
} as const;

/** Quantidades de dezenas que o usuário pode escolher para apostar. */
export const MEGASENA_BET_SIZES: readonly number[] = [
  6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
];

/** Números primos entre 1 e 60 (17 ao todo): 2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59. */
export const MEGASENA_PRIME_NUMBERS: readonly number[] = [
  2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59,
];

/**
 * As 6 linhas do volante oficial da Mega-Sena (10 colunas cada). A coluna
 * de um número N é sempre `(N - 1) % 10` e a linha é
 * `Math.floor((N - 1) / 10)` — os blocos são consecutivos de 10 em 10,
 * então não precisamos repetir essa tabela em nenhuma função, só usar essa
 * conta diretamente.
 */
export const MEGASENA_BOARD_ROWS: readonly (readonly number[])[] = [
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  [11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
  [21, 22, 23, 24, 25, 26, 27, 28, 29, 30],
  [31, 32, 33, 34, 35, 36, 37, 38, 39, 40],
  [41, 42, 43, 44, 45, 46, 47, 48, 49, 50],
  [51, 52, 53, 54, 55, 56, 57, 58, 59, 60],
];
