/**
 * Configuração central da Lotofácil (Alilu Loterias).
 *
 * Único lugar com os números "oficiais" do jogo — nenhuma função ou
 * componente deve espalhar 1/25/15/20 como números soltos pelo código;
 * tudo lê daqui, para facilitar uma atualização futura caso a CAIXA mude
 * as regras.
 */
export const LOTOFACIL_CONFIG = {
  minNumber: 1,
  maxNumber: 25,
  drawnNumbers: 15,
  minBetNumbers: 15,
  maxBetNumbers: 20,
} as const;

/** Quantidades de dezenas que o usuário pode escolher para apostar. */
export const LOTOFACIL_BET_SIZES: readonly number[] = [15, 16, 17, 18, 19, 20];

/** Números primos entre 1 e 25 (9 ao todo): 2, 3, 5, 7, 11, 13, 17, 19, 23. */
export const LOTOFACIL_PRIME_NUMBERS: readonly number[] = [2, 3, 5, 7, 11, 13, 17, 19, 23];

/**
 * As 5 linhas do volante oficial da Lotofácil (5 colunas cada). A coluna de
 * um número N é sempre `(N - 1) % 5` e a linha é `Math.floor((N - 1) / 5)`
 * — os blocos são consecutivos de 5 em 5, então não precisamos repetir essa
 * tabela em nenhuma função, só usar essa conta diretamente.
 */
export const LOTOFACIL_BOARD_ROWS: readonly (readonly number[])[] = [
  [1, 2, 3, 4, 5],
  [6, 7, 8, 9, 10],
  [11, 12, 13, 14, 15],
  [16, 17, 18, 19, 20],
  [21, 22, 23, 24, 25],
];
