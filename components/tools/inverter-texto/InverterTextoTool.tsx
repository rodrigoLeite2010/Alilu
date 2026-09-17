"use client";

import { useMemo, useState } from "react";
import { TextareaField } from "@/components/forms/TextareaField";
import { reverseText, type ReverseMode } from "@/lib/formatters/text-reverse";

const MODES: { id: ReverseMode; label: string }[] = [
  { id: "characters", label: "Caracteres" },
  { id: "words", label: "Ordem das palavras" },
  { id: "lines", label: "Ordem das linhas" },
];

/**
 * Inverter Texto (categoria Funções String). Usa iteração por code point
 * (Array.from) para lidar corretamente com caracteres Unicode fora do
 * plano básico (ex.: emojis), evitando quebrar pares substitutos.
 */
export function InverterTextoTool() {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<ReverseMode>("characters");
  const [copied, setCopied] = useState(false);

  const result = useMemo(() => reverseText(text, mode), [text, mode]);

  async function copyResult() {
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div>
      <TextareaField
        id="inverter-texto-input"
        label="Digite ou cole o texto"
        rows={6}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />

      <div className="mt-4 flex flex-wrap gap-4">
        {MODES.map((option) => (
          <label key={option.id} className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="radio"
              name="inverter-texto-mode"
              checked={mode === option.id}
              onChange={() => setMode(option.id)}
            />
            {option.label}
          </label>
        ))}
      </div>

      <div className="mt-6">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-700">Resultado</span>
          {result.length > 0 ? (
            <button
              type="button"
              onClick={copyResult}
              className="text-sm font-medium text-teal-700 hover:text-teal-900"
            >
              {copied ? "Copiado!" : "Copiar resultado"}
            </button>
          ) : null}
        </div>
        <textarea
          readOnly
          rows={6}
          value={result}
          placeholder="O texto invertido aparece aqui."
          className="w-full rounded-lg border border-zinc-300 bg-zinc-50 py-3 px-4 text-base text-zinc-900"
        />
      </div>
    </div>
  );
}
