"use client";

import { useState } from "react";
import { TextareaField } from "@/components/forms/TextareaField";
import {
  applyAllFancyTextStyles,
  validateFancyTextInput,
  FANCY_TEXT_MAX_LENGTH,
} from "@/lib/calculators/fancy-text-generator";

/**
 * Componente principal do Gerador de Letras Diferentes (categoria
 * Geradores). Toda a conversão acontece 100% no navegador do usuário — o
 * texto digitado nunca é enviado, armazenado ou registrado em log.
 *
 * Diferente dos outros geradores, esta ferramenta é determinística (não
 * usa nenhuma fonte de aleatoriedade): o mesmo texto sempre produz os
 * mesmos resultados estilizados.
 */
export function FancyTextGeneratorTool() {
  const [text, setText] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const errors = validateFancyTextInput(text);
  const hasError = text.length > 0 && Boolean(errors.text);
  const styles = text.trim().length > 0 && !hasError ? applyAllFancyTextStyles(text) : [];

  async function copyText(value: string, id: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(id);
      setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 2000);
    } catch {
      setCopiedId(null);
    }
  }

  return (
    <div>
      <TextareaField
        id="fancy-text-generator-input"
        label="Digite o texto"
        placeholder="Digite algo aqui..."
        hint={`Máximo de ${FANCY_TEXT_MAX_LENGTH} caracteres.`}
        value={text}
        maxLength={FANCY_TEXT_MAX_LENGTH}
        onChange={(event) => setText(event.target.value)}
        error={hasError ? errors.text : undefined}
      />

      {styles.length > 0 ? (
        <div className="mt-6 space-y-3">
          {styles.map((style) => (
            <div
              key={style.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 p-4"
            >
              <div className="min-w-0">
                <p className="text-xs font-medium text-zinc-500">{style.label}</p>
                <p className="mt-1 break-words text-lg text-zinc-900">{style.value}</p>
              </div>
              <button
                type="button"
                onClick={() => copyText(style.value, style.id)}
                className="shrink-0 text-sm font-medium text-teal-700 hover:text-teal-900"
              >
                {copiedId === style.id ? "Copiado!" : "Copiar"}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-6 text-sm text-zinc-500">
          Digite um texto acima para ver as variações estilizadas.
        </p>
      )}
    </div>
  );
}
