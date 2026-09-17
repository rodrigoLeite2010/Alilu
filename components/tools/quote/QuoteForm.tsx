"use client";

import { useState, type FormEvent } from "react";
import { TextField } from "@/components/forms/TextField";
import { TextareaField } from "@/components/forms/TextareaField";
import { NumberField } from "@/components/forms/NumberField";
import { Button } from "@/components/ui/Button";
import { centsDigitsToAmount, formatCurrencyBRL } from "@/lib/formatters/currency";
import { parseLocaleNumberBRL } from "@/lib/validators/number";
import { isNonEmptyString } from "@/lib/validators/number";
import type { QuoteInput, QuoteItem } from "@/lib/quote/build-quote";

interface DraftItem {
  description: string;
  quantityText: string;
  unitValueDigits: string;
}

function emptyItem(): DraftItem {
  return { description: "", quantityText: "1", unitValueDigits: "" };
}

function todayISODate(): string {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

type FieldErrors = Partial<
  Record<"issuerName" | "clientName" | "date" | "items", string>
>;

/**
 * Formulário do Gerador de Orçamento. Segue o mesmo padrão de privacidade do
 * Gerador de Recibo: todo o processamento acontece no navegador, nenhum dado
 * é enviado, salvo em cookies/localStorage/sessionStorage ou registrado em
 * log (PROMPT MESTRE, "Gerador de Orçamento").
 */
export function QuoteForm({ onGenerate }: { onGenerate: (input: QuoteInput) => void }) {
  const [issuerName, setIssuerName] = useState("");
  const [issuerDocument, setIssuerDocument] = useState("");
  const [issuerContact, setIssuerContact] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientDocument, setClientDocument] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<DraftItem[]>([emptyItem()]);
  const [errors, setErrors] = useState<FieldErrors>({});

  function clearError(field: keyof FieldErrors) {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function updateItem(index: number, patch: Partial<DraftItem>) {
    setItems((current) =>
      current.map((item, i) => (i === index ? { ...item, ...patch } : item))
    );
    clearError("items");
  }

  function addItem() {
    setItems((current) => [...current, emptyItem()]);
  }

  function removeItem(index: number) {
    setItems((current) => (current.length > 1 ? current.filter((_, i) => i !== index) : current));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const date = String(new FormData(event.currentTarget).get("date") ?? "");

    const nextErrors: FieldErrors = {};

    if (!isNonEmptyString(issuerName)) {
      nextErrors.issuerName = "Informe quem está emitindo o orçamento.";
    }
    if (!isNonEmptyString(clientName)) {
      nextErrors.clientName = "Informe o nome do cliente.";
    }
    if (!isNonEmptyString(date)) {
      nextErrors.date = "Informe a data do orçamento.";
    }

    const parsedItems: QuoteItem[] = items
      .filter((item) => item.description.trim() !== "")
      .map((item) => ({
        description: item.description.trim(),
        quantity: parseLocaleNumberBRL(item.quantityText) ?? NaN,
        unitValue: item.unitValueDigits ? centsDigitsToAmount(item.unitValueDigits) : 0,
      }));

    if (
      parsedItems.length === 0 ||
      parsedItems.some((item) => !Number.isFinite(item.quantity) || item.quantity <= 0)
    ) {
      nextErrors.items = "Adicione ao menos um item com descrição e quantidade válida (maior que zero).";
    } else if (parsedItems.some((item) => !Number.isFinite(item.unitValue) || item.unitValue <= 0)) {
      nextErrors.items = "Informe um valor unitário maior que zero para cada item adicionado.";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    onGenerate({
      issuerName: issuerName.trim(),
      issuerDocument: issuerDocument.trim() || undefined,
      issuerContact: issuerContact.trim() || undefined,
      clientName: clientName.trim(),
      clientDocument: clientDocument.trim() || undefined,
      date,
      validUntil: validUntil || undefined,
      items: parsedItems,
      notes: notes.trim() || undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-8">
      <p className="rounded-lg bg-zinc-50 p-3 text-sm text-zinc-600">
        <strong className="font-medium text-zinc-700">Privacidade:</strong> os
        dados deste orçamento são processados somente no seu dispositivo e não são armazenados
        pela Alilu.
      </p>

      <fieldset className="space-y-5">
        <legend className="text-sm font-semibold text-zinc-900">
          Quem emite
        </legend>

        <TextField
          id="quote-issuer-name"
          label="Seu nome ou o nome da sua empresa"
          autoFocus
          value={issuerName}
          onChange={(event) => {
            setIssuerName(event.target.value);
            clearError("issuerName");
          }}
          error={errors.issuerName}
        />
        <TextField
          id="quote-issuer-document"
          label="CPF/CNPJ"
          hint="Opcional"
          value={issuerDocument}
          onChange={(event) => setIssuerDocument(event.target.value)}
        />
        <TextField
          id="quote-issuer-contact"
          label="Contato"
          hint="Telefone, e-mail ou site (opcional)"
          value={issuerContact}
          onChange={(event) => setIssuerContact(event.target.value)}
        />
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="text-sm font-semibold text-zinc-900">Cliente</legend>

        <TextField
          id="quote-client-name"
          label="Nome do cliente"
          value={clientName}
          onChange={(event) => {
            setClientName(event.target.value);
            clearError("clientName");
          }}
          error={errors.clientName}
        />
        <TextField
          id="quote-client-document"
          label="CPF/CNPJ do cliente"
          hint="Opcional"
          value={clientDocument}
          onChange={(event) => setClientDocument(event.target.value)}
        />
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="text-sm font-semibold text-zinc-900">
          Data e validade
        </legend>
        <TextField
          id="quote-date"
          name="date"
          label="Data do orçamento"
          type="date"
          defaultValue={todayISODate()}
          onChange={() => clearError("date")}
          error={errors.date}
        />
        <TextField
          id="quote-valid-until"
          label="Válido até"
          hint="Opcional"
          type="date"
          value={validUntil}
          onChange={(event) => setValidUntil(event.target.value)}
        />
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-zinc-900">Itens</legend>

        {items.map((item, index) => (
          <div
            key={index}
            className="grid grid-cols-1 gap-3 rounded-lg border border-zinc-200 p-3 sm:grid-cols-12 sm:items-end"
          >
            <div className="sm:col-span-6">
              <TextField
                id={`quote-item-description-${index}`}
                label="Descrição"
                value={item.description}
                onChange={(event) => updateItem(index, { description: event.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <NumberField
                id={`quote-item-quantity-${index}`}
                label="Qtd."
                value={item.quantityText}
                onChange={(event) => updateItem(index, { quantityText: event.target.value })}
              />
            </div>
            <div className="sm:col-span-3">
              <TextField
                id={`quote-item-unit-value-${index}`}
                label="Valor unitário"
                inputMode="decimal"
                placeholder="R$ 0,00"
                value={
                  item.unitValueDigits
                    ? formatCurrencyBRL(centsDigitsToAmount(item.unitValueDigits))
                    : ""
                }
                onChange={(event) =>
                  updateItem(index, {
                    unitValueDigits: event.target.value.replace(/\D/g, "").slice(0, 12),
                  })
                }
              />
            </div>
            <div className="sm:col-span-1">
              <Button
                type="button"
                variant="ghost"
                onClick={() => removeItem(index)}
                disabled={items.length === 1}
              >
                Remover
              </Button>
            </div>
          </div>
        ))}

        {errors.items ? <p className="text-sm text-red-600">{errors.items}</p> : null}

        <Button type="button" variant="secondary" onClick={addItem}>
          Adicionar item
        </Button>
      </fieldset>

      <TextareaField
        id="quote-notes"
        label="Observações"
        hint="Condições de pagamento, prazo de entrega etc. (opcional)"
        maxLength={500}
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
      />

      <Button type="submit" className="w-full sm:w-auto">
        Gerar orçamento
      </Button>
    </form>
  );
}
