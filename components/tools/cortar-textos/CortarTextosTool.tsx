"use client";

import { useMemo, useState } from "react";
import { TextareaField } from "@/components/forms/TextareaField";
import { SelectField } from "@/components/forms/SelectField";
import { NumberField } from "@/components/forms/NumberField";
import {
  truncateText,
  DEFAULT_TRUNCATE_OPTIONS,
  TRUNCATE_MAX_LIMIT,
  type TruncateOptions,
} from "@/lib/formatters/text-truncate";

const UNIT_LABEL: Record<TruncateOptions["unit"], string> = {
  characters: "caracteres",
  words: "palavras",
  lines: "linhas",
};

/**
 * Cortar Textos (categoria Funções String). Limita o texto por
 * caracteres, palavras ou linhas, tudo localmente e em tempo real.
 */
export function CortarTextosTool() {
  const [text, setText] = useState("");
  const [options, setOptions] = useState<TruncateOptions>(DEFAULT_TRUNCATE_OPTIONS);
  const [copied, setCopied] = useState(false);

  const result = useMemo(() => truncateText(text, options), [text, options]);

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
        id="cortar-textos-input"
        label="Digite ou cole o texto original"
        rows={8}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SelectField
          id="cortar-textos-unidade"
          label="Limitar por"
          value={options.unit}
          onChange={(event) =>
            setOptions((current) => ({ ...current, unit: event.target.value as TruncateOptions["unit"] }))
          }
        >
          <option value="characters">Caracteres</option>
          <option value="words">Palavras</option>
          <option value="lines">Linhas</option>
        </SelectField>
        <NumberField
          id="cortar-textos-limite"
          label={`Limite (${UNIT_LABEL[options.unit]})`}
          hint={`Máximo de ${TRUNCATE_MAX_LIMIT.toLocaleString("pt-BR")}.`}
          value={String(options.limit)}
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, "").slice(0, 6);
            const parsed = digits === "" ? 0 : Math.min(TRUNCATE_MAX_LIMIT, Number(digits));
            setOptions((current) => ({ ...current, limit: parsed }));
          }}
        />
        <div className="flex flex-col justify-end gap-2 pb-1">
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={options.addEllipsis}
              onChange={(event) =>
                setOptions((current) => ({ ...current, addEllipsis: event.target.checked }))
              }
            />
            Adicionar &quot;…&quot; ao final
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={options.avoidCuttingWord}
              disabled={options.unit !== "characters"}
              onChange={(event) =>
                setOptions((current) => ({ ...current, avoidCuttingWord: event.target.checked }))
              }
            />
            Evitar cortar palavra ao meio
          </label>
        </div>
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
          rows={8}
          value={result}
          placeholder="O texto cortado aparece aqui."
          className="w-full rounded-lg border border-zinc-300 bg-zinc-50 py-3 px-4 text-base text-zinc-900"
        />
      </div>
    </div>
  );
}
