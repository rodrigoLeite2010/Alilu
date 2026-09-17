"use client";

import { useMemo, useState } from "react";
import { TextareaField } from "@/components/forms/TextareaField";
import { TextField } from "@/components/forms/TextField";
import {
  countWordOccurrences,
  DEFAULT_WORD_OCCURRENCE_OPTIONS,
  type WordOccurrenceOptions,
} from "@/lib/formatters/word-occurrence";

/**
 * Contador de Ocorrência de Palavra em um Texto (categoria Funções
 * String). Tudo calculado localmente, em tempo real.
 */
export function ContadorOcorrenciaPalavraTool() {
  const [text, setText] = useState("");
  const [term, setTerm] = useState("");
  const [options, setOptions] = useState<WordOccurrenceOptions>(DEFAULT_WORD_OCCURRENCE_OPTIONS);

  const result = useMemo(() => countWordOccurrences(text, term, options), [text, term, options]);

  return (
    <div>
      <TextareaField
        id="contador-ocorrencia-input"
        label="Digite ou cole o texto"
        rows={8}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-end">
        <TextField
          id="contador-ocorrencia-termo"
          label="Palavra ou expressão a buscar"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
        />
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pb-3">
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={options.caseSensitive}
              onChange={(event) =>
                setOptions((current) => ({ ...current, caseSensitive: event.target.checked }))
              }
            />
            Diferenciar maiúsculas/minúsculas
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={options.wholeWord}
              onChange={(event) =>
                setOptions((current) => ({ ...current, wholeWord: event.target.checked }))
              }
            />
            Apenas palavra inteira
          </label>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-zinc-200 p-4">
        <p className="text-lg font-semibold text-zinc-900">
          {result.count} {result.count === 1 ? "ocorrência encontrada" : "ocorrências encontradas"}
        </p>

        {result.matches.length > 0 ? (
          <ul className="mt-3 max-h-56 space-y-1 overflow-y-auto text-sm text-zinc-600">
            {result.matches.map((match, index) => (
              <li key={`${match.line}-${match.column}-${index}`}>
                Linha {match.line}, coluna {match.column}
              </li>
            ))}
          </ul>
        ) : term.length > 0 ? (
          <p className="mt-2 text-sm text-zinc-500">Nenhuma ocorrência encontrada.</p>
        ) : (
          <p className="mt-2 text-sm text-zinc-500">Digite uma palavra ou expressão para buscar.</p>
        )}
      </div>
    </div>
  );
}
