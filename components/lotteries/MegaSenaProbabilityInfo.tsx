import { MEGASENA_BET_SIZES, MEGASENA_CONFIG } from "@/lib/lotteries/megasena-config";
import { calculateCombination, calculateHitDistribution, calculateOddsOneIn } from "@/lib/lotteries/combinatorics";

function formatInt(value: number): string {
  return Math.round(value).toLocaleString("pt-BR");
}

/**
 * Conteúdo educativo da Mega-Sena: regras, fórmula da combinação e tabela
 * de probabilidade por quantidade de números — sempre CALCULADA em tempo
 * real por combinatória (lib/lotteries/combinatorics.ts, já genérico e
 * reaproveitado tal como está), nunca copiada de uma tabela "oficial"
 * memorizada. Mesmo espírito de LotofacilProbabilityEducation.tsx, mas SEM
 * simulação de Monte Carlo e SEM vídeo — este é o MVP (Fase A) da
 * Mega-Sena; esses extras podem vir depois, se pedido, em outra rodada.
 * Termina com os mesmos avisos obrigatórios: isto é estatística, nunca
 * previsão.
 */
export function MegaSenaProbabilityInfo() {
  const totalCombinations = calculateCombination(MEGASENA_CONFIG.maxNumber, MEGASENA_CONFIG.drawnNumbers);
  const distribution = calculateHitDistribution({
    maxNumber: MEGASENA_CONFIG.maxNumber,
    drawnNumbers: MEGASENA_CONFIG.drawnNumbers,
    betSize: MEGASENA_CONFIG.drawnNumbers,
  });

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">Como funciona a Mega-Sena</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-700">
          A Mega-Sena sorteia {MEGASENA_CONFIG.drawnNumbers} números entre{" "}
          {String(MEGASENA_CONFIG.minNumber).padStart(2, "0")} e {MEGASENA_CONFIG.maxNumber}, às terças, quintas e
          sábados. Na aposta simples, você escolhe de {MEGASENA_CONFIG.minBetNumbers} a{" "}
          {MEGASENA_CONFIG.maxBetNumbers} números: quanto mais números você marca, mais combinações de{" "}
          {MEGASENA_CONFIG.drawnNumbers} dezenas a sua aposta cobre ao mesmo tempo — o que é bem diferente de
          &ldquo;aumentar a chance de uma combinação específica dar certo&rdquo;. Além da sena (acertar as 6 dezenas),
          a Mega-Sena também premia quem acerta a quina (5 dezenas) ou a quadra (4 dezenas).
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">A fórmula por trás do número</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-700">
          A quantidade de combinações possíveis de {MEGASENA_CONFIG.drawnNumbers} números entre{" "}
          {MEGASENA_CONFIG.maxNumber} é dada pela combinação matemática C(n, k) = n! / (k! × (n − k)!). Para a
          Mega-Sena, isso é C({MEGASENA_CONFIG.maxNumber}, {MEGASENA_CONFIG.drawnNumbers}) ={" "}
          {formatInt(totalCombinations)} combinações possíveis — o denominador de qualquer chance de acertar as{" "}
          {MEGASENA_CONFIG.drawnNumbers} dezenas sorteadas com uma aposta simples de {MEGASENA_CONFIG.drawnNumbers}{" "}
          números.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">
          Probabilidades por quantidade de números
        </h2>
        <p className="mt-2 text-sm text-zinc-600">
          Calculado por combinatória, nunca por histórico de sorteios — a chance de acertar as{" "}
          {MEGASENA_CONFIG.drawnNumbers} dezenas sorteadas para cada tamanho de aposta.
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
                  Chance de acertar as {MEGASENA_CONFIG.drawnNumbers} dezenas
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {MEGASENA_BET_SIZES.map((betSize) => {
                const simpleBetsEquivalent = calculateCombination(betSize, MEGASENA_CONFIG.drawnNumbers);
                const odds = calculateOddsOneIn({
                  maxNumber: MEGASENA_CONFIG.maxNumber,
                  drawnNumbers: MEGASENA_CONFIG.drawnNumbers,
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
          Chance de quadra, quina e sena numa aposta simples
        </h2>
        <p className="mt-2 text-sm text-zinc-600">
          Numa aposta simples de {MEGASENA_CONFIG.drawnNumbers} números, esta é a chance exata (hipergeométrica) de
          acertar cada quantidade de dezenas — a mesma matemática de qualquer premiação da Mega-Sena.
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
                .filter((entry) => entry.hits >= 4)
                .map((entry) => (
                  <tr key={entry.hits}>
                    <td className="px-3 py-2 font-semibold text-zinc-900">
                      {entry.hits}
                      {entry.hits === 4 ? " (quadra)" : entry.hits === 5 ? " (quina)" : " (sena)"}
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
          mais provável no próximo sorteio: cada sorteio da Mega-Sena é independente dos anteriores.
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
