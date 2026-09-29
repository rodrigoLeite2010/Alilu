import { QUINA_BET_SIZES, QUINA_CONFIG } from "@/lib/lotteries/quina-config";
import { calculateCombination, calculateHitDistribution, calculateOddsOneIn } from "@/lib/lotteries/combinatorics";

function formatInt(value: number): string {
  return Math.round(value).toLocaleString("pt-BR");
}

const HIT_LABELS: Record<number, string> = {
  2: " (duque)",
  3: " (terno)",
  4: " (quadra)",
  5: " (quina)",
};

/**
 * Conteúdo educativo da Quina: regras, fórmula da combinação e tabela de
 * probabilidade por quantidade de números — sempre CALCULADA em tempo
 * real por combinatória (lib/lotteries/combinatorics.ts, já genérico e
 * reaproveitado tal como está), nunca copiada de uma tabela "oficial"
 * memorizada. Mesmo espírito de MegaSenaProbabilityInfo.tsx, trocando a
 * config, a faixa de premiação (duque/terno/quadra/quina, em vez de
 * quadra/quina/sena) e o texto sobre dias de sorteio. Termina com os
 * mesmos avisos obrigatórios: isto é estatística, nunca previsão.
 */
export function QuinaProbabilityInfo() {
  const totalCombinations = calculateCombination(QUINA_CONFIG.maxNumber, QUINA_CONFIG.drawnNumbers);
  const distribution = calculateHitDistribution({
    maxNumber: QUINA_CONFIG.maxNumber,
    drawnNumbers: QUINA_CONFIG.drawnNumbers,
    betSize: QUINA_CONFIG.drawnNumbers,
  });

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">Como funciona a Quina</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-700">
          A Quina sorteia {QUINA_CONFIG.drawnNumbers} números entre{" "}
          {String(QUINA_CONFIG.minNumber).padStart(2, "0")} e {QUINA_CONFIG.maxNumber}, de segunda a sábado. Na
          aposta simples, você escolhe de {QUINA_CONFIG.minBetNumbers} a {QUINA_CONFIG.maxBetNumbers} números:
          quanto mais números você marca, mais combinações de {QUINA_CONFIG.drawnNumbers} dezenas a sua aposta cobre
          ao mesmo tempo — o que é bem diferente de &ldquo;aumentar a chance de uma combinação específica dar
          certo&rdquo;. O valor da aposta cresce conforme você marca mais números, porque cada combinação extra é
          paga separadamente; consulte sempre o valor atual no site oficial da loteria antes de apostar. Além da
          quina (acertar as 5 dezenas), a Quina também premia quem acerta a quadra (4 dezenas), o terno (3 dezenas)
          ou o duque (2 dezenas).
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">A fórmula por trás do número</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-700">
          A quantidade de combinações possíveis de {QUINA_CONFIG.drawnNumbers} números entre{" "}
          {QUINA_CONFIG.maxNumber} é dada pela combinação matemática C(n, k) = n! / (k! × (n − k)!). Para a Quina,
          isso é C({QUINA_CONFIG.maxNumber}, {QUINA_CONFIG.drawnNumbers}) = {formatInt(totalCombinations)}{" "}
          combinações possíveis — o denominador de qualquer chance de acertar as {QUINA_CONFIG.drawnNumbers} dezenas
          sorteadas com uma aposta simples de {QUINA_CONFIG.drawnNumbers} números.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">
          Probabilidades por quantidade de números
        </h2>
        <p className="mt-2 text-sm text-zinc-600">
          Calculado por combinatória, nunca por histórico de sorteios — a chance de acertar as{" "}
          {QUINA_CONFIG.drawnNumbers} dezenas sorteadas para cada tamanho de aposta.
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
                  Chance de acertar as {QUINA_CONFIG.drawnNumbers} dezenas
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {QUINA_BET_SIZES.map((betSize) => {
                const simpleBetsEquivalent = calculateCombination(betSize, QUINA_CONFIG.drawnNumbers);
                const odds = calculateOddsOneIn({
                  maxNumber: QUINA_CONFIG.maxNumber,
                  drawnNumbers: QUINA_CONFIG.drawnNumbers,
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
          Chance de duque, terno, quadra e quina numa aposta simples
        </h2>
        <p className="mt-2 text-sm text-zinc-600">
          Numa aposta simples de {QUINA_CONFIG.drawnNumbers} números, esta é a chance exata (hipergeométrica) de
          acertar cada quantidade de dezenas — a mesma matemática de qualquer premiação da Quina.
        </p>
        <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200">
          <table className="w-full min-w-[360px] text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  Dezenas acertadas
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Chance
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {distribution
                .filter((entry) => entry.hits >= 2)
                .map((entry) => (
                  <tr key={entry.hits}>
                    <td className="px-3 py-2 font-semibold text-zinc-900">
                      {entry.hits}
                      {HIT_LABELS[entry.hits] ?? ""}
                    </td>
                    <td className="px-3 py-2 text-zinc-700">1 em {formatInt(1 / entry.probability)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">
          Estatística não é previsão
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-700">
          Filtros como &ldquo;pares e ímpares equilibrados&rdquo; ou &ldquo;quantidade de números primos&rdquo; só
          organizam a composição do seu jogo com base em padrões que costumam aparecer nos sorteios — mas isso não
          muda a chance matemática da combinação específica que você monta. Frequência passada não torna uma dezena
          mais provável no próximo sorteio: cada sorteio da Quina é independente dos anteriores.
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
