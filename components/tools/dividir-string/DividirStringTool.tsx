"use client";

import { useMemo, useState } from "react";
import { TextareaField } from "@/components/forms/TextareaField";
import { SelectField } from "@/components/forms/SelectField";
import { TextField } from "@/components/forms/TextField";
import {
  splitString,
  DEFAULT_SPLIT_OPTIONS,
  type SplitOptions,
} from "@/lib/formatters/string-splitter";

/**
 * Dividir String (categoria Funções String). Divide o texto em itens a
 * partir de um delimitador, tudo localmente e em tempo real.
 */
export function DividirStringTool() {
  const [text, setText] = useState("");
  const [options, setOptions] = useState<SplitOptions>(DEFAULT_SPLIT_OPTIONS);
  const [copied, setCopied] = useState(false);

  const items = useMemo(() => splitString(text, options), [text, options]);
  const resultText = items.join("\n");

  async function copyList() {
    try {
      await navigator.clipboard.writeText(resultText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div>
      <TextareaField
        id="dividir-string-input"
        label="Digite ou cole o texto"
        placeholder="ex.: maçã, banana, uva"
        rows={6}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SelectField
          id="dividir-string-delimitador"
          label="Dividir por"
          value={options.preset}
          onChange={(event) =>
            setOptions((current) => ({
              ...current,
              preset: event.target.value as SplitOptions["preset"],
            }))
          }
        >
          <option value="comma">Vírgula ( , )</option>
          <option value="semicolon">Ponto e vírgula ( ; )</option>
          <option value="space">Espaço</option>
          <option value="newline">Quebra de linha</option>
          <option value="custom">Delimitador personalizado</option>
        </SelectField>
        {options.preset === "custom" ? (
          <TextField
            id="dividir-string-custom"
            label="Delimitador personalizado"
            placeholder="ex.: | ou ::"
            value={options.customDelimiter}
            onChange={(event) =>
              setOptions((current) => ({ ...current, customDelimiter: event.target.value }))
            }
          />
        ) : (
          <div className="flex flex-col justify-end gap-2 pb-1">
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={options.trimItems}
                onChange={(event) =>
                  setOptions((current) => ({ ...current, trimItems: event.target.checked }))
                }
              />
              Remover espaços das pontas de cada item
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={options.removeEmpty}
                onChange={(event) =>
                  setOptions((current) => ({ ...current, removeEmpty: event.target.checked }))
                }
              />
              Remover itens vazios
            </label>
          </div>
        )}
      </div>

      {options.preset === "custom" ? (
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={options.trimItems}
              onChange={(event) =>
                setOptions((current) => ({ ...current, trimItems: event.target.checked }))
              }
            />
            Remover espaços das pontas de cada item
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={options.removeEmpty}
              onChange={(event) =>
                setOptions((current) => ({ ...current, removeEmpty: event.target.checked }))
              }
            />
            Remover itens vazios
          </label>
        </div>
      ) : null}

      <div className="mt-6">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-700">
            {items.length} {items.length === 1 ? "item encontrado" : "itens encontrados"}
          </span>
          {items.length > 0 ? (
            <button
              type="button"
              onClick={copyList}
              className="text-sm font-medium text-teal-700 hover:text-teal-900"
            >
              {copied ? "Copiado!" : "Copiar lista"}
            </button>
          ) : null}
        </div>
        {items.length > 0 ? (
          <ol className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-zinc-200 p-4 text-sm text-zinc-800">
            {items.map((item, index) => (
              <li key={`${index}-${item}`} className="break-words">
                <span className="mr-2 text-zinc-400">{index + 1}.</span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-sm text-zinc-500">
            Digite um texto acima para ver os itens divididos.
          </p>
        )}
      </div>
    </div>
  );
}
