"use client";

import { useMemo, useState } from "react";
import { TextareaField } from "@/components/forms/TextareaField";
import { removeAccents } from "@/lib/formatters/remove-accents";

/**
 * Remover Acentos de Texto (categoria Funções String). Ex.: "São José" ->
 * "Sao Jose". Usa normalização Unicode (NFD + remoção de marcas
 * diacríticas), preservando a caixa original do texto.
 */
export function RemoverAcentosTool() {
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);

  const result = useMemo(() => removeAccents(text), [text]);

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
        id="remover-acentos-input"
        label="Digite ou cole o texto"
        placeholder="ex.: São José do Rio Preto"
        rows={6}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />

      <div className="mt-6">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-700">Resultado sem acentos</span>
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
          placeholder="O texto sem acentos aparece aqui."
          className="w-full rounded-lg border border-zinc-300 bg-zinc-50 py-3 px-4 text-base text-zinc-900"
        />
      </div>
    </div>
  );
}
