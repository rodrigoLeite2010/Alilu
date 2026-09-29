/**
 * Configuração central do Dia de Sorte (Alilu Loterias).
 *
 * Único lugar com os números "oficiais" do jogo — nenhuma função ou
 * componente deve espalhar 1/31/7/15 como números soltos pelo código;
 * tudo lê daqui, para facilitar uma atualização futura caso a CAIXA mude
 * as regras.
 *
 * Diferente de toda outra modalidade já implementada (Lotofácil,
 * Mega-Sena, Quina, Lotomania), o Dia de Sorte tem uma particularidade
 * estrutural que nenhuma das outras quatro tem: TODA aposta, além dos
 * números (1 a 31, representando dias do mês), também exige escolher
 * exatamente 1 "Mês da Sorte" entre os 12 meses do calendário — uma
 * segunda dimensão de sorteio, com sua própria faixa de premiação
 * (o "mês certo sozinho"), completamente independente dos números.
 *
 * Essa escolha do mês é deliberadamente MANTIDA FORA desta config e do
 * gerador de números (lib/lotteries/dia-de-sorte-generator.ts): os campos
 * abaixo descrevem só a parte "escolher N números de 1 a 31", exatamente
 * como em Quina/Mega-Sena/Lotofácil. `generateRandomMonth()` e
 * `MONTH_LABELS`, em dia-de-sorte-generator.ts, cuidam da parte do mês —
 * ver o comentário lá para o motivo dessa separação.
 */
export const DIA_DE_SORTE_CONFIG = {
  minNumber: 1,
  maxNumber: 31,
  drawnNumbers: 7,
  minBetNumbers: 7,
  maxBetNumbers: 15,
} as const;

/** Quantidades de dezenas que o usuário pode escolher para apostar. */
export const DIA_DE_SORTE_BET_SIZES: readonly number[] = [7, 8, 9, 10, 11, 12, 13, 14, 15];

/** Números primos entre 1 e 31 (11 ao todo): 2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31. */
export const DIA_DE_SORTE_PRIME_NUMBERS: readonly number[] = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31];

/**
 * As 5 linhas do volante usado nesta ferramenta (7 colunas cada, exceto a
 * última, que fica com 3) — uma escolha temática nossa, não uma cópia do
 * volante oficial da CAIXA: como os números do Dia de Sorte representam
 * dias do mês, um agrupamento de 7 em 7 evoca visualmente as semanas de
 * um calendário. Este projeto nunca reproduziu a geometria exata do
 * volante oficial para nenhuma modalidade (ver o comentário de
 * LotteryNumberGrid.tsx), então não há inconsistência aqui — só mais uma
 * forma defensável de agrupar os números para a estatística de
 * "distribuição" do modo Equilibrado. A linha de um número N é sempre
 * `Math.floor((N - 1) / 7)` (getUsedGroups(numbers, 7) — minNumber
 * default de 1 já serve, o Dia de Sorte não é como a Lotomania).
 */
export const DIA_DE_SORTE_BOARD_ROWS: readonly (readonly number[])[] = [
  [1, 2, 3, 4, 5, 6, 7],
  [8, 9, 10, 11, 12, 13, 14],
  [15, 16, 17, 18, 19, 20, 21],
  [22, 23, 24, 25, 26, 27, 28],
  [29, 30, 31],
];
