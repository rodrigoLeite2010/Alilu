"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { LotteryNumberGrid } from "./LotteryNumberGrid";
import { LOTOFACIL_CONFIG } from "@/lib/lotteries/lotofacil-config";
import { buildLotofacilCsv } from "@/lib/lotteries/lotofacil-generator";
import {
  FULL_WHEEL_MAX_NUMBERS,
  REDUCED_WHEEL_MAX_NUMBERS,
  WHEEL_MIN_NUMBERS,
  countFullWheelGames,
  countReducedWheelGames,
  generateFullWheel,
  generateReducedWheel,
  getReducedWheelGuarantee,
  validateFullWheelSelection,
  validateReducedWheelSelection,
} from "@/lib/lotteries/wheeling";

type WheelMode = "completo" | "reduzido";

function formatNumbers(numbers: readonly number[]): string {
  return numbers.map((n) => String(n).padStart(2, "0")).join(" ");
}

function formatInt(value: number): string {
  return value.toLocaleString("pt-BR");
}

/**
 * Ferramenta de desdobramento (wheeling) — os dois itens do Prompt 1 que
 * ficaram fora do MVP. Toda a matemática vem de lib/lotteries/wheeling.ts
 * (inclusive a garantia do fechamento reduzido, comprovada por força
 * bruta nos testes); este componente só coordena o seletor de números e
 * mostra o resultado. Pública, sem cadastro — igual ao gerador normal.
 */
