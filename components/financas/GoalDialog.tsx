"use client";

import { useState, type FormEvent } from "react";
import { Dialog } from "@/components/instagram/Dialog";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { NumberField } from "@/components/forms/NumberField";
import type { Goal } from "@/lib/financas/goals";
import { reaisTextToCents, type GoalInput } from "@/lib/financas/validation";
import { financeApi, notifyFinanceChanged } from "./api";

function centsToText(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function GoalDialog({
  open,
  onClose,
  goal,
  defaults,
}: {
  open: boolean;
  onClose: () => void;
  goal?: Goal | null;
  /** Pré-preenche uma meta nova (ex.: vinda da calculadora de reserva de emergência). */
  defaults?: { name: string; targetCents: number };
}) {
  const [name, setName] = useState(goal?.name ?? defaults?.name ?? "");
  const [target, setTarget] = useState(goal ? centsToText(goal.targetCents) : defaults ? centsToText(defaults.targetCents) : "");
  const [current, setCurrent] = useState(goal ? centsToText(goal.currentCents) : "0,00");
  const [targetDate, setTargetDate] = useState(goal?.targetDate ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const targetCents = reaisTextToCents(target);
    const currentCents = reaisTextToCents(current) ?? 0;
    if (targetCents === null || targetCents <= 0) {
      setError("Informe um valor alvo maior que zero.");
      return;
    }
    const input: GoalInput = { name: name.trim(), targetCents, currentCents, targetDate: targetDate || null };
    setSaving(true);
    setError(null);
    try {
      if (goal) await financeApi.updateGoal(goal.id, input);
      else await financeApi.createGoal(input);
      notifyFinanceChanged();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} title={goal ? "Editar meta" : "Nova meta financeira"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <TextField id="goal-name" label="Nome da meta" value={name} maxLength={80} placeholder="Reserva de emergência, viagem, entrada do carro..." onChange={(e) => setName(e.target.value)} autoFocus />
        <NumberField id="goal-target" label="Valor alvo (R$)" placeholder="0,00" value={target} onChange={(e) => setTarget(e.target.value)} />
        <NumberField id="goal-current" label="Valor atual (R$)" placeholder="0,00" value={current} onChange={(e) => setCurrent(e.target.value)} />
        <TextField id="goal-date" type="date" label="Data desejada (opcional)" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />

        {error ? (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
