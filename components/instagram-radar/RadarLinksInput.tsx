"use client";

import { useMemo, useState } from "react";
import { parseQueueLinks } from "@/lib/video-queue/links";
import { MAX_LINKS_PER_SUBMISSION, VIDEO_QUEUE_SOURCE_LABEL } from "@/lib/video-queue/types";
import { radarInputClass, radarLabelClass } from "./RadarScheduleFields";

export const MAX_TXT_FILE_BYTES = 512 * 1024;

export type RadarLinksMode = "AUTHORIZED" | "REFERENCE";

/** Resumo dos links colados (mesma leitura do servidor: linha, vírgula, espaço). */
export function useParsedLinks(text: string, isAdmin = false) {
  return useMemo(() => parseQueueLinks(text, isAdmin ? Infinity : MAX_LINKS_PER_SUBMISSION), [text, isAdmin]);
}

/**
 * Campo grande para colar dezenas/centenas de links (ou importar um .txt),
 * com contagem de reconhecidos, repetidos e inválidos, e a escolha EXPLÍCITA
 * entre "tenho autorização" (importa pelo importador existente) e "só
 * referência" (nada é baixado — aguarda o arquivo autorizado).
 */
export function RadarLinksInput({
  text,
  onTextChange,
  mode,
  onModeChange,
  authorized,
  onAuthorizedChange,
  isAdmin = false,
}: {
  text: string;
  onTextChange: (value: string) => void;
  mode: RadarLinksMode;
  onModeChange: (mode: RadarLinksMode) => void;
  authorized: boolean;
  onAuthorizedChange: (value: boolean) => void;
  isAdmin?: boolean;
}) {
  const parsed = useParsedLinks(text, isAdmin);
  const [fileError, setFileError] = useState<string | null>(null);
  const kinds = parsed.accepted.reduce<Record<string, number>>((acc, link) => ({ ...acc, [link.kind]: (acc[link.kind] ?? 0) + 1 }), {});

  const importTxt = async (file: File | undefined) => {
    setFileError(null);
    if (!file) return;
    if (!/\.txt$/i.test(file.name) && file.type !== "text/plain") return setFileError("Envie um arquivo .txt com um link por linha.");
    if (file.size > MAX_TXT_FILE_BYTES) return setFileError("Arquivo grande demais (máximo 512 KB).");
    const content = await file.text();
    onTextChange(text.trim() ? `${text.trim()}\n${content}` : content);
  };

  return (
    <div className="space-y-3">
      <label className={radarLabelClass}>
        Links dos vídeos (um por linha — também aceita vírgula ou espaço)
        <textarea
          className={`${radarInputClass} h-56 font-mono text-base sm:text-sm`}
          placeholder={"https://www.instagram.com/reel/EXEMPLO1/\nhttps://www.instagram.com/reel/EXEMPLO2/"}
          value={text}
          onChange={(event) => onTextChange(event.target.value)}
        />
      </label>
      <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-teal-800">
        Importar arquivo TXT
        <input type="file" accept=".txt,text/plain" className="text-xs" onChange={(event) => importTxt(event.target.files?.[0])} />
      </label>
      {fileError ? <p className="text-xs text-red-700">{fileError}</p> : null}
      <p className="text-sm text-zinc-700" aria-live="polite">
        <strong>{parsed.accepted.length}</strong> link(s) reconhecido(s)
        {Object.entries(kinds).length > 0 ? ` (${Object.entries(kinds).map(([kind, count]) => `${count} ${VIDEO_QUEUE_SOURCE_LABEL[kind as keyof typeof VIDEO_QUEUE_SOURCE_LABEL]}`).join(", ")})` : ""}
        {parsed.duplicates.length > 0 ? ` · ${parsed.duplicates.length} repetido(s) removido(s)` : ""}
        {parsed.rejected.length > 0 ? ` · ${parsed.rejected.length} inválido(s)` : ""}
        {parsed.overLimit ? ` · máximo de ${MAX_LINKS_PER_SUBMISSION} por envio (adicione o resto depois)` : ""}
      </p>
      {parsed.rejected.length > 0 ? (
        <details className="rounded-md bg-red-50 p-2 text-xs text-red-800">
          <summary className="cursor-pointer font-medium">Ver links inválidos</summary>
          <ul className="mt-1 space-y-0.5">
            {parsed.rejected.slice(0, 50).map((entry, index) => (
              <li key={`${entry.sourceUrl}-${index}`} className="break-all">
                {entry.sourceUrl} — {entry.reason}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <fieldset className="space-y-2 rounded-md border border-zinc-200 p-3 text-sm">
        <legend className="px-1 font-medium text-zinc-800">Autorização dos vídeos</legend>
        <label className="flex items-start gap-2">
          <input type="radio" name="radar-links-mode" className="mt-1" checked={mode === "AUTHORIZED"} onChange={() => onModeChange("AUTHORIZED")} />
          <span>
            Tenho autorização para republicar estes vídeos — importar automaticamente.
            <span className="block text-xs text-zinc-500">Usa o importador do Alilu (Instagram pelo provedor autorizado; links diretos de arquivo pelo download seguro).</span>
          </span>
        </label>
        <label className="flex items-start gap-2">
          <input type="radio" name="radar-links-mode" className="mt-1" checked={mode === "REFERENCE"} onChange={() => onModeChange("REFERENCE")} />
          <span>
            Registrar só como referência — não baixar nada.
            <span className="block text-xs text-zinc-500">Cada link fica “Aguardando arquivo autorizado” até você enviar o vídeo autorizado pelo dono.</span>
          </span>
        </label>
        {mode === "AUTHORIZED" ? (
          <label className="flex items-start gap-2 rounded-md bg-amber-50 p-2 text-xs text-amber-900">
            <input type="checkbox" className="mt-0.5" checked={authorized} onChange={(event) => onAuthorizedChange(event.target.checked)} />
            Declaro que sou o autor destes vídeos ou tenho autorização do autor para republicá-los nesta conta. Um Reel ser público não é autorização.
          </label>
        ) : null}
      </fieldset>
    </div>
  );
}
