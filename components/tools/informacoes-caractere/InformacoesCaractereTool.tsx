"use client";

import { useMemo, useState } from "react";
import { TextField } from "@/components/forms/TextField";
import { getCharacterInfo } from "@/lib/formatters/character-info";

const INFO_ROWS: { key: "hex" | "decimal" | "htmlEntityDecimal" | "htmlEntityHex"; label: string }[] = [
  { key: "decimal", label: "Code point (decimal)" },
  { key: "hex", label: "Code point (hexadecimal)" },
  { key: "htmlEntityDecimal", label: "HTML Entity (decimal)" },
  { key: "htmlEntityHex", label: "HTML Entity (hexadecimal)" },
];

/**
 * Informações de Caracter (categoria Funções String). Mostra apenas
 * propriedades técnicas confirmáveis por API padrão do JavaScript
 * (code point, hexadecimal, entity HTML, bytes UTF-8) — nenhuma
 * característica não confirmada é inventada.
 */
export function InformacoesCaractereTool() {
  const [input, setInput] = useState("");
  const info = useMemo(() => getCharacterInfo(input), [input]);

  return (
    <div>
      <TextField
        id="informacoes-caractere-input"
        label="Digite um caractere"
        placeholder="ex.: A, ç, €, 😀"
        value={input}
        onChange={(event) => setInput(event.target.value)}
        hint="Se você digitar mais de um caractere, apenas o primeiro é analisado."
      />

      {info ? (
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 py-8">
            <span className="text-5xl text-zinc-900">{info.char}</span>
          </div>

          <dl className="divide-y divide-zinc-100 rounded-lg border border-zinc-200">
            {INFO_ROWS.map((row) => (
              <div key={row.key} className="flex items-center justify-between gap-3 px-4 py-3">
                <dt className="text-sm text-zinc-600">{row.label}</dt>
                <dd className="font-mono text-sm text-zinc-900">{info[row.key]}</dd>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <dt className="text-sm text-zinc-600">Bytes em UTF-8</dt>
              <dd className="font-mono text-sm text-zinc-900">
                {info.utf8Bytes.map((byte) => byte.toString(16).toUpperCase().padStart(2, "0")).join(" ")}
              </dd>
            </div>
          </dl>
        </div>
      ) : (
        <p className="mt-6 text-sm text-zinc-500">Digite um caractere acima para ver suas informações.</p>
      )}
    </div>
  );
}
