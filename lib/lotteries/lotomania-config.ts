/**
 * Configuração central da Lotomania (Alilu Loterias).
 *
 * Único lugar com os números "oficiais" do jogo — nenhuma função ou
 * componente deve espalhar 0/99/20/50 como números soltos pelo código;
 * tudo lê daqui, para facilitar uma atualização futura caso a CAIXA mude
 * as regras.
 *
 * Diferente de toda outra modalidade já implementada (Lotofácil,
 * Mega-Sena, Quina), a Lotomania tem duas particularidades estruturais:
 *
 * 1. `minNumber: 0` — é a única loteria da CAIXA com notação de dois
 *    dígitos incluindo o zero ("00" é um número válido e sorteável).
 *    Isso é o que expôs o bug de indexação de lib/lotteries/shared.ts
 *    (getUsedGroups assumia `minNumber = 1` implicitamente).
 * 2. `minBetNumbers === maxBetNumbers === 50` — a aposta é sempre fixa em
 *    exatamente 50 números (metade do volante de 100), sem faixa de
 *    escolha como nas outras três modalidades. Por isso
 *    LotomaniaGenerator.tsx não tem o seletor de "quantidade de dezenas".
 */
export const LOTOMANIA_CONFIG = {
  minNumber: 0,
  maxNumber: 99,
  drawnNumbers: 20,
  minBetNumbers: 50,
  maxBetNumbers: 50,
} as const;

/**
 * Diferente das outras modalidades, a Lotomania não tem faixa de escolha
 * de quantidade de dezenas — a aposta é sempre fixa em 50 números. Este
 * array de um único elemento existe só para quem eventualmente precisar
 * iterar "os tamanhos de aposta possíveis" de forma genérica; o
 * componente de UI (LotomaniaGenerator.tsx) NÃO usa isto para nenhum
 * seletor, já que não há escolha a fazer.
 */
export const LOTOMANIA_BET_SIZES: readonly number[] = [50];

/** Números primos entre 0 e 99 (25 ao todo; 0 e 1 não são primos): 2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97. */
export const LOTOMANIA_PRIME_NUMBERS: readonly number[] = [
  2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97,
];

/**
 * As 10 linhas do volante oficial da Lotomania (10 colunas cada, de 0 a
 * 99). A linha de um número N é sempre `Math.floor(N / 10)` (equivalente
 * a `Math.floor((N - minNumber) / 10)` com minNumber = 0) — os blocos são
 * consecutivos de 10 em 10, então não precisamos repetir essa tabela em
 * nenhuma função, só usar essa conta diretamente
 * (getUsedGroups(numbers, 10, LOTOMANIA_CONFIG.minNumber)).
 */
export const LOTOMANIA_BOARD_ROWS: readonly (readonly number[])[] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [10, 11, 12, 13, 14, 15, 16, 17, 18, 19],
  [20, 21, 22, 23, 24, 25, 26, 27, 28, 29],
  [30, 31, 32, 33, 34, 35, 36, 37, 38, 39],
  [40, 41, 42, 43, 44, 45, 46, 47, 48, 49],
  [50, 51, 52, 53, 54, 55, 56, 57, 58, 59],
  [60, 61, 62, 63, 64, 65, 66, 67, 68, 69],
  [70, 71, 72, 73, 74, 75, 76, 77, 78, 79],
  [80, 81, 82, 83, 84, 85, 86, 87, 88, 89],
  [90, 91, 92, 93, 94, 95, 96, 97, 98, 99],
];
