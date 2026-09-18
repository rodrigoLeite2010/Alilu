"use client";

import { TextField } from "@/components/forms/TextField";

type PageSelectionFieldProps = {
  id: string;
  value: string;
  pageCount: number;
  disabled?: boolean;
  error?: string;
  onChange: (value: string) => void;
};

export function PageSelectionField({
  id,
  value,
  pageCount,
  disabled = false,
  error,
  onChange,
}: PageSelectionFieldProps) {
  return (
    <div className="space-y-2">
      <TextField
        id={id}
        label="Páginas"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Ex.: 1-3, 5, 8-10"
        hint={`Use números e intervalos separados por vírgula. Este PDF possui ${pageCount} ${pageCount === 1 ? "página" : "páginas"}.`}
        error={error}
        disabled={disabled}
        inputMode="numeric"
      />
      <button
        type="button"
        className="min-h-11 text-sm font-semibold text-teal-800 underline decoration-teal-400 underline-offset-4 hover:text-teal-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-40"
        onClick={() => onChange(`1-${pageCount}`)}
        disabled={disabled}
      >
        Usar todas as páginas
      </button>
    </div>
  );
}
