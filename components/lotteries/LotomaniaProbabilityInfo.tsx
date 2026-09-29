import { LOTOMANIA_CONFIG } from "@/lib/lotteries/lotomania-config";
import { calculateCombination, calculateHitDistribution } from "@/lib/lotteries/combinatorics";

function formatInt(value: number): string {
  return Math.round(value).toLocaleString("pt-BR");
}

/** As 7 faixas de premiação da Lotomania, na ordem em que aparecem na tabela — a principal (20) primeiro, depois 19 a 15, e por último a "faixa espelho" (0). */
const PRIZE_TIER_HITS = [20, 19, 18, 17, 16, 15, 0] as const;

const HIT_LABELS: Record<number, string> = {
  20: " (prêmio principal)",
  0: " (faixa espelho)",
};

/**
 * Conteúdo educativo da Lotomania: regras, fórmula da combinação e tabela
 * de probabilidade — mas, diferente de MegaSenaProbabilityInfo.tsx e
 * QuinaProbabilityInfo.tsx, NÃO mostra uma tabela "por quantidade de
 * números marcados" (não existe escolha de quantidade aqui, a aposta é
 * sempre 50 números) nem uma faixa contínua de acertos. Em vez disso,
 * mostra só as 7 faixas de premiação reais da Lotomania — 15 a 20 acertos
 * e a curiosa "faixa espelho" de 0 acertos — usando
 * calculateHitDistribution({ maxNumber: 100 (tamanho do pool, não o maior
 * número, que é 99), drawnNumbers: 20, betSize: 50 }), sempre CALCULADA
 * em tempo real por combinatória, nunca copiada de uma tabela "oficial"
 * memorizada. Termina com os mesmos avisos obrigatórios de toda outra
 * modalidade: isto é estatística, nunca previsão.
 */
export function LotomaniaProbabilityInfo() {
  const poolSize = LOTOMANIA_CONFIG.maxNumber - LOTOMANIA_CONFIG.minNumber + 1; // 100 números (00 a 99)
  const totalCombinations = calculateCombination(poolSize, LOTOMANIA_CONFIG.drawnNumbers);
  const distribution = calculateHitDistribution({
    maxNumber: poolSize,
    drawnNumbers: LOTOMANIA_CONFIG.drawnNumbers,
    betSize: LOTOMANIA_CONFIG.minBetNumbers,
  });
  const distributionByHits = new Map(distribution.map((entry) => [entry.hits, entry]));

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">Como funciona a Lotomania</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-700">
          A Lotomania sorteia {LOTOMANIA_CONFIG.drawnNumbers} números entre{" "}
          {String(LOTOMANIA_CONFIG.minNumber).padStart(2, "0")} e {LOTOMANIA_CONFIG.maxNumber} ({poolSize} números ao
          todo — é a única loteria da Caixa em que o &ldquo;00&rdquo; também é um número válido e sorteável). Ao
          contrário da Lotofácil, da Mega-Sena e da Quina, aqui não existe escolha de quantidade de dezenas: toda
          aposta simples marca sempre exatamente {LOTOMANIA_CONFIG.minBetNumbers} números, metade do volante. O
          valor da aposta é fixo — consulte sempre o valor atual no site oficial da loteria antes de apostar, já
          que a Caixa pode reajustá-lo a qualquer momento.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">A fórmula por trás do número</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-700">
          A quantidade de combinações possíveis de {LOTOMANIA_CONFIG.drawnNumbers} números entre {poolSize} é dada
          pela combinação matemática C(n, k) = n! / (k! × (n − k)!). Para a Lotomania, isso é C({poolSize},{" "}
          {LOTOMANIA_CONFIG.drawnNumbers}) = {formatInt(totalCombinations)} combinações possíveis para o resultado
          do sorteio.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">
          Faixas de premiação: por que acertar ZERO números também ganha prêmio
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-700">
          A Lotomania premia quem acerta 15, 16, 17, 18, 19 ou as 20 dezenas sorteadas — e, de forma única entre as
          loterias da Caixa, também premia quem não acerta NENHUMA das {LOTOMANIA_CONFIG.drawnNumbers} dezenas
          sorteadas (a chamada &ldquo;faixa espelho&rdquo;). Isso não é um bônus arbitrário: é uma simetria
          matemática exata. Como você marca exatamente metade do volante ({LOTOMANIA_CONFIG.minBetNumbers} de{" "}
          {poolSize} números), as {LOTOMANIA_CONFIG.drawnNumbers} dezenas sorteadas caem ou majoritariamente entre as
          suas marcadas, ou majoritariamente entre as {LOTOMANIA_CONFIG.minBetNumbers} que você deixou de fora — e
          acertar todas as {LOTOMANIA_CONFIG.drawnNumbers} dezenas sorteadas é exatamente tão provável quanto
          errar todas elas (o que equivale a acertar as {LOTOMANIA_CONFIG.drawnNumbers} dezenas entre os outros{" "}
          {LOTOMANIA_CONFIG.minBetNumbers} números, os que você não marcou). Por isso as duas faixas têm a mesma
          chance na tabela abaixo. Isto é só uma curiosidade honesta da combinatória do jogo — não significa que
          apostar para &ldquo;acertar zero&rdquo; seja mais fácil de prever ou mais vantajoso do que qualquer outra
          combinação: continua sendo a mesma matemática de sempre, nunca previsão de resultado.
        </p>
        <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200">
          <table className="w-full min-w-[360px] text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  Dezenas acertadas
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Chance (numa aposta de {LOTOMANIA_CONFIG.minBetNumbers} números)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {PRIZE_TIER_HITS.map((hits) => {
                const entry = distributionByHits.get(hits);
                if (!entry) return null;
                return (
                  <tr key={hits}>
                    <td className="px-3 py-2 font-semibold text-zinc-900">
                      {hits}
                      {HIT_LABELS[hits] ?? ""}
                    </td>
                    <td className="px-3 py-2 text-zinc-700">1 em {formatInt(1 / entry.probability)}</td>
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
          Filtros como &ldquo;pares e ímpares equilibrados&rdquo; ou &ldquo;quantidade de números primos&rdquo; só
          organizam a composição do seu jogo com base em padrões que costumam aparecer nos sorteios — mas isso não
          muda a chance matemática da combinação específica de {LOTOMANIA_CONFIG.minBetNumbers} números que você
          monta. Frequência passada não torna uma dezena mais provável no próximo sorteio: cada sorteio da
          Lotomania é independente dos anteriores.
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
