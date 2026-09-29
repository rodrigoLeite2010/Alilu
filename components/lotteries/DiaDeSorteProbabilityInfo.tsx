import { DIA_DE_SORTE_BET_SIZES, DIA_DE_SORTE_CONFIG } from "@/lib/lotteries/dia-de-sorte-config";
import { calculateCombination, calculateHitDistribution, calculateOddsOneIn } from "@/lib/lotteries/combinatorics";

function formatInt(value: number): string {
  return Math.round(value).toLocaleString("pt-BR");
}

const HIT_LABELS: Record<number, string> = {
  7: " (prêmio principal)",
};

const PRIZE_BY_HITS: Record<number, string> = {
  7: "Prêmio principal (valor variável, depende da arrecadação)",
  6: "Prêmio variável",
  5: "R$ 25,00 fixo",
  4: "R$ 5,00 fixo",
};

/**
 * Conteúdo educativo do Dia de Sorte: regras, fórmula da combinação,
 * tabela de probabilidade por quantidade de números e — a diferença
 * central desta modalidade em relação a Lotofácil/Mega-Sena/Quina/
 * Lotomania — uma seção própria explicando o Mês da Sorte como um
 * sorteio SEPARADO e independente dos números, com sua própria faixa de
 * premiação (o "mês certo sozinho"). Todos os valores de chance são
 * CALCULADOS em tempo real por combinatória (lib/lotteries/combinatorics.ts),
 * nunca copiados de uma tabela "oficial" memorizada — inclusive a chance
 * do mês (1 em 12), calculada como C(12,1)/C(1,1) por
 * calculateOddsOneIn, pela mesma razão: nenhum número mágico solto no
 * código. Termina com os mesmos avisos obrigatórios de toda outra
 * modalidade: isto é estatística, nunca previsão.
 */
