"use client";

import { useMemo, useState } from "react";
import { TextareaField } from "@/components/forms/TextareaField";
import { countCharacters, CHARACTER_COUNTER_MAX_LENGTH } from "@/lib/formatters/character-counter";

const STAT_LABELS: { key: keyof ReturnType<typeof countCharacters>; label: string }[] = [
  { key: "charactersWithSpaces", label: "Caracteres (com espaços)" },
  { key: "charactersWithoutSpaces", label: "Caracteres (sem espaços)" },
  { key: "words", label: "Palavras" },
  { key: "lines", label: "Linhas" },
  { key: "paragraphs", label: "Parágrafos" },
  { key: "digits", label: "Números" },
];

/**
 * Contador de Caracteres (categoria Funções String). Contagem em tempo
 * real, 100% local — nada é enviado a nenhum servidor.
 */
export function ContadorCaracteresTool() {
  const [text, setText] = useState("");
  const counts = useMemo(() => countCharacters(text), [text]);

  return (
    <div>
      <TextareaField
        id="contador-caracteres-input"
        label="Digite ou cole o texto"
        placeholder="Digite aqui para ver a contagem em tempo real..."
        hint={`Máximo de ${CHARACTER_COUNTER_MAX_LENGTH.toLocaleString("pt-BR")} caracteres.`}
        rows={10}
        value={text}
        maxLength={CHARACTER_COUNTER_MAX_LENGTH}
        onChange={(event) => setText(event.target.value)}
      />

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
        {STAT_LABELS.map((stat) => (
          <div key={stat.key} className="rounded-lg border border-zinc-200 p-4 text-center">
            <p className="text-2xl font-bold text-zinc-900">{counts[stat.key].toLocaleString("pt-BR")}</p>
            <p className="mt-1 text-xs text-zinc-500">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
