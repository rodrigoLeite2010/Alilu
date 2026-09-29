/**
 * Combinatória pura, sem nenhuma dependência de DOM/Canvas — usada tanto
 * pela seção educativa de probabilidade quanto (no futuro) pelo
 * desdobramento. Isolado em módulo próprio para ficar fácil de testar
 * isoladamente (ver __tests__/lib/lotteries-combinatorics.test.ts).
 */

/**
 * Coeficiente binomial C(n, k) — "de quantas formas dá para escolher k
 * itens entre n, sem se importar com a ordem". Calculado de forma
 * iterativa (nunca com fatorial direto, que estouraria para n grande) e
 * sempre arredondado para o inteiro mais próximo para neutralizar erro de
 * ponto flutuante — o algoritmo é matematicamente exato para os tamanhos
 * usados aqui (n ≤ 25), então o arredondamento nunca esconde um erro real.
 */
export function calculateCombination(n: number, k: number): number {
  if (!Number.isInteger(n) || !Number.isInteger(k) || n < 0 || k < 0) return 0;
  if (k > n) return 0;

  const effectiveK = Math.min(k, n - k);
  let result = 1;
  for (let i = 0; i < effectiveK; i += 1) {
    result = (result * (n - i)) / (i + 1);
  }
  return Math.round(result);
}

/**
 * Probabilidade "1 em X" de acertar as `drawnNumbers` dezenas sorteadas
 * apostando em `betSize` números, calculada puramente por combinatória:
 * C(maxNumber, drawnNumbers) / C(betSize, drawnNumbers). Nunca usa
 * histórico de sorteios — é a mesma matemática que qualquer aposta
 * simples/múltipla da loteria segue, não uma estimativa.
 */
export function calculateOddsOneIn(params: { maxNumber: number; drawnNumbers: number; betSize: number }): number {
  const { maxNumber, drawnNumbers, betSize } = params;
  const totalCombinations = calculateCombination(maxNumber, drawnNumbers);
  const winningCombinations = calculateCombination(betSize, drawnNumbers);
  if (winningCombinations === 0) return totalCombinations;
  return totalCombinations / winningCombinations;
}
