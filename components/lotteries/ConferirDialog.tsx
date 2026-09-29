"use client";

import { useState } from "react";
import { Dialog } from "@/components/instagram/Dialog";
import { Button } from "@/components/ui/Button";
import { LotteryNumberGrid } from "./LotteryNumberGrid";
import { MONTH_LABELS } from "@/lib/lotteries/dia-de-sorte-generator";

/**
 * Conferência manual do resultado (Fase 2): a pessoa marca no volante os
 * números que realmente saíram no sorteio oficial — nunca buscados
 * automaticamente por este site, que não tem integração com nenhuma fonte
 * de resultado — e confirma. O cálculo de acertos de cada jogo acontece no
 * servidor (ver /api/loterias/apostas/[id]/conferir). `minNumber`,
 * `maxNumber` e `drawnNumbers` vêm de fora (Fase B: cada modalidade tem a
 * própria faixa/quantidade — ver MeusJogos.tsx), em vez de importar
 * LOTOFACIL_CONFIG diretamente.
 *
 * `hasMonthPick` (Fase B — Dia de Sorte): quando true, também exige
 * escolher o Mês da Sorte REALMENTE sorteado antes de liberar o botão
 * "Conferir" — mesmo seletor de 12 meses de DiaDeSorteGenerator.tsx
 * (reaproveitando MONTH_LABELS de lib/lotteries/dia-de-sorte-generator.ts,
 * em vez de inventar outro). Em toda outra modalidade (hasMonthPick
 * ausente/false), esse bloco simplesmente não é renderizado.
 */
export function ConferirDialog({
  open,
  minNumber,
  maxNumber,
  drawnNumbers,
  hasMonthPick = false,
  onClose,
  onConfirm,
}: {
  open: boolean;
  minNumber: number;
  maxNumber: number;
  drawnNumbers: number;
  hasMonthPick?: boolean;
  onClose: () => void;
  onConfirm: (drawnNumbers: number[], drawnMonth: number | null) => Promise<void>;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function toggle(n: number) {
    setSelected((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));
  }

  async function handleConfirm() {
    if (selected.length !== drawnNumbers) {
      setError(`Marque exatamente ${drawnNumbers} números.`);
      return;
    }
    if (hasMonthPick && selectedMonth === null) {
      setError("Escolha o mês da sorte que foi sorteado.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onConfirm(selected, hasMonthPick ? selectedMonth : null);
      setSelected([]);
      setSelectedMonth(null);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível conferir agora.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      title="Conferir resultado do sorteio"
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void handleConfirm()} disabled={saving}>
            {saving ? "Conferindo..." : "Conferir"}
          </Button>
        </>
      }
    >
      <p className="text-sm text-zinc-600">
        Marque os {drawnNumbers} números que saíram no sorteio oficial da Caixa para este concurso. Nada é buscado
        automaticamente — a conferência é sempre manual.
      </p>
      <p className="mt-2 text-xs text-zinc-500">{selected.length} de {drawnNumbers} marcados</p>
      <div className="mt-3">
        <LotteryNumberGrid
          minNumber={minNumber}
          maxNumber={maxNumber}
          selected={selected}
          onToggle={toggle}
          ariaLabel="Números sorteados"
        />
      </div>

      {hasMonthPick ? (
        <div className="mt-4">
          <p className="mb-2 text-sm font-medium text-zinc-700">Mês da Sorte sorteado</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {MONTH_LABELS.map((label, index) => {
              const monthNumber = index + 1;
              const isSelected = selectedMonth === monthNumber;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => setSelectedMonth(monthNumber)}
                  aria-pressed={isSelected}
                  className={`min-h-10 rounded-md border px-2 py-1.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                    isSelected
                      ? "border-teal-700 bg-teal-50 text-teal-800"
                      : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </Dialog>
  );
}
