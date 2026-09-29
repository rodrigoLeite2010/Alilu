import { LOTOFACIL_BET_SIZES, LOTOFACIL_CONFIG } from "@/lib/lotteries/lotofacil-config";
import { calculateCombination, calculateOddsOneIn } from "@/lib/lotteries/combinatorics";

function formatInt(value: number): string {
  return Math.round(value).toLocaleString("pt-BR");
}

/**
 * Conteúdo educativo original (Seções 22, 23, 25, 28 do pedido): regras,
 * fórmula da combinação e a tabela de probabilidade por quantidade de
 * números, sempre CALCULADA em tempo real por combinatória
 * (lib/lotteries/combinatorics.ts) — nunca copiada de uma tabela "oficial"
 * memorizada, para nunca arriscar publicar um número incorreto. Termina
 * com os avisos obrigatórios: isto é estatística, nunca previsão.
 */
export function LotofacilProbabilityEducation() {
  const totalCombinations = calculateCombination(LOTOFACIL_CONFIG.maxNumber, LOTOFACIL_CONFIG.drawnNumbers);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">Como funciona a Lotofácil</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-700">
          A Lotofácil sorteia {LOTOFACIL_CONFIG.drawnNumbers} números entre{" "}
          {String(LOTOFACIL_CONFIG.minNumber).padStart(2, "0")} e {LOTOFACIL_CONFIG.maxNumber}. Na aposta, você
          escolhe de {LOTOFACIL_CONFIG.minBetNumbers} a {LOTOFACIL_CONFIG.maxBetNumbers} números: quanto mais números
          você marca, mais combinações de {LOTOFACIL_CONFIG.drawnNumbers} dezenas a sua aposta cobre ao mesmo tempo —
          o que é bem diferente de “aumentar a chance de uma combinação específica dar certo”.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">A fórmula por trás do número</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-700">
          A quantidade de combinações possíveis de {LOTOFACIL_CONFIG.drawnNumbers} números entre{" "}
          {LOTOFACIL_CONFIG.maxNumber} é dada pela combinação matemática C(n, k) = n! / (k! × (n − k)!). Para a
          Lotofácil, isso é C({LOTOFACIL_CONFIG.maxNumber}, {LOTOFACIL_CONFIG.drawnNumbers}) ={" "}
          {formatInt(totalCombinations)} combinações possíveis — o denominador de qualquer chance de acertar as{" "}
          {LOTOFACIL_CONFIG.drawnNumbers} dezenas sorteadas com uma aposta simples de {LOTOFACIL_CONFIG.drawnNumbers}{" "}
          números.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">
          Probabilidades por quantidade de números
        </h2>
        <p className="mt-2 text-sm text-zinc-600">
          Calculado por combinatória, nunca por histórico de sorteios — a chance de acertar as{" "}
          {LOTOFACIL_CONFIG.drawnNumbers} dezenas sorteadas para cada tamanho de aposta.
        </p>
        <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  Números marcados
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Equivale a
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Chance de acertar as {LOTOFACIL_CONFIG.drawnNumbers} dezenas
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {LOTOFACIL_BET_SIZES.map((betSize) => {
                const simpleBetsEquivalent = calculateCombination(betSize, LOTOFACIL_CONFIG.drawnNumbers);
                const odds = calculateOddsOneIn({
                  maxNumber: LOTOFACIL_CONFIG.maxNumber,
                  drawnNumbers: LOTOFACIL_CONFIG.drawnNumbers,
                  betSize,
                });
                return (
                  <tr key={betSize}>
                    <td className="px-3 py-2 font-semibold text-zinc-900">{betSize}</td>
                    <td className="px-3 py-2 text-zinc-700">
                      {formatInt(simpleBetsEquivalent)} aposta{simpleBetsEquivalent === 1 ? "" : "s"} simples
                    </td>
                    <td className="px-3 py-2 text-zinc-700">1 em {formatInt(odds)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">
          Estatística não é previsão
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-700">
          Filtros como “pares e ímpares equilibrados” ou “5 a 6 números primos” só organizam a composição do seu
          jogo com base em padrões que costumam aparecer nos sorteios — mas isso não muda a chance matemática da
          combinação específica que você monta. Frequência passada não torna uma dezena mais provável no próximo
          sorteio: cada sorteio da Lotofácil é independente dos anteriores.
        </p>
      </section>

      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
        <p className="text-sm font-semibold text-amber-900">Importante</p>
        <p className="mt-1 text-sm text-amber-900">
          As combinações geradas nesta ferramenta são apenas sugestões matemáticas e estatísticas. Nenhum padrão
          histórico ou filtro pode prever os números de um sorteio futuro.
        </p>
        <p className="mt-2 text-sm text-amber-900">Jogue com responsabilidade.</p>
      </div>
    </div>
  );
}
