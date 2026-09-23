"use client";

import { useId } from "react";
import { Button } from "@/components/ui/Button";
import { MAX_INLINE_RESULT_CHARS } from "./base64-tools";

interface Base64OutputProps {
  label: string;
  value: string;
  rows?: number;
  copyLabel: string;
  onCopy: (value: string) => void;
  /** Nome do .txt oferecido quando o resultado é grande demais para exibir inteiro */
  downloadName?: string;
  onDownloadText?: (value: string, fileName: string) => void;
}

/**
 * Campo de resultado somente leitura com botão de copiar. Resultados muito
 * grandes (vídeos, PDFs) mostram só uma prévia — renderizar dezenas de MB
 * em um textarea travaria a página — mas o botão copia/baixa o conteúdo
 * completo.
 */
export function Base64Output({
  label,
  value,
  rows = 6,
  copyLabel,
  onCopy,
  downloadName,
  onDownloadText,
}: Base64OutputProps) {
  const id = useId();
  const truncated = value.length > MAX_INLINE_RESULT_CHARS;
  const shown = truncated ? `${value.slice(0, 2000)}…` : value;

  return (
    <div className="min-w-0 space-y-2">
      <label htmlFor={id} className="text-xs font-medium text-zinc-700">
        {label}
      </label>
      <textarea
        id={id}
        readOnly
        value={shown}
        rows={rows}
        aria-describedby={truncated ? `${id}-note` : undefined}
        className="block w-full min-w-0 resize-y break-all rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-sm text-zinc-900"
      />
      {truncated ? (
        <p id={`${id}-note`} className="text-xs text-zinc-500">
          Resultado grande ({value.length.toLocaleString("pt-BR")} caracteres): exibindo apenas o início. Use os
          botões abaixo para copiar ou baixar o conteúdo completo.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={() => onCopy(value)}>
          {copyLabel}
        </Button>
        {downloadName && onDownloadText ? (
          <Button type="button" variant="secondary" onClick={() => onDownloadText(value, downloadName)}>
            Baixar .txt
          </Button>
        ) : null}
      </div>
    </div>
  );
}
