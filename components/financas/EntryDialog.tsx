"use client";

import { useState, type FormEvent } from "react";
import { Dialog } from "@/components/instagram/Dialog";
import { Button } from "@/components/ui/Button";
import { SelectField } from "@/components/forms/SelectField";
import { TextField } from "@/components/forms/TextField";
import { NumberField } from "@/components/forms/NumberField";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, RECURRENCE_LABELS, categoriesFor } from "@/lib/financas/categories";
import { todayISO } from "@/lib/financas/dates";
import { reaisTextToCents, type EntryInput } from "@/lib/financas/validation";
import type { EntryKind, FinEntry, Recurrence } from "@/lib/financas/types";
import { financeApi, notifyFinanceChanged } from "./api";

export type DialogMode = "quick-expense" | "full";

function centsToText(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

/**
 * Formulário de lançamento. Modo "quick-expense": só valor, categoria e
 * descrição (gasto de hoje, já pago) — cadastrar em poucos segundos.
 * Modo "full": receitas/despesas completas, com vencimento e recorrência.
 */
export function EntryDialog({
  open,
  onClose,
  mode,
  kind: initialKind = "expense",
  entry,
  defaultCategory,
  defaultRecurrence,
}: {
  open: boolean;
  onClose: () => void;
  mode: DialogMode;
  kind?: EntryKind;
  entry?: FinEntry | null;
  /** Categoria pré-selecionada ao abrir para um lançamento novo (ex.: "Assinaturas"). */
  defaultCategory?: string;
  /** Periodicidade pré-selecionada ao abrir para um lançamento novo (ex.: "monthly"). */
  defaultRecurrence?: Recurrence;
}) {
  const quick = mode === "quick-expense";
  const [kind, setKind] = useState<EntryKind>(entry?.kind ?? initialKind);
  const [description, setDescription] = useState(entry?.description ?? "");
  const [amount, setAmount] = useState(entry ? centsToText(entry.amountCents) : "");
  const [category, setCategory] = useState(
    entry?.category ?? defaultCategory ?? (initialKind === "income" ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0]),
  );
  const [nature, setNature] = useState<"fixed" | "variable">(entry?.nature ?? "variable");
  const [date, setDate] = useState(entry?.date ?? todayISO());
  const [recurrence, setRecurrence] = useState<Recurrence>(entry?.recurrence ?? defaultRecurrence ?? "none");
  const [recurrenceEnd, setRecurrenceEnd] = useState(entry?.recurrenceEnd ?? "");
  const [paymentMethod, setPaymentMethod] = useState(entry?.paymentMethod ?? "");
  const [note, setNote] = useState(entry?.note ?? "");
  const [paid, setPaid] = useState(entry ? entry.paidAt !== null : quick);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function changeKind(next: EntryKind) {
    setKind(next);
    setCategory(categoriesFor(next)[0]);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const amountCents = reaisTextToCents(amount);
    if (amountCents === null || amountCents <= 0) {
      setError("Informe um valor maior que zero.");
      return;
    }
    const input: EntryInput = {
      kind,
      description: description.trim() || (quick ? category : ""),
      amountCents,
      category,
      nature: kind === "expense" ? nature : null,
      date,
      recurrence: quick ? "none" : recurrence,
      recurrenceEnd: !quick && recurrence !== "none" && recurrenceEnd ? recurrenceEnd : null,
      paymentMethod: paymentMethod.trim() || null,
      note: note.trim() || null,
      paid,
    };
    setSaving(true);
    setError(null);
    try {
      if (entry) await financeApi.updateEntry(entry.id, input);
      else await financeApi.createEntry(input);
      notifyFinanceChanged();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  const title = quick ? "Adicionar gasto" : entry ? "Editar lançamento" : kind === "income" ? "Nova receita" : "Nova despesa";
  const paidLabel = kind === "income" ? "Já recebi" : "Já paguei";

  return (
    <Dialog open={open} title={title} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {!quick && !entry ? (
          <div role="group" aria-label="Tipo" className="grid grid-cols-2 gap-2">
            {(["expense", "income"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={kind === option}
                onClick={() => changeKind(option)}
                className={`min-h-11 rounded-md text-sm font-semibold ring-1 ring-inset ${
                  kind === option ? "bg-teal-700 text-white ring-teal-700" : "bg-white text-zinc-700 ring-zinc-300"
                }`}
              >
                {option === "expense" ? "Despesa" : "Receita"}
              </button>
            ))}
          </div>
        ) : null}

        <NumberField id="fin-amount" label="Valor (R$)" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        <SelectField id="fin-category" label="Categoria" value={category} onChange={(e) => setCategory(e.target.value)}>
          {categoriesFor(kind).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </SelectField>
        <TextField
          id="fin-description"
          label={quick ? "Descrição (opcional)" : "Descrição"}
          value={description}
          maxLength={120}
          onChange={(e) => setDescription(e.target.value)}
        />

        {!quick ? (
          <>
            <TextField
              id="fin-date"
              type="date"
              label={kind === "income" ? "Data de recebimento" : "Data de vencimento"}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            {kind === "expense" ? (
              <SelectField id="fin-nature" label="Classificação" value={nature} onChange={(e) => setNature(e.target.value as "fixed" | "variable")}>
                <option value="fixed">Fixa (aluguel, escola, condomínio)</option>
                <option value="variable">Variável (mercado, restaurante, combustível)</option>
              </SelectField>
            ) : null}
            <SelectField id="fin-recurrence" label="Repete?" value={recurrence} onChange={(e) => setRecurrence(e.target.value as Recurrence)}>
              {(Object.keys(RECURRENCE_LABELS) as Recurrence[]).map((key) => (
                <option key={key} value={key}>
                  {RECURRENCE_LABELS[key]}
                </option>
              ))}
            </SelectField>
            {recurrence !== "none" ? (
              <TextField
                id="fin-recurrence-end"
                type="date"
                label="Repetir até (opcional)"
                value={recurrenceEnd}
                onChange={(e) => setRecurrenceEnd(e.target.value)}
              />
            ) : null}
            {kind === "expense" ? (
              <TextField
                id="fin-payment"
                label="Forma de pagamento (opcional)"
                value={paymentMethod}
                maxLength={40}
                placeholder="Pix, boleto, cartão..."
                onChange={(e) => setPaymentMethod(e.target.value)}
              />
            ) : null}
            <TextField id="fin-note" label="Observação (opcional)" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
            {recurrence === "none" ? (
              <label className="flex min-h-11 items-center gap-3 text-sm text-zinc-800">
                <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} className="h-5 w-5 accent-teal-700" />
                {paidLabel}
              </label>
            ) : (
              <p className="text-xs text-zinc-500">
                Em lançamentos que se repetem, você marca cada mês como {kind === "income" ? "recebido" : "pago"} no painel ou no calendário.
              </p>
            )}
          </>
        ) : null}

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
