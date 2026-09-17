"use client";

import { useMemo, useState } from "react";
import { TextareaField } from "@/components/forms/TextareaField";
import { SelectField } from "@/components/forms/SelectField";
import { TextField } from "@/components/forms/TextField";
import {
  removeLineBreaks,
  DEFAULT_REMOVE_LINE_BREAKS_OPTIONS,
  type RemoveLineBreaksOptions,
} from "@/lib/formatters/remove-line-breaks";

/**
 * Remover ou Trocar Quebras de Linha (categoria Funções String).
 * Reconhece \n, \r\n e \r. Tudo calculado localmente, em tempo real.
 */
export function RemoverQuebrasLinhaTool() {
  const [text, setText] = useState("");
  const [options, setOptions] = useState<RemoveLineBreaksOptions>(DEFAULT_REMOVE_LINE_BREAKS_OPTIONS);
  const [copied, setCopied] = useState(false);

  const result = useMemo(() => removeLineBreaks(text, options), [text, options]);

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
        id="remover-quebras-linha-input"
        label="Digite ou cole o texto"
        rows={8}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SelectField
          id="remover-quebras-linha-substituicao"
          label="Substituir quebra de linha por"
          value={options.replacement}
          onChange={(event) =>
            setOptions((current) => ({
              ...current,
              replacement: event.target.value as RemoveLineBreaksOptions["replacement"],
            }))
          }
        >
          <option value="remove">Remover (sem substituto)</option>
          <option value="space">Espaço</option>
          <option value="comma">Vírgula</option>
          <option value="custom">Texto personalizado</option>
        </SelectField>
        {options.replacement === "custom" ? (
          <TextField
            id="remover-quebras-linha-custom"
            label="Texto personalizado"
            value={options.customReplacement}
            onChange={(event) =>
              setOptions((current) => ({ ...current, customReplacement: event.target.value }))
            }
          />
        ) : (
          <label className="flex items-center gap-2 self-end pb-3 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={options.collapseSpaces}
              onChange={(event) =>
                setOptions((current) => ({ ...current, collapseSpaces: event.target.checked }))
              }
            />
            Evitar espaços duplos no resultado
          </label>
        )}
      </div>

      {options.replacement === "custom" ? (
        <label className="mt-4 flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={options.collapseSpaces}
            onChange={(event) =>
              setOptions((current) => ({ ...current, collapseSpaces: event.target.checked }))
            }
          />
          Evitar espaços duplos no resultado
        </label>
      ) : null}

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
          placeholder="O texto sem quebras de linha aparece aqui."
          className="w-full rounded-lg border border-zinc-300 bg-zinc-50 py-3 px-4 text-base text-zinc-900"
        />
      </div>
    </div>
  );
}
