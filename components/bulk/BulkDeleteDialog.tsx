"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { bulkDeleteInChunks, summarizeBulkDelete, type BulkDeleteProgress } from "@/lib/bulk-delete/client";
import type { BulkDeleteResult } from "@/lib/bulk-delete/core";

type Phase = "closed" | "confirm" | "running" | "done";

interface Noun {
  singular: string;
  plural: string;
  deletedSingular?: string;
  deletedPlural?: string;
}

/**
 * Orquestra confirmação → progresso → resultado de uma exclusão em massa.
 * `onDeleted(ids)` recebe só o que foi realmente excluído (e já some da
 * lista); `labelFor(id)` dá nome legível às falhas listadas no resumo.
 */
export function useBulkDelete({
  url,
  noun = { singular: "item", plural: "itens" },
  onDeleted,
  labelFor,
  note,
}: {
  url: string;
  noun?: Noun;
  onDeleted: (ids: string[]) => void;
  labelFor?: (id: string) => string;
  /** Aviso extra na confirmação (ex.: "Publicações já feitas continuam no Instagram."). */
  note?: string;
}) {
  const [phase, setPhase] = useState<Phase>("closed");
  const [ids, setIds] = useState<string[]>([]);
  const [progress, setProgress] = useState<BulkDeleteProgress>({ processed: 0, total: 0 });
  const [result, setResult] = useState<BulkDeleteResult | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  const request = useCallback((selected: string[]) => {
    if (selected.length === 0) return;
    setIds(selected);
    setResult(null);
    setProgress({ processed: 0, total: selected.length });
    setPhase("confirm");
  }, []);

  const run = useCallback(async () => {
    setPhase("running");
    abort.current = new AbortController();
    const outcome = await bulkDeleteInChunks({ url, ids, onProgress: setProgress, signal: abort.current.signal });
    const text = summarizeBulkDelete(outcome, noun);
    setResult(outcome);
    setSummary(text);
    setMessage(text);
    setPhase("done");
    if (outcome.deleted.length > 0) onDeleted(outcome.deleted);
  }, [url, ids, noun, onDeleted]);

  const close = useCallback(() => {
    if (phase === "running") return;
    setPhase("closed");
  }, [phase]);

  const dismissMessage = useCallback(() => setMessage(null), []);

  const total = ids.length;
  const totalWord = total === 1 ? noun.singular : noun.plural;
  const dialog = (
    <Dialog
      open={phase !== "closed"}
      title={phase === "done" ? "Exclusão concluída" : phase === "running" ? "Excluindo…" : `Excluir ${total} ${totalWord}?`}
      onClose={close}
      footer={
        phase === "confirm" ? (
          <>
            <Button type="button" variant="secondary" onClick={close}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void run()} className="bg-red-600 hover:bg-red-700 active:bg-red-800">
              Excluir {total} {totalWord}
            </Button>
          </>
        ) : phase === "done" ? (
          <Button type="button" onClick={close}>
            Fechar
          </Button>
        ) : undefined
      }
    >
      {phase === "confirm" ? (
        <>
          <p className="text-sm text-zinc-700">
            {total === 1
              ? `Tem certeza que deseja excluir o ${noun.singular} selecionado? Esta ação poderá ser irreversível.`
              : `Tem certeza que deseja excluir os ${total} ${noun.plural} selecionados? Esta ação poderá ser irreversível.`}
          </p>
          {note ? <p className="text-sm text-zinc-600">{note}</p> : null}
        </>
      ) : null}
      {phase === "running" ? (
        <div aria-live="polite">
          <p className="text-sm text-zinc-700">
            Excluindo {progress.processed} de {progress.total}… Não feche esta janela.
          </p>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-valuenow={progress.processed}
            className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-100"
          >
            <div
              className="h-full bg-teal-600 transition-all"
              style={{ width: `${progress.total ? Math.round((progress.processed / progress.total) * 100) : 0}%` }}
            />
          </div>
        </div>
      ) : null}
      {phase === "done" && result ? (
        <>
          <p role="status" className={`text-sm ${result.failed.length ? "text-amber-800" : "text-teal-900"}`}>
            {summary}
          </p>
          {result.failed.length > 0 ? (
            <ul className="max-h-48 list-disc space-y-1 overflow-y-auto pl-5 text-sm text-zinc-700">
              {result.failed.slice(0, 20).map((failure) => (
                <li key={failure.id}>
                  {labelFor ? <strong>{labelFor(failure.id)}: </strong> : null}
                  {failure.reason}
                </li>
              ))}
              {result.failed.length > 20 ? <li>… e mais {result.failed.length - 20}.</li> : null}
            </ul>
          ) : null}
        </>
      ) : null}
    </Dialog>
  );

  return { request, dialog, running: phase === "running", message, dismissMessage };
}
