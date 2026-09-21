"use client";

import { isValidHexColor } from "@/lib/instagram/colors";

/**
 * Campo de cor compacto (amostra + código hexadecimal) reaproveitado pelos
 * controles de texto e de fundo do editor (ETAPA 5.3).
 */
export function ColorSwatchInput({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="text-sm font-medium text-zinc-700">
        {label}
      </label>
      <span className="flex items-center gap-2">
        <input
          id={id}
          type="color"
          value={isValidHexColor(value) ? value : "#000000"}
          onChange={(event) => onChange(event.target.value)}
          className="h-9 w-9 cursor-pointer rounded-md border border-zinc-300 bg-white p-0.5"
          aria-label={label}
        />
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label={`${label} (código hexadecimal)`}
          className="w-24 rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-teal-700/20"
        />
      </span>
    </div>
  );
}
