"use client";

import { useState } from "react";
import Link from "next/link";
import { Copy, Heart, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { money } from "@/components/financas/format";
import { reaisTextToCents } from "@/lib/financas/validation";
import { LotteryNumberGrid } from "./LotteryNumberGrid";
import type { LotteryBet, LotteryGame } from "@/lib/lotteries/types";

function formatNumbers(numbers: readonly number[]): string {
  return numbers.map((n) => String(n).padStart(2, "0")).join(" ");
}

function GameRow({
  game,
  onToggleFavorite,
  onDelete,
}: {
  game: LotteryGame;
  onToggleFavorite: (gameId: string, isFavorite: boolean) => void;
  onDelete: (gameId: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(formatNumbers(game.numbers));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-200 p-3">
      <div>
        <p className="text-sm font-semibold text-zinc-900">{formatNumbers(game.numbers)}</p>
        <p className="text-xs text-zinc-500">
          {game.mode === "aleatorio" && "Aleatório"}
          {game.mode === "equilibrado" && "Equilibrado"}
          {game.mode === "personalizado" && "Personalizado"}
          {game.mode === "diversificado" && "Diversificado"}
          {game.hits !== null ? ` · ${game.hits} acerto${game.hits === 1 ? "" : "s"}` : ""}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => onToggleFavorite(game.id, !game.isFavorite)}
          aria-pressed={game.isFavorite}
          aria-label={game.isFavorite ? "Remover dos favoritos" : "Marcar como favorito"}
          className={`rounded p-1.5 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
            game.isFavorite ? "text-red-600" : "text-zinc-400"
          }`}
        >
          <Heart className="h-4 w-4" aria-hidden fill={game.isFavorite ? "currentColor" : "none"} />
        </button>
        <button
          type="button"
          onClick={() => void handleCopy()}
          aria-label="Copiar números"
          className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
        >
          <Copy className="h-4 w-4" aria-hidden />
        </button>
        <Link
          href={`/loterias/lotofacil?reutilizar=${game.numbers.join(",")}`}
          aria-label="Reutilizar este jogo no gerador"
          className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
        </Link>
        <button
          type="button"
          onClick={() => {
            if (window.confirm("Excluir este jogo? Essa ação não pode ser desfeita.")) onDelete(game.id);
          }}
          aria-label="Excluir jogo"
          className="rounded p-1.5 text-zinc-500 hover:bg-red-50 hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      </div>
      {copied ? <p className="w-full text-xs text-teal-700">Copiado!</p> : null}
    </li>
  );
}

export function BetCard({
  bet,
  onToggleFavorite,
  onDeleteGame,
  onDeleteBet,
  onUpdateHeader,
  onOpenConferir,
}: {
  bet: LotteryBet;
  onToggleFavorite: (gameId: string, isFavorite: boolean) => void;
  onDeleteGame: (gameId: string) => void;
  onDeleteBet: (betId: string) => void;
  onUpdateHeader: (
    betId: string,
    header: { contestNumber: number | null; drawDate: string | null; amountCents: number; note: string | null }
  ) => Promise<void>;
  onOpenConferir: (betId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [contestNumber, setContestNumber] = useState(bet.contestNumber ? String(bet.contestNumber) : "");
  const [drawDate, setDrawDate] = useState(bet.drawDate ?? "");
  const [amount, setAmount] = useState((bet.amountCents / 100).toFixed(2).replace(".", ","));
  const [note, setNote] = useState(bet.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSaveHeader() {
    const amountCents = reaisTextToCents(amount) ?? 0;
    const parsedContest = contestNumber.trim() === "" ? null : Number(contestNumber);
    setSaving(true);
    setError(null);
    try {
      await onUpdateHeader(bet.id, {
        contestNumber: parsedContest,
        drawDate: drawDate.trim() === "" ? null : drawDate,
        amountCents,
        note: note.trim() === "" ? null : note.trim(),
      });
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="rounded-lg border border-zinc-200 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {editing ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <input
                type="number"
                value={contestNumber}
                onChange={(e) => setContestNumber(e.target.value)}
                placeholder="Concurso"
                aria-label="Número do concurso"
                className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
              />
              <input
                type="date"
                value={drawDate}
                onChange={(e) => setDrawDate(e.target.value)}
                aria-label="Data do sorteio"
                className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
              />
              <input
                type="text"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Valor apostado"
                aria-label="Valor apostado"
                className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
              />
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Observação"
                aria-label="Observação"
                className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
              />
            </div>
          ) : (
            <>
              <p className="text-sm font-semibold text-zinc-900">
                {bet.contestNumber ? `Concurso ${bet.contestNumber}` : "Sem concurso informado"}
                {bet.drawDate ? ` · ${bet.drawDate.split("-").reverse().join("/")}` : ""}
              </p>
              <p className="text-xs text-zinc-500">
                {money(bet.amountCents)} apostado
                {bet.note ? ` · ${bet.note}` : ""}
                {bet.checkedAt ? " · conferido" : ""}
              </p>
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {editing ? (
            <>
              <Button type="button" variant="secondary" onClick={() => setEditing(false)} disabled={saving} className="min-h-9 px-3 py-1.5 text-xs">
                Cancelar
              </Button>
              <Button type="button" onClick={() => void handleSaveHeader()} disabled={saving} className="min-h-9 px-3 py-1.5 text-xs">
                Salvar
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="secondary" onClick={() => setEditing(true)} className="min-h-9 px-3 py-1.5 text-xs">
                <Pencil className="h-3.5 w-3.5" aria-hidden />
                Editar
              </Button>
              {!bet.checkedAt ? (
                <Button type="button" variant="secondary" onClick={() => onOpenConferir(bet.id)} className="min-h-9 px-3 py-1.5 text-xs">
                  Conferir resultado
                </Button>
              ) : null}
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  if (window.confirm("Excluir esta aposta e todos os jogos dela? Essa ação não pode ser desfeita.")) {
                    onDeleteBet(bet.id);
                  }
                }}
                className="min-h-9 px-3 py-1.5 text-xs text-red-600"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                Excluir
              </Button>
            </>
          )}
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      ) : null}

      {bet.drawnNumbers ? (
        <div className="mt-3 rounded-md bg-zinc-50 p-3">
          <p className="mb-2 text-xs font-medium text-zinc-600">Números sorteados (conferência manual)</p>
          <LotteryNumberGrid
            minNumber={1}
            maxNumber={25}
            size="sm"
            selected={bet.drawnNumbers}
            ariaLabel="Números sorteados nesta aposta"
          />
        </div>
      ) : null}

      <ul className="mt-3 space-y-2">
        {bet.games.map((game) => (
          <GameRow key={game.id} game={game} onToggleFavorite={onToggleFavorite} onDelete={onDeleteGame} />
        ))}
      </ul>
    </li>
  );
}
