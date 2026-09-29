"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { money } from "@/components/financas/format";
import { reaisTextToCents } from "@/lib/financas/validation";
import type { InvestmentSummary, LotteryBet, LotteryFrequencyStats } from "@/lib/lotteries/types";
import { lotteryApi } from "./api";
import { BetCard } from "./BetCard";
import { ConferirDialog } from "./ConferirDialog";

function FrequencyPanel({
  stats,
  minNumber,
  maxNumber,
}: {
  stats: LotteryFrequencyStats;
  minNumber: number;
  maxNumber: number;
}) {
  if (stats.totalGames === 0) {
    return (
      <p className="text-sm text-zinc-600">
        Assim que você salvar jogos, mostramos aqui quantas vezes cada número apareceu NOS SEUS jogos salvos — só
        uma contagem descritiva do seu histórico, nunca uma chance de acertar.
      </p>
    );
  }

  const numbers = Array.from({ length: maxNumber - minNumber + 1 }, (_, i) => minNumber + i);
  const maxCount = Math.max(1, ...numbers.map((n) => stats.frequency[n] ?? 0));

  return (
    <div>
      <p className="mb-3 text-xs text-zinc-500">
        Quantas vezes cada número apareceu nos {stats.totalGames} jogo{stats.totalGames === 1 ? "" : "s"} que
        você salvou — não é a probabilidade dele ser sorteado.
      </p>
      <ul className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(3.25rem, 1fr))" }}>
        {numbers.map((n) => {
          const count = stats.frequency[n] ?? 0;
          return (
            <li key={n} className="rounded-md border border-zinc-200 p-2 text-center">
              <p className="text-xs font-semibold text-zinc-900">{String(n).padStart(2, "0")}</p>
              <div className="mt-1 h-1.5 w-full rounded-full bg-zinc-100">
                <div
                  className="h-1.5 rounded-full bg-teal-600"
                  style={{ width: `${(count / maxCount) * 100}%` }}
                />
              </div>
              <p className="mt-1 text-[11px] text-zinc-500">{count}x</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function InvestmentPanel({
  investment,
  monthlyBudgetCents,
  onSaveBudget,
}: {
  investment: InvestmentSummary;
  monthlyBudgetCents: number | null;
  onSaveBudget: (cents: number | null) => Promise<void>;
}) {
  const [budgetText, setBudgetText] = useState(monthlyBudgetCents !== null ? (monthlyBudgetCents / 100).toFixed(2).replace(".", ",") : "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const cents = budgetText.trim() === "" ? null : reaisTextToCents(budgetText);
      await onSaveBudget(cents);
    } finally {
      setSaving(false);
    }
  }

  const overBudget = monthlyBudgetCents !== null && investment.currentMonthCents > monthlyBudgetCents;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="rounded-md bg-zinc-50 p-4">
        <p className="text-xs text-zinc-500">Total já investido</p>
        <p className="text-lg font-semibold text-zinc-900">{money(investment.totalCents)}</p>
        <p className="mt-2 text-xs text-zinc-500">Neste mês</p>
        <p className="text-sm font-medium text-zinc-800">{money(investment.currentMonthCents)}</p>
        {overBudget ? (
          <p className="mt-1 text-xs text-zinc-600">Acima do limite mensal que você definiu — sem nenhum problema, é só um acompanhamento.</p>
        ) : null}
      </div>
      <div className="rounded-md border border-zinc-200 p-4">
        <label htmlFor="orcamento-mensal" className="text-xs font-medium text-zinc-700">
          Limite mensal (opcional, só para acompanhar)
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="orcamento-mensal"
            type="text"
            inputMode="decimal"
            placeholder="Sem limite definido"
            value={budgetText}
            onChange={(e) => setBudgetText(e.target.value)}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
          <Button type="button" variant="secondary" onClick={() => void handleSave()} disabled={saving} className="min-h-9 px-3 py-1.5 text-xs">
            Salvar
          </Button>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Nunca bloqueamos nem enviamos alerta — é só uma referência para você mesmo acompanhar.
        </p>
      </div>
    </div>
  );
}

/**
 * Componente genérico de "Meus Jogos" (Fase 2, generalizado por
 * modalidade na Fase B) — usado tanto por
 * app/loterias/lotofacil/meus-jogos/page.tsx quanto por
 * app/loterias/mega-sena/meus-jogos/page.tsx, cada um passando sua própria
 * `modality` e faixa de números. Configurações (limite mensal) continuam
 * globais, sem modalidade.
 */
export function MeusJogos({
  modality,
  minNumber,
  maxNumber,
  drawnNumbers,
  reusePath,
}: {
  modality: string;
  minNumber: number;
  maxNumber: number;
  drawnNumbers: number;
  reusePath: string;
}) {
  const [bets, setBets] = useState<LotteryBet[] | null>(null);
  const [frequency, setFrequency] = useState<LotteryFrequencyStats | null>(null);
  const [investment, setInvestment] = useState<InvestmentSummary | null>(null);
  const [monthlyBudgetCents, setMonthlyBudgetCents] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conferirBetId, setConferirBetId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([lotteryApi.listBets(modality), lotteryApi.getStats(modality), lotteryApi.getSettings()])
      .then(([betList, stats, settings]) => {
        if (cancelled) return;
        setBets(betList);
        setFrequency(stats.frequency);
        setInvestment(stats.investment);
        setMonthlyBudgetCents(settings.monthlyBudgetCents);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Não foi possível carregar seus jogos.");
      });
    return () => {
      cancelled = true;
    };
  }, [modality]);

  async function refreshBetsAndStats() {
    const [betList, stats] = await Promise.all([lotteryApi.listBets(modality), lotteryApi.getStats(modality)]);
    setBets(betList);
    setFrequency(stats.frequency);
    setInvestment(stats.investment);
  }

  async function handleToggleFavorite(gameId: string, isFavorite: boolean) {
    setBets((prev) =>
      prev
        ? prev.map((bet) => ({ ...bet, games: bet.games.map((g) => (g.id === gameId ? { ...g, isFavorite } : g)) }))
        : prev
    );
    try {
      await lotteryApi.setFavorite(gameId, isFavorite);
    } catch {
      await refreshBetsAndStats();
    }
  }

  async function handleDeleteGame(gameId: string) {
    try {
      await lotteryApi.deleteGame(gameId);
      await refreshBetsAndStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível excluir.");
    }
  }

  async function handleDeleteBet(betId: string) {
    try {
      await lotteryApi.deleteBet(betId);
      await refreshBetsAndStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível excluir.");
    }
  }

  async function handleUpdateHeader(
    betId: string,
    header: { contestNumber: number | null; drawDate: string | null; amountCents: number; note: string | null }
  ) {
    await lotteryApi.updateBet(betId, header);
    await refreshBetsAndStats();
  }

  async function handleConferir(newDrawnNumbers: number[]) {
    if (!conferirBetId) return;
    await lotteryApi.conferirBet(modality, conferirBetId, newDrawnNumbers);
    await refreshBetsAndStats();
  }

  async function handleSaveBudget(cents: number | null) {
    await lotteryApi.saveSettings({ monthlyBudgetCents: cents });
    setMonthlyBudgetCents(cents);
  }

  if (error && bets === null) {
    return (
      <p role="alert" className="text-sm text-red-600">
        {error}
      </p>
    );
  }

  if (bets === null || frequency === null || investment === null) {
    return <p className="text-sm text-zinc-500">Carregando seus jogos...</p>;
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-lg font-semibold text-zinc-900">Investimento</h2>
        <InvestmentPanel investment={investment} monthlyBudgetCents={monthlyBudgetCents} onSaveBudget={handleSaveBudget} />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-zinc-900">Frequência nos seus jogos</h2>
        <FrequencyPanel stats={frequency} minNumber={minNumber} maxNumber={maxNumber} />
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-zinc-900">Jogos salvos</h2>
          {bets.length > 0 ? (
            <a
              href={`/api/loterias/exportar?modalidade=${modality}`}
              download
              className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-zinc-900 ring-1 ring-inset ring-zinc-300 transition-colors hover:bg-zinc-50"
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
              Baixar CSV
            </a>
          ) : null}
        </div>

        {bets.length === 0 ? (
          <p className="text-sm text-zinc-600">
            Você ainda não salvou nenhum jogo. Gere um jogo no gerador acima e clique em &quot;Salvar&quot;.
          </p>
        ) : (
          <ul className="space-y-4">
            {bets.map((bet) => (
              <BetCard
                key={bet.id}
                bet={bet}
                reusePath={reusePath}
                minNumber={minNumber}
                maxNumber={maxNumber}
                onToggleFavorite={(gameId, isFavorite) => void handleToggleFavorite(gameId, isFavorite)}
                onDeleteGame={(gameId) => void handleDeleteGame(gameId)}
                onDeleteBet={(betId) => void handleDeleteBet(betId)}
                onUpdateHeader={handleUpdateHeader}
                onOpenConferir={setConferirBetId}
              />
            ))}
          </ul>
        )}
      </section>

      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <ConferirDialog
        open={conferirBetId !== null}
        minNumber={minNumber}
        maxNumber={maxNumber}
        drawnNumbers={drawnNumbers}
        onClose={() => setConferirBetId(null)}
        onConfirm={handleConferir}
      />
    </div>
  );
}
