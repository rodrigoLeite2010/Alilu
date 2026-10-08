"use client";

import { useState, type FormEvent } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";

export interface QuickField {
  name: string;
  label: string;
  type: "money" | "text" | "date" | "select" | "checkbox" | "number";
  options?: Array<{ value: string; label: string }>;
  required?: boolean;
  defaultValue?: string | boolean;
  placeholder?: string;
  hint?: string;
  maxLength?: number;
}

const inputClass =
  "mt-1 block min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 focus:border-teal-700 focus:outline focus:outline-2 focus:outline-teal-700/30";

/** Formulário em folha/modal para o celular: campos grandes, um botão claro, erro do servidor visível. */
export function QuickForm({
  open,
  title,
  fields,
  submitLabel,
  onClose,
  onSubmit,
  intro,
}: {
  open: boolean;
  title: string;
  fields: QuickField[];
  submitLabel: string;
  onClose: () => void;
  onSubmit: (values: Record<string, string | boolean>) => Promise<string | null>;
  intro?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const values: Record<string, string | boolean> = {};
    for (const field of fields) values[field.name] = field.type === "checkbox" ? form.get(field.name) === "on" : String(form.get(field.name) ?? "");
    setBusy(true);
    setError(null);
    const failure = await onSubmit(values);
    setBusy(false);
    if (failure) setError(failure);
    else onClose();
  }

  return (
    <Dialog open={open} title={title} onClose={onClose}>
      <form onSubmit={handle} className="space-y-4">
        {intro ? <p className="text-sm text-zinc-600">{intro}</p> : null}
        {fields.map((field) =>
          field.type === "checkbox" ? (
            <label key={field.name} className="flex min-h-11 items-center gap-3 text-sm text-zinc-800">
              <input type="checkbox" name={field.name} defaultChecked={field.defaultValue === true} className="h-5 w-5 accent-teal-700" />
              <span>
                {field.label}
                {field.hint ? <span className="block text-xs text-zinc-500">{field.hint}</span> : null}
              </span>
            </label>
          ) : (
            <label key={field.name} className="block text-sm font-medium text-zinc-800">
              {field.label}
              {field.type === "select" ? (
                <select name={field.name} defaultValue={String(field.defaultValue ?? "")} className={inputClass}>
                  {field.options?.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  name={field.name}
                  type={field.type === "date" ? "date" : field.type === "number" ? "number" : "text"}
                  inputMode={field.type === "money" ? "decimal" : field.type === "number" ? "numeric" : undefined}
                  defaultValue={typeof field.defaultValue === "string" ? field.defaultValue : undefined}
                  placeholder={field.type === "money" ? (field.placeholder ?? "0,00") : field.placeholder}
                  required={field.required}
                  maxLength={field.maxLength}
                  min={field.type === "number" ? 1 : undefined}
                  max={field.type === "number" ? 31 : undefined}
                  autoComplete="off"
                  className={inputClass}
                />
              )}
              {field.hint ? <span className="mt-1 block text-xs font-normal text-zinc-500">{field.hint}</span> : null}
            </label>
          ),
        )}
        {error ? (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button type="submit" disabled={busy} className="flex-1">
            {busy ? "Salvando…" : submitLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
