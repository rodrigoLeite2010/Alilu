"use client";

import { useState, type FormEvent } from "react";
import { Dialog } from "@/components/instagram/Dialog";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { NumberField } from "@/components/forms/NumberField";
import type { Debt } from "@/lib/financas/debts";
import { reaisTextToCents, type DebtInput } from "@/lib/financas/validation";
import { financeApi, notifyFinanceChanged } from "./api";

function centsToText(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function DebtDialog({ open, onClose, debt }: { open: boolean; onClose: () => void; debt?: Debt | null }) {
  const [name, setName] = useState(debt?.name ?? "");
  const [balance, setBalance] = useState(debt ? centsToText(debt.balanceCents) : "");
  const [installment, setInstallment] = useState(debt ? centsToText(debt.installmentCents) : "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const balanceCents = reaisTextToCents(balance);
    const installmentCents = reaisTextToCents(installment);
    if (balanceCents === null || balanceCents < 0) {
      setError("Informe um saldo devedor válido.");
      return;
    }
    if (installmentCents === null || installmentCents <= 0) {
      setError("Informe um valor de parcela maior que zero.");
      return;
    }
    const input: DebtInput = { name: name.trim(), balanceCents, installmentCents };
    setSaving(true);
    setError(null);
    try {
      if (debt) await financeApi.updateDebt(debt.id, input);
      else await financeApi.createDebt(input);
      notifyFinanceChanged();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} title={debt ? "Editar dívida" : "Nova dívida"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <TextField
          id="debt-name"
          label="Nome da dívida"
          value={name}
          maxLength={80}
          placeholder="Financiamento do carro, cartão de crédito, empréstimo..."
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <NumberField id="debt-balance" label="Saldo devedor (R$)" placeholder="0,00" value={balance} onChange={(e) => setBalance(e.target.value)} />
        <NumberField
          id="debt-installment"
          label="Valor da parcela mensal (R$)"
          placeholder="0,00"
          value={installment}
          onChange={(e) => setInstallment(e.target.value)}
        />

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
