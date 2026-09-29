"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Dice5, Download, Save, Shuffle, Sparkles, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useHeaderAuth } from "@/components/layout/useHeaderAuth";
import { LotteryNumberGrid } from "./LotteryNumberGrid";
import { LotofacilGameResult } from "./LotofacilGameResult";
import { lotteryApi } from "./api";
import { LOTOFACIL_BET_SIZES, LOTOFACIL_CONFIG } from "@/lib/lotteries/lotofacil-config";
import {
  buildLotofacilCsv,
  generateGameByMode,
  generateMultipleGames,
  validateCustomSelection,
  type LotofacilMode,
} from "@/lib/lotteries/lotofacil-generator";

const MODE_OPTIONS: { id: LotofacilMode; label: string; description: string }[] = [
  { id: "aleatorio", label: "Aleatório", description: "Números totalmente aleatórios, sem nenhum filtro." },
  { id: "equilibrado", label: "Equilibrado", description: "Filtra pares/ímpares, primos e distribuição no volante." },
  { id: "personalizado", label: "Personalizado", description: "Você escolhe os números obrigatórios e excluídos." },
];

const DIVERSIFY_OPTION: { id: LotofacilMode; label: string; description: string } = {
  id: "diversificado",
  label: "Diversificar",
  description: "Foge das combinações que já estão no seu histórico — organização, nunca mais chance de acertar.",
};

const MULTI_QUANTITY_OPTIONS = [1, 5, 10, 20, 50];

function formatNumbers(numbers: readonly number[]): string {
  return numbers.map((n) => String(n).padStart(2, "0")).join(" ");
}

/**
 * Núcleo interativo do "Gerador Estatístico da Lotofácil" (Seções 4, 11,
 * 12, 14, 15, MVP; e Fase 2 — "Meus Jogos"): escolhe modo + quantidade de
 * dezenas, mostra os controles do modo Personalizado quando selecionado,
 * gera um jogo (com análise completa) ou vários de uma vez (com copiar
 * todos / baixar CSV / salvar no histórico). Toda a lógica de geração vem
 * de lib/lotteries/lotofacil-generator.ts — este componente só coordena
 * estado de UI, nunca decide números sozinho.
 *
 * O modo "Diversificar" e o botão "Salvar" só aparecem/funcionam para quem
 * está logado (useHeaderAuth, o mesmo hook do cabeçalho do site — nenhuma
 * autenticação nova) — o gerador continua 100% utilizável sem conta.
 */