export function DiaDeSorteProbabilityInfo() {
  const totalCombinations = calculateCombination(DIA_DE_SORTE_CONFIG.maxNumber, DIA_DE_SORTE_CONFIG.drawnNumbers);
  const distribution = calculateHitDistribution({
    maxNumber: DIA_DE_SORTE_CONFIG.maxNumber,
    drawnNumbers: DIA_DE_SORTE_CONFIG.drawnNumbers,
    betSize: DIA_DE_SORTE_CONFIG.minBetNumbers,
  });
  const monthOdds = calculateOddsOneIn({ maxNumber: 12, drawnNumbers: 1, betSize: 1 });

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">Como funciona o Dia de Sorte</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-700">
          O Dia de Sorte sorteia {DIA_DE_SORTE_CONFIG.drawnNumbers} números entre{" "}
          {String(DIA_DE_SORTE_CONFIG.minNumber).padStart(2, "0")} e {DIA_DE_SORTE_CONFIG.maxNumber} (representando
          os dias do mês), às terças, quintas e sábados. Na aposta simples, você escolhe de{" "}
          {DIA_DE_SORTE_CONFIG.minBetNumbers} a {DIA_DE_SORTE_CONFIG.maxBetNumbers} números — quanto mais números
          você marca, mais combinações de {DIA_DE_SORTE_CONFIG.drawnNumbers} dezenas a sua aposta cobre ao mesmo
          tempo, o que é bem diferente de &ldquo;aumentar a chance de uma combinação específica dar certo&rdquo;.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-zinc-700">
          A particularidade do Dia de Sorte em relação a toda outra loteria da Caixa: TODA aposta, sem exceção,
          também exige escolher exatamente 1 &ldquo;Mês da Sorte&rdquo; entre os 12 meses do calendário — um sorteio
          totalmente separado dos números, explicado em detalhe mais abaixo. A aposta mínima (
          {DIA_DE_SORTE_CONFIG.minBetNumbers} números + 1 mês) custa R$ 2,50 — mas confira sempre o valor atualizado
          no site oficial da loteria antes de apostar, já que a Caixa pode reajustá-lo a qualquer momento.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">A fórmula por trás do número</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-700">
          A quantidade de combinações possíveis de {DIA_DE_SORTE_CONFIG.drawnNumbers} números entre{" "}
          {DIA_DE_SORTE_CONFIG.maxNumber} é dada pela combinação matemática C(n, k) = n! / (k! × (n − k)!). Para o
          Dia de Sorte, isso é C({DIA_DE_SORTE_CONFIG.maxNumber}, {DIA_DE_SORTE_CONFIG.drawnNumbers}) ={" "}
          {formatInt(totalCombinations)} combinações possíveis — o denominador de qualquer chance de acertar as{" "}
          {DIA_DE_SORTE_CONFIG.drawnNumbers} dezenas sorteadas com uma aposta simples de{" "}
          {DIA_DE_SORTE_CONFIG.drawnNumbers} números.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">
          Probabilidades por quantidade de números
        </h2>
        <p className="mt-2 text-sm text-zinc-600">
          Calculado por combinatória, nunca por histórico de sorteios — a chance de acertar as{" "}
          {DIA_DE_SORTE_CONFIG.drawnNumbers} dezenas sorteadas para cada tamanho de aposta.
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
                  Chance de acertar as {DIA_DE_SORTE_CONFIG.drawnNumbers} dezenas
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {DIA_DE_SORTE_BET_SIZES.map((betSize) => {
                const simpleBetsEquivalent = calculateCombination(betSize, DIA_DE_SORTE_CONFIG.drawnNumbers);
                const odds = calculateOddsOneIn({
                  maxNumber: DIA_DE_SORTE_CONFIG.maxNumber,
                  drawnNumbers: DIA_DE_SORTE_CONFIG.drawnNumbers,
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
          Faixas de premiação pelos números, numa aposta simples
        </h2>
        <p className="mt-2 text-sm text-zinc-600">
          Numa aposta simples de {DIA_DE_SORTE_CONFIG.drawnNumbers} números, esta é a chance exata
          (hipergeométrica) de acertar cada quantidade de dezenas — a mesma matemática de qualquer premiação do Dia
          de Sorte pelos números. As faixas que pagam prêmio são 4, 5, 6 e as {DIA_DE_SORTE_CONFIG.drawnNumbers}{" "}
          dezenas certas; acertar menos que isso não premia por essa faixa (mas pode premiar pelo mês — ver a
          próxima seção).
        </p>
        <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  Dezenas acertadas
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Chance
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Prêmio
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
                      {HIT_LABELS[entry.hits] ?? ""}
                    </td>
                    <td className="px-3 py-2 text-zinc-700">1 em {formatInt(1 / entry.probability)}</td>
                    <td className="px-3 py-2 text-zinc-700">{PRIZE_BY_HITS[entry.hits] ?? "—"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">
          O Mês da Sorte: um sorteio independente dos números
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-700">
          Além dos {DIA_DE_SORTE_CONFIG.drawnNumbers} números, cada concurso do Dia de Sorte também sorteia 1 mês
          entre os 12 do calendário — e cada aposta precisa marcar exatamente 1 mês, junto com os números. Esse
          sorteio do mês é matematicamente independente do sorteio dos números: acertar ou errar os números não
          muda em nada a chance de acertar o mês, e vice-versa.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-zinc-700">
          Quem acerta SÓ o mês (sem atingir nenhuma das faixas de premiação pelos números da seção anterior) ganha
          um prêmio fixo de R$ 2,50, com chance de 1 em {formatInt(monthOdds)} — exatamente 1 em 12, já que existem
          12 meses e você marca 1 deles, e essa chance não muda conforme a quantidade de números que você escolhe
          apostar.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-zinc-700">
          <strong className="font-semibold text-zinc-900">Os prêmios se somam</strong>: se a mesma aposta acertar
          tanto uma das faixas de números (4, 5, 6 ou {DIA_DE_SORTE_CONFIG.drawnNumbers} dezenas) quanto o mês
          sorteado, ela recebe os dois prêmios juntos, não só o maior dos dois — são duas premiações
          independentes pagas sobre a mesma aposta.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">
          Estatística não é previsão
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-700">
          Filtros como &ldquo;pares e ímpares equilibrados&rdquo; ou &ldquo;quantidade de números primos&rdquo; só
          organizam a composição do seu jogo com base em padrões que costumam aparecer nos sorteios — mas isso não
          muda a chance matemática da combinação específica que você monta, nem a chance do Mês da Sorte, que é
          sempre 1 em 12 independentemente de qualquer filtro. Frequência passada não torna uma dezena (ou um mês)
          mais provável no próximo sorteio: cada sorteio do Dia de Sorte é independente dos anteriores.
        </p>
      </section>

      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
        <p className="text-sm font-semibold text-amber-900">Importante</p>
        <p className="mt-1 text-sm text-amber-900">
          As combinações geradas nesta ferramenta são apenas sugestões matemáticas e estatísticas. Nenhum padrão
          histórico ou filtro pode prever os números ou o mês de um sorteio futuro.
        </p>
        <p className="mt-2 text-sm text-amber-900">Jogue com responsabilidade.</p>
      </div>
    </div>
  );
}
