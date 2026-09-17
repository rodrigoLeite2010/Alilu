"use client";

import { useMemo, useState } from "react";
import { TextareaField } from "@/components/forms/TextareaField";
import {
  DEFAULT_ALPHABETICAL_SORT_OPTIONS,
  sortLinesAlphabetically,
  type AlphabeticalSortOptions,
} from "@/lib/formatters/alphabetical-sort";

/**
 * Colocar em Ordem Alfabética (categoria Funções String). Ordena as linhas
 * digitadas usando Intl.Collator (pt-BR), com acentuação tratada
 * corretamente. Tudo acontece localmente, em tempo real.
 */
export function OrdemAlfabeticaTool() {
  const [text, setText] = useState("");
  const [options, setOptions] = useState<AlphabeticalSortOptions>(DEFAULT_ALPHABETICAL_SORT_OPTIONS);
  const [copied, setCopied] = useState(false);

  const sorted = useMemo(() => sortLinesAlphabetically(text, options), [text, options]);
  const result = sorted.join("\n");

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
        id="ordem-alfabetica-input"
        label="Digite ou cole uma linha por item"
        placeholder={"banana\nabacaxi\nmaçã"}
        rows={8}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="radio"
            name="ordem-alfabetica-direction"
            checked={options.direction === "asc"}
            onChange={() => setOptions((current) => ({ ...current, direction: "asc" }))}
          />
          A → Z
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="radio"
            name="ordem-alfabetica-direction"
            checked={options.direction === "desc"}
            onChange={() => setOptions((current) => ({ ...current, direction: "desc" }))}
          />
          Z → A
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={options.caseInsensitive}
            onChange={(event) =>
              setOptions((current) => ({ ...current, caseInsensitive: event.target.checked }))
            }
          />
          Ignorar maiúsculas/minúsculas
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={options.removeDuplicates}
            onChange={(event) =>
              setOptions((current) => ({ ...current, removeDuplicates: event.target.checked }))
            }
          />
          Remover duplicados
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={options.skipEmptyLines}
            onChange={(event) =>
              setOptions((current) => ({ ...current, skipEmptyLines: event.target.checked }))
            }
          />
          Ignorar linhas vazias
        </label>
      </div>

      <div className="mt-6">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-700">
            Resultado ({sorted.length} {sorted.length === 1 ? "linha" : "linhas"})
          </span>
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
          rows={8}
          value={result}
          placeholder="O resultado ordenado aparece aqui."
          className="w-full rounded-lg border border-zinc-300 bg-zinc-50 py-3 px-4 text-base text-zinc-900"
        />
      </div>
    </div>
  );
}
