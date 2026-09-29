"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { LOTOFACIL_BET_SIZES, LOTOFACIL_CONFIG } from "@/lib/lotteries/lotofacil-config";
import {
  MONTE_CARLO_TRIAL_OPTIONS,
  simulateHitDistribution,
  type HitSimulationResult,
} from "@/lib/lotteries/monte-carlo";

function formatPercent(value: number): string {
  return `${(value * 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}%`;
}

function formatInt(value: number): string {
  return value.toLocaleString("pt-BR");
}

/**
 * Simulação de Monte Carlo (Prompt 1, item que ficou fora do MVP):
 * SORTEIA de verdade, no navegador da pessoa, milhares ou milhões de
 * resultados aleatórios de {drawnNumbers} dezenas, e compara a frequência
 * observada com a distribuição EXATA (a mesma tabela acima, calculada por
 * combinatória em lib/lotteries/combinatorics.ts) — mostra visualmente
 * que os dois batem, reforçando que não existe nenhum padrão a explorar.
 * Toda a simulação está em lib/lotteries/monte-carlo.ts; este componente
 * só coordena estado de UI. Usa `window.setTimeout` antes de rodar para
 * deixar o rótulo "Simulando..." aparecer na tela antes do cálculo (que,
 * com 1.000.000 de simulações, pode levar um instante).
 */
export function LotofacilMonteCarloSimulation() {
  const [betSize, setBetSize] = useState(15);
  const [trials, setTrials] = useState(10000);
  const [result, setResult] = useState<HitSimulationResult | null>(null);
  const [running, setRunning] = useState(false);

  function handleRun() {
    setRunning(true);
    setResult(null);
    window.setTimeout(() => {
      const simulation = simulateHitDistribution({ betSize, trials });
      setResult(simulation);
      setRunning(false);
    }, 10);
  }

  return (
    <div className="space-y-4 rounded-lg border border-zinc-200 p-4 sm:p-5">
      <p className="text-sm leading-relaxed text-zinc-700">
        Em vez de só calcular, esta ferramenta SORTEIA de verdade, aqui no seu navegador, vários resultados
        aleatórios de {LOTOFACIL_CONFIG.drawnNumbers} dezenas e conta quantos acertos uma aposta fixa teria em cada
        sorteio simulado — depois compara com a probabilidade exata (a mesma da tabela acima). Não importa quais
        números específicos você escolhe: por simetria, qualquer combinação do mesmo tamanho tem a mesma
        distribuição de acertos.
      </p>

      <div>
        <p className="mb-2 text-sm font-medium text-zinc-700">Tamanho da aposta simulada</p>
        <div className="flex flex-wrap gap-2">
          {LOTOFACIL_BET_SIZES.map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => setBetSize(size)}
              aria-pressed={betSize === size}
              className={`min-h-9 min-w-9 rounded-md border px-3 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                betSize === size
                  ? "border-teal-700 bg-teal-50 text-teal-800"
                  : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-zinc-700">Quantidade de sorteios simulados</p>
        <div className="flex flex-wrap gap-2">
          {MONTE_CARLO_TRIAL_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setTrials(option)}
              aria-pressed={trials === option}
              className={`min-h-9 rounded-md border px-3 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                trials === option
                  ? "border-teal-700 bg-teal-50 text-teal-800"
                  : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              {formatInt(option)}
            </button>
          ))}
        </div>
      </div>

      <Button type="button" onClick={handleRun} disabled={running} className="w-full justify-center py-2.5">
        {running ? "Simulando..." : "Rodar simulação"}
      </Button>

      {result ? (
        <div className="overflow-x-auto rounded-lg border border-zinc-200">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  Acertos
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Simulado ({formatInt(result.trials)} sorteios)
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Probabilidade exata
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {result.entries.map((entry) => (
                <tr key={entry.hits}>
                  <td className="px-3 py-2 font-semibold text-zinc-900">{entry.hits}</td>
                  <td className="px-3 py-2 text-zinc-700">
                    {formatInt(entry.simulatedCount)}× ({formatPercent(entry.simulatedProbability)})
                  </td>
                  <td className="px-3 py-2 text-zinc-700">{formatPercent(entry.probability)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
