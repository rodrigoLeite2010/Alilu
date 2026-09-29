"use client";

import { useState } from "react";
import { Dialog } from "@/components/instagram/Dialog";
import { Button } from "@/components/ui/Button";
import { LotteryNumberGrid } from "./LotteryNumberGrid";
import { LOTOFACIL_CONFIG } from "@/lib/lotteries/lotofacil-config";

/**
 * Conferência manual do resultado (Fase 2): a pessoa marca no volante os
 * números que realmente saíram no sorteio oficial — nunca buscados
 * automaticamente por este site, que não tem integração com nenhuma fonte
 * de resultado — e confirma. O cálculo de acertos de cada jogo acontece no
 * servidor (ver /api/loterias/apostas/[id]/conferir).
 */
export function ConferirDialog({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (drawnNumbers: number[]) => Promise<void>;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function toggle(n: number) {
    setSelected((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));
  }

  async function handleConfirm() {
    if (selected.length !== LOTOFACIL_CONFIG.drawnNumbers) {
      setError(`Marque exatamente ${LOTOFACIL_CONFIG.drawnNumbers} números.`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onConfirm(selected);
      setSelected([]);
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
        Marque os {LOTOFACIL_CONFIG.drawnNumbers} números que saíram no sorteio oficial da Caixa para este
        concurso. Nada é buscado automaticamente — a conferência é sempre manual.
      </p>
      <p className="mt-2 text-xs text-zinc-500">{selected.length} de {LOTOFACIL_CONFIG.drawnNumbers} marcados</p>
      <div className="mt-3">
        <LotteryNumberGrid
          minNumber={LOTOFACIL_CONFIG.minNumber}
          maxNumber={LOTOFACIL_CONFIG.maxNumber}
          selected={selected}
          onToggle={toggle}
          ariaLabel="Números sorteados"
        />
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </Dialog>
  );
}