export function LotofacilGenerator() {
  const auth = useHeaderAuth();
  const signedIn = auth.status === "signed-in";

  // "Reutilizar este jogo" (Fase 2, vindo de Meus Jogos): pré-preenche o
  // modo Personalizado com os números daquele jogo. useSearchParams (e não
  // window.location direto) porque o Next também resolve isto no
  // servidor, então o HTML da primeira renderização já sai coerente com o
  // que o cliente monta em seguida (sem divergência de hidratação).
  const searchParams = useSearchParams();
  const reuseNumbers = useMemo(() => {
    const raw = searchParams.get("reutilizar");
    if (!raw) return null;
    const numbers = raw
      .split(",")
      .map((value) => Number(value))
      .filter((n) => Number.isInteger(n) && n >= LOTOFACIL_CONFIG.minNumber && n <= LOTOFACIL_CONFIG.maxNumber);
    if (numbers.length < LOTOFACIL_CONFIG.minBetNumbers || numbers.length > LOTOFACIL_CONFIG.maxBetNumbers) return null;
    return numbers;
  }, [searchParams]);

  const [mode, setMode] = useState<LotofacilMode>(() => (reuseNumbers ? "personalizado" : "aleatorio"));
  const [betSize, setBetSize] = useState<number>(() => reuseNumbers?.length ?? LOTOFACIL_CONFIG.minBetNumbers);
  const [mustInclude, setMustInclude] = useState<number[]>(() => reuseNumbers ?? []);
  const [mustExclude, setMustExclude] = useState<number[]>([]);
  const [balancedFill, setBalancedFill] = useState(true);
  const [quantity, setQuantity] = useState(1);

  const [games, setGames] = useState<number[][] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const [pastGameNumbers, setPastGameNumbers] = useState<number[][]>([]);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Histórico de jogos já salvos (para o modo Diversificar e para avisar de
  // duplicidade) — só busca quando logado. Sem reset explícito ao deslogar:
  // o modo Diversificar já some da lista de modos (modeOptions depende de
  // signedIn), então um histórico "velho" parado em memória é inofensivo.
  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    lotteryApi
      .listBets("lotofacil")
      .then((bets) => {
        if (cancelled) return;
        setPastGameNumbers(bets.flatMap((bet) => bet.games.map((game) => game.numbers)));
      })
      .catch(() => {
        if (!cancelled) setPastGameNumbers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  const modeOptions = signedIn ? [...MODE_OPTIONS, DIVERSIFY_OPTION] : MODE_OPTIONS;

  const customValidation = useMemo(
    () =>
      mode === "personalizado"
        ? validateCustomSelection(betSize, mustInclude, mustExclude)
        : { valid: true as const },
    [mode, betSize, mustInclude, mustExclude]
  );

  function toggleInclude(n: number) {
    setMustInclude((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));
  }

  function toggleExclude(n: number) {
    setMustExclude((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));
  }

  function handleGenerate() {
    setError(null);
    setCopiedAll(false);
    setSaveState("idle");
    setSaveMessage(null);
    try {
      const options = { mustInclude, mustExclude, balanced: balancedFill };
      const newGames =
        quantity <= 1
          ? [generateGameByMode(mode, betSize, options, pastGameNumbers)]
          : generateMultipleGames(mode, betSize, quantity, options, pastGameNumbers);
      setGames(newGames);
    } catch (err) {
      setGames(null);
      setError(err instanceof Error ? err.message : "Não foi possível gerar o jogo agora. Tente novamente.");
    }
  }

  function handleDownloadCsv() {
    if (!games || games.length === 0) return;
    const csv = buildLotofacilCsv(games);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "jogos-lotofacil-alilu.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleCopyAll() {
    if (!games) return;
    const text = games.map((game, index) => `Jogo ${index + 1}: ${formatNumbers(game)}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch {
      setCopiedAll(false);
    }
  }

  async function handleSave() {
    if (!games || games.length === 0) return;
    setSaveState("saving");
    setSaveMessage(null);
    try {
      const gamesToSave = games.map((numbers) => ({ numbers, betSize, mode }));
      const result = await lotteryApi.saveBet({
        modality: "lotofacil",
        contestNumber: null,
        drawDate: null,
        amountCents: 0,
        note: null,
        games: gamesToSave,
      });
      setSaveState("saved");
      setSaveMessage(
        result.skippedDuplicates > 0
          ? `Salvo! ${result.skippedDuplicates} já estava${result.skippedDuplicates === 1 ? "" : "m"} no seu histórico.`
          : "Salvo no seu histórico."
      );
      setPastGameNumbers((prev) => [...prev, ...gamesToSave.map((g) => g.numbers)]);
    } catch (err) {
      setSaveState("error");
      setSaveMessage(err instanceof Error ? err.message : "Não foi possível salvar agora.");
    }
  }

  const canGenerate = mode !== "personalizado" || customValidation.valid;
  const modeIcon =
    mode === "aleatorio" ? (
      <Dice5 className="h-4 w-4" aria-hidden />
    ) : mode === "equilibrado" ? (
      <Sparkles className="h-4 w-4" aria-hidden />
    ) : mode === "diversificado" ? (
      <Shuffle className="h-4 w-4" aria-hidden />
    ) : (
      <SlidersHorizontal className="h-4 w-4" aria-hidden />
    );

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-sm font-medium text-zinc-700">Modo de geração</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {modeOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setMode(option.id)}
              aria-pressed={mode === option.id}
              className={`rounded-lg border p-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                mode === option.id ? "border-teal-700 bg-teal-50" : "border-zinc-300 hover:bg-zinc-50"
              }`}
            >
              <span className="block text-sm font-semibold text-zinc-900">{option.label}</span>
              <span className="block text-xs text-zinc-500">{option.description}</span>
            </button>
          ))}
        </div>
        {!signedIn ? (
          <p className="mt-2 text-xs text-zinc-500">
            <Link href="/entrar" className="font-medium text-teal-800 hover:underline">
              Entre
            </Link>{" "}
            para também usar o modo Diversificar, que compara com o seu histórico salvo.
          </p>
        ) : null}
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-zinc-700">Quantidade de dezenas</p>
        <div className="flex flex-wrap gap-2">
          {LOTOFACIL_BET_SIZES.map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => setBetSize(size)}
              aria-pressed={betSize === size}
              className={`min-h-10 min-w-10 rounded-md border px-3 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
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

      {mode === "personalizado" ? (
        <div className="space-y-4 rounded-lg border border-zinc-200 p-4">
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={balancedFill}
              onChange={(event) => setBalancedFill(event.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 text-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            />
            Preencher o restante com o filtro Equilibrado (pares/ímpares, primos e distribuição)
          </label>

          <div>
            <p className="mb-2 text-sm font-medium text-zinc-700">Quero incluir</p>
            <LotteryNumberGrid
              minNumber={LOTOFACIL_CONFIG.minNumber}
              maxNumber={LOTOFACIL_CONFIG.maxNumber}
              size="sm"
              selected={mustInclude}
              disabledNumbers={mustExclude}
              onToggle={toggleInclude}
              ariaLabel="Números que você quer incluir obrigatoriamente"
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-zinc-700">Não quero incluir</p>
            <LotteryNumberGrid
              minNumber={LOTOFACIL_CONFIG.minNumber}
              maxNumber={LOTOFACIL_CONFIG.maxNumber}
              size="sm"
              selected={mustExclude}
              disabledNumbers={mustInclude}
              onToggle={toggleExclude}
              ariaLabel="Números que você quer excluir"
            />
          </div>

          {!customValidation.valid ? (
            <p role="alert" className="text-sm text-red-600">
              {customValidation.error}
            </p>
          ) : null}
        </div>
      ) : null}

      <div>
        <p className="mb-2 text-sm font-medium text-zinc-700">Quantidade de jogos</p>
        <div className="flex flex-wrap gap-2">
          {MULTI_QUANTITY_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setQuantity(option)}
              aria-pressed={quantity === option}
              className={`min-h-10 min-w-10 rounded-md border px-3 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                quantity === option
                  ? "border-teal-700 bg-teal-50 text-teal-800"
                  : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <Button
        type="button"
        onClick={handleGenerate}
        disabled={!canGenerate}
        className="w-full justify-center py-3 text-base"
      >
        {modeIcon}
        {quantity > 1 ? `Gerar ${quantity} jogos` : "Gerar combinação"}
      </Button>

      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}

      {games && games.length === 1 ? (
        <LotofacilGameResult numbers={games[0]} onGenerateAnother={handleGenerate} />
      ) : null}

      {games && games.length > 1 ? (
        <div className="space-y-3 rounded-lg border border-zinc-200 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-zinc-700">{games.length} jogos gerados, sem repetição entre eles</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => void handleCopyAll()}
                className="min-h-9 px-3 py-1.5 text-xs"
              >
                {copiedAll ? "Copiado!" : "Copiar todos"}
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
          <ul className="space-y-2">
            {games.map((game, index) => (
              <li key={`${index}-${game.join("-")}`} className="rounded-md border border-zinc-200 p-3 text-sm">
                <span className="font-semibold text-zinc-700">Jogo {index + 1}: </span>
                <span className="text-zinc-900">{formatNumbers(game)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {games && games.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-zinc-50 p-3">
          {signedIn ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => void handleSave()}
              disabled={saveState === "saving" || saveState === "saved"}
              className="min-h-9 px-3 py-1.5 text-xs"
            >
              <Save className="h-3.5 w-3.5" aria-hidden />
              {saveState === "saving" ? "Salvando..." : saveState === "saved" ? "Salvo" : "Salvar no meu histórico"}
            </Button>
          ) : (
            <Link
              href={`/entrar?callbackUrl=${encodeURIComponent("/loterias/lotofacil")}`}
              className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-zinc-900 ring-1 ring-inset ring-zinc-300 transition-colors hover:bg-zinc-50"
            >
              Entrar para salvar este jogo
            </Link>
          )}
          {signedIn ? (
            <Link href="/loterias/lotofacil/meus-jogos" className="text-xs font-medium text-teal-800 hover:underline">
              Ver meus jogos salvos
            </Link>
          ) : null}
          {saveMessage ? (
            <p role="status" className={`text-xs ${saveState === "error" ? "text-red-600" : "text-teal-700"}`}>
              {saveMessage}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
