"use client";

import { useState } from "react";
import { Check, Copy, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { LotteryNumberGrid } from "./LotteryNumberGrid";
import { DIA_DE_SORTE_CONFIG } from "@/lib/lotteries/dia-de-sorte-config";
import { MONTH_LABELS, analyzeGame } from "@/lib/lotteries/dia-de-sorte-generator";

function formatNumbers(numbers: readonly number[]): string {
  return numbers.map((n) => String(n).padStart(2, "0")).join(" ");
}

/**
 * Resultado de UM jogo gerado do Dia de Sorte — volante visual (1 a 31) +
 * análise (pares/ímpares/primos/soma/maior sequência/linhas usadas) +
 * copiar + gerar outro. Mesma estrutura de QuinaGameResult.tsx, com UMA
 * adição: o Mês da Sorte sorteado junto (`month`, 1 a 12) aparece em
 * destaque logo abaixo do volante — a escolha do mês é feita no
 * DiaDeSorteGenerator.tsx (a "fonte da verdade" de qual mês está
 * selecionado), este componente só EXIBE o mês do jogo que recebeu via
 * prop, nunca decide nem recalcula um mês sozinho. Recalcula a análise
 * dos NÚMEROS a partir de `numbers` — nunca recebe pares/soma/etc.
 * prontos de fora, para nunca ficar dessincronizado do jogo exibido (o
 * mês, ao contrário, não tem "análise": é só exibido como veio).
 */
export function DiaDeSorteGameResult({
  numbers,
  month,
  onGenerateAnother,
  busy = false,
}: {
  numbers: readonly number[];
  month: number;
  onGenerateAnother?: () => void;
  busy?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const analysis = analyzeGame(numbers);
  const monthLabel = MONTH_LABELS[month - 1] ?? "";

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(`${formatNumbers(analysis.numbers)} — Mês da Sorte: ${monthLabel}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="rounded-lg border border-zinc-200 p-4 sm:p-5">
      <p className="mb-3 text-sm font-medium text-zinc-700">Seu jogo</p>

      <LotteryNumberGrid
        minNumber={DIA_DE_SORTE_CONFIG.minNumber}
        maxNumber={DIA_DE_SORTE_CONFIG.maxNumber}
        columns={7}
        selected={analysis.numbers}
        ariaLabel="Números do jogo gerado"
      />

      <div className="mt-4 rounded-md bg-teal-50 px-3 py-2 text-sm">
        <span className="text-zinc-600">Mês da Sorte: </span>
        <span className="font-semibold text-teal-800">{monthLabel}</span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-zinc-500">Dezenas</dt>
          <dd className="font-semibold text-zinc-900">{analysis.count}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Pares</dt>
          <dd className="font-semibold text-zinc-900">{analysis.even}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Ímpares</dt>
          <dd className="font-semibold text-zinc-900">{analysis.odd}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Primos</dt>
          <dd className="font-semibold text-zinc-900">{analysis.primes}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Soma</dt>
          <dd className="font-semibold text-zinc-900">{analysis.sum}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Maior sequência</dt>
          <dd className="font-semibold text-zinc-900">{analysis.longestSequence}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Linhas do volante</dt>
          <dd className="font-semibold text-zinc-900">
            {analysis.usedRows}/{analysis.totalRows}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={() => void handleCopy()} className="min-h-9 px-3 py-1.5 text-xs">
          {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
          {copied ? "Copiado!" : "Copiar números"}
        </Button>
        {onGenerateAnother ? (
          <Button
            type="button"
            variant="secondary"
            onClick={onGenerateAnother}
            disabled={busy}
            className="min-h-9 px-3 py-1.5 text-xs"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Gerar outro
          </Button>
        ) : null}
      </div>
    </div>
  );
}
