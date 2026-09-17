"use client";

import { useState } from "react";
import { TextareaField } from "@/components/forms/TextareaField";
import { applyTextCase, TEXT_CASE_MODES } from "@/lib/formatters/text-case";

/**
 * Maiúsculas e Minúsculas (categoria Funções String). Mostra todas as
 * variações de uma vez (mesmo padrão do Gerador de Letras Diferentes),
 * usando toUpperCase/toLowerCase nativos, que preservam a acentuação do
 * português corretamente.
 */
export function MaiusculasMinusculasTool() {
  const [text, setText] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function copyText(value: string, id: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(id);
      setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 2000);
    } catch {
      setCopiedId(null);
    }
  }

  const hasText = text.trim().length > 0;

  return (
    <div>
      <TextareaField
        id="maiusculas-minusculas-input"
        label="Digite o texto"
        rows={5}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />

      {hasText ? (
        <div className="mt-6 space-y-3">
          {TEXT_CASE_MODES.map((mode) => (
            <div
              key={mode.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 p-4"
            >
              <div className="min-w-0">
                <p className="text-xs font-medium text-zinc-500">{mode.label}</p>
                <p className="mt-1 break-words text-base text-zinc-900">
                  {applyTextCase(text, mode.id)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => copyText(applyTextCase(text, mode.id), mode.id)}
                className="shrink-0 text-sm font-medium text-teal-700 hover:text-teal-900"
              >
                {copiedId === mode.id ? "Copiado!" : "Copiar"}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-6 text-sm text-zinc-500">Digite um texto acima para ver as variações.</p>
      )}
    </div>
  );
}
