"use client";

import { useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/instagram/ConfirmDialog";

export interface MyMediaItem {
  id: string;
  kind: "library" | "ai-video" | "import";
  mediaType: "VIDEO" | "IMAGE";
  url: string;
  name: string | null;
  sizeBytes: number | null;
  createdAt: string;
  expiresAt: string | null;
}

const SECTIONS: { kind: MyMediaItem["kind"]; title: string; hint: string }[] = [
  { kind: "library", title: "Biblioteca do Instagram", hint: "Imagens e vídeos enviados para posts, Reels, carrosséis e Piloto Automático." },
  { kind: "ai-video", title: "Vídeos com IA", hint: "Vídeos gerados a partir de imagens. Também somem sozinhos quando vencem." },
  { kind: "import", title: "Importados do Instagram", hint: "Arquivos importados por link ou upload manual." },
];

const DELETE_URL: Record<MyMediaItem["kind"], (id: string) => string> = {
  library: (id) => `/api/content-automation/media/${id}`,
  "ai-video": (id) => `/api/ai-video/generations/${id}`,
  import: (id) => `/api/videos/instagram-import/${id}`,
};

function size(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes)) return "";
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function date(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function MyMediaManager({ initialItems }: { initialItems: MyMediaItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [toDelete, setToDelete] = useState<MyMediaItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const totals = useMemo(() => {
    const known = items.filter((item) => item.sizeBytes !== null);
    return { count: items.length, bytes: known.reduce((sum, item) => sum + (item.sizeBytes ?? 0), 0) };
  }, [items]);

  async function confirmDelete() {
    if (!toDelete) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(DELETE_URL[toDelete.kind](toDelete.id), { method: "DELETE" });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Não foi possível excluir.");
      }
      const removed = toDelete;
      setItems((list) => list.filter((item) => !(item.id === removed.id && item.kind === removed.kind)));
      setMessage({ tone: "ok", text: "Mídia excluída do Alilu." });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Não foi possível excluir." });
    } finally {
      setBusy(false);
      setToDelete(null);
    }
  }

  return (
    <div className="space-y-8">
      <p className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
        {totals.count} arquivo{totals.count === 1 ? "" : "s"} guardado{totals.count === 1 ? "" : "s"}
        {totals.bytes > 0 ? ` · pelo menos ${size(totals.bytes)}` : ""}
      </p>
      {message ? (
        <p role="status" className={`rounded-md px-3 py-2 text-sm ${message.tone === "ok" ? "bg-teal-50 text-teal-900" : "bg-red-50 text-red-700"}`}>
          {message.text}
        </p>
      ) : null}
      {SECTIONS.map((section) => {
        const list = items.filter((item) => item.kind === section.kind);
        return (
          <section key={section.kind}>
            <h2 className="text-lg font-semibold text-zinc-900">
              {section.title} <span className="text-sm font-normal text-zinc-500">({list.length})</span>
            </h2>
            <p className="text-sm text-zinc-500">{section.hint}</p>
            {list.length === 0 ? (
              <p className="mt-3 rounded-md border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-500">Nada aqui.</p>
            ) : (
              <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {list.map((item) => (
                  <li key={`${item.kind}-${item.id}`} className="overflow-hidden rounded-lg border border-zinc-200">
                    <a href={item.url} target="_blank" rel="noreferrer" className="block aspect-square bg-zinc-100">
                      {item.mediaType === "VIDEO" ? (
                        <video src={`${item.url}#t=0.5`} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element -- arquivo do próprio usuário no Blob.
                        <img src={item.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                      )}
                    </a>
                    <div className="space-y-1 p-2 text-xs">
                      <p className="truncate text-zinc-800" title={item.name ?? ""}>
                        {item.name || (item.mediaType === "VIDEO" ? "Vídeo" : "Imagem")}
                      </p>
                      <p className="text-zinc-500">
                        {date(item.createdAt)}
                        {item.sizeBytes ? ` · ${size(item.sizeBytes)}` : ""}
                        {item.expiresAt ? ` · some em ${date(item.expiresAt)}` : ""}
                      </p>
                      <div className="flex justify-between gap-2 pt-1">
                        <a href={`${item.url}?download=1`} className="font-medium text-teal-800 underline">
                          Baixar
                        </a>
                        <button type="button" onClick={() => setToDelete(item)} className="font-medium text-red-700 underline">
                          Excluir mídia
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
      <ConfirmDialog
        open={toDelete !== null}
        title="Excluir esta mídia?"
        description="O arquivo é apagado de verdade do armazenamento do Alilu e não dá para desfazer. Mídias já usadas em publicações ou automações não podem ser excluídas."
        confirmLabel="Excluir mídia"
        destructive
        busy={busy}
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}