export function LotofacilWheeling() {
  const [mode, setMode] = useState<WheelMode>("completo");
  const [selected, setSelected] = useState<number[]>([]);
  const [games, setGames] = useState<number[][] | null>(null);
  const [guaranteedHits, setGuaranteedHits] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const maxNumbers = mode === "completo" ? FULL_WHEEL_MAX_NUMBERS : REDUCED_WHEEL_MAX_NUMBERS;

  function handleModeChange(nextMode: WheelMode) {
    setMode(nextMode);
    setGames(null);
    setGuaranteedHits(null);
    setError(null);
    setCopied(false);
    const nextMax = nextMode === "completo" ? FULL_WHEEL_MAX_NUMBERS : REDUCED_WHEEL_MAX_NUMBERS;
    if (selected.length > nextMax) {
      setSelected((prev) => prev.slice(0, nextMax));
    }
  }

  function toggleNumber(n: number) {
    setGames(null);
    setGuaranteedHits(null);
    setError(null);
    setCopied(false);
    setSelected((prev) => {
      if (prev.includes(n)) return prev.filter((x) => x !== n);
      if (prev.length >= maxNumbers) return prev;
      return [...prev, n];
    });
  }

  const validation = useMemo(
    () => (mode === "completo" ? validateFullWheelSelection(selected) : validateReducedWheelSelection(selected)),
    [mode, selected]
  );

  const preview = useMemo(() => {
    if (!validation.valid) return null;
    if (mode === "completo") {
      return { gameCount: countFullWheelGames(selected.length), guarantee: null as number | null };
    }
    return {
      gameCount: countReducedWheelGames(selected.length),
      guarantee: getReducedWheelGuarantee(selected.length),
    };
  }, [mode, selected, validation.valid]);

  function handleGenerate() {
    setError(null);
    setCopied(false);
    try {
      if (mode === "completo") {
        setGames(generateFullWheel(selected));
        setGuaranteedHits(null);
      } else {
        const result = generateReducedWheel(selected);
        setGames(result.games);
        setGuaranteedHits(result.guaranteedHits);
      }
    } catch (err) {
      setGames(null);
      setGuaranteedHits(null);
      setError(err instanceof Error ? err.message : "Não foi possível montar o desdobramento agora.");
    }
  }

  function handleDownloadCsv() {
    if (!games || games.length === 0) return;
    const csv = buildLotofacilCsv(games);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = mode === "completo" ? "desdobramento-lotofacil-alilu.csv" : "fechamento-lotofacil-alilu.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleCopyAll() {
    if (!games) return;
    const text = games.map((game, index) => `Jogo ${index + 1}: ${formatNumbers(game)}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-sm font-medium text-zinc-700">O que você quer montar</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => handleModeChange("completo")}
            aria-pressed={mode === "completo"}
            className={`rounded-lg border p-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
              mode === "completo" ? "border-teal-700 bg-teal-50" : "border-zinc-300 hover:bg-zinc-50"
            }`}
          >
            <span className="block text-sm font-semibold text-zinc-900">Desdobramento completo</span>
            <span className="block text-xs text-zinc-500">
              Gera TODAS as combinações de 15 números dentro do grupo escolhido (de 16 a {FULL_WHEEL_MAX_NUMBERS}{" "}
              números) — cobertura total, sem nenhuma garantia extra.
            </span>
          </button>
          <button
            type="button"
            onClick={() => handleModeChange("reduzido")}
            aria-pressed={mode === "reduzido"}
            className={`rounded-lg border p-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
              mode === "reduzido" ? "border-teal-700 bg-teal-50" : "border-zinc-300 hover:bg-zinc-50"
            }`}
          >
            <span className="block text-sm font-semibold text-zinc-900">Fechamento reduzido</span>
            <span className="block text-xs text-zinc-500">
              Bem menos jogos (de 16 a {REDUCED_WHEEL_MAX_NUMBERS} números), com garantia matemática comprovada de
              acerto mínimo se o sorteio cair todo dentro do grupo escolhido.
            </span>
          </button>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium text-zinc-700">
            Escolha de {WHEEL_MIN_NUMBERS} a {maxNumbers} números
          </p>
          <p className="text-sm text-zinc-500">{selected.length} marcados</p>
        </div>
        <LotteryNumberGrid
          minNumber={LOTOFACIL_CONFIG.minNumber}
          maxNumber={LOTOFACIL_CONFIG.maxNumber}
          size="sm"
          selected={selected}
          onToggle={toggleNumber}
          ariaLabel="Números do grupo de desdobramento"
        />
        {!validation.valid && selected.length > 0 ? (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {validation.error}
          </p>
        ) : null}
      </div>

      {preview ? (
        <div className="rounded-lg bg-zinc-50 p-3 text-sm text-zinc-700">
          {mode === "completo" ? (
            <p>
              Isso vai gerar <strong>{formatInt(preview.gameCount)} jogos</strong>.
            </p>
          ) : (
            <p>
              Isso vai gerar <strong>{formatInt(preview.gameCount)} jogos</strong>, garantindo pelo menos{" "}
              <strong>{preview.guarantee} pontos</strong> em algum deles, se as 15 dezenas sorteadas estiverem todas
              entre os {selected.length} números marcados.
            </p>
          )}
        </div>
      ) : null}

      <Button type="button" onClick={handleGenerate} disabled={!validation.valid} className="w-full justify-center py-3 text-base">
        {mode === "completo" ? "Gerar desdobramento" : "Gerar fechamento"}
      </Button>

      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}

      {games && games.length > 0 ? (
        <div className="space-y-3 rounded-lg border border-zinc-200 p-4 sm:p-5">
          {guaranteedHits !== null ? (
            <div className="rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-teal-900">
              <p className="font-semibold">Garantia deste fechamento</p>
              <p className="mt-1">
                Se as 15 dezenas sorteadas estiverem todas entre os números que você marcou, pelo menos um dos{" "}
                {games.length} jogos abaixo vai acertar no mínimo <strong>{guaranteedHits} pontos</strong>. Essa
                garantia foi comprovada por computação para todos os sorteios possíveis dentro do grupo — não é uma
                estimativa.
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-zinc-700">{games.length} jogos gerados</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => void handleCopyAll()}
                className="min-h-9 px-3 py-1.5 text-xs"
              >
                {copied ? "Copiado!" : "Copiar todos"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleDownloadCsv}
                className="min-h-9 px-3 py-1.5 text-xs"
              >
                <Download className="h-4 w-4" aria-hidden />
                Baixar CSV
              </Button>
            </div>
          </div>
          <ul className="max-h-[32rem] space-y-2 overflow-y-auto pr-1">
            {games.map((game, index) => (
              <li key={`${index}-${game.join("-")}`} className="rounded-md border border-zinc-200 p-3 text-sm">
                <span className="font-semibold text-zinc-700">Jogo {index + 1}: </span>
                <span className="text-zinc-900">{formatNumbers(game)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
