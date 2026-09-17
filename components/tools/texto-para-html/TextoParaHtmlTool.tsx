"use client";

import { useMemo, useState } from "react";
import { TextareaField } from "@/components/forms/TextareaField";
import { SelectField } from "@/components/forms/SelectField";
import {
  textToHtml,
  DEFAULT_TEXT_TO_HTML_OPTIONS,
  type TextToHtmlOptions,
} from "@/lib/formatters/html-converter";

/**
 * Converter Texto para HTML (categoria Funções String). Escapa os
 * caracteres especiais do HTML antes de qualquer conversão, então o HTML
 * produzido é sempre seguro — e é exibido apenas como texto (em uma
 * <textarea>/<pre>), nunca renderizado/executado por esta página, evitando
 * XSS.
 */
export function TextoParaHtmlTool() {
  const [text, setText] = useState("");
  const [options, setOptions] = useState<TextToHtmlOptions>(DEFAULT_TEXT_TO_HTML_OPTIONS);
  const [copied, setCopied] = useState(false);

  const html = useMemo(() => textToHtml(text, options), [text, options]);

  async function copyHtml() {
    try {
      await navigator.clipboard.writeText(html);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div>
      <TextareaField
        id="texto-para-html-input"
        label="Digite ou cole o texto original"
        rows={8}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SelectField
          id="texto-para-html-modo"
          label="Quebra de linha"
          value={options.mode}
          onChange={(event) =>
            setOptions((current) => ({ ...current, mode: event.target.value as "br" | "p" }))
          }
        >
          <option value="br">Cada linha vira &lt;br&gt;</option>
          <option value="p">Cada parágrafo vira &lt;p&gt;</option>
        </SelectField>
        <label className="flex items-center gap-2 self-end pb-3 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={options.preserveSpaces}
            onChange={(event) =>
              setOptions((current) => ({ ...current, preserveSpaces: event.target.checked }))
            }
          />
          Preservar espaços extras (&amp;nbsp;)
        </label>
      </div>

      <div className="mt-6">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-700">HTML gerado</span>
          {html.length > 0 ? (
            <button
              type="button"
              onClick={copyHtml}
              className="text-sm font-medium text-teal-700 hover:text-teal-900"
            >
              {copied ? "Copiado!" : "Copiar HTML"}
            </button>
          ) : null}
        </div>
        <textarea
          readOnly
          rows={8}
          value={html}
          placeholder="O HTML gerado aparece aqui, como texto (não é executado nesta página)."
          className="w-full rounded-lg border border-zinc-300 bg-zinc-50 py-3 px-4 font-mono text-sm text-zinc-900"
        />
        <p className="mt-1.5 text-xs text-zinc-500">
          O resultado é exibido só como texto, para você copiar — esta página nunca executa o HTML
          gerado.
        </p>
      </div>
    </div>
  );
}
