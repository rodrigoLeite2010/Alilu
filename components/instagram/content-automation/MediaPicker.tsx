"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import { Trash2 } from "lucide-react";
import { uploadPresigned } from "@vercel/blob/client";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/instagram/ConfirmDialog";
import { buildMediaPathnamePrefix, IMAGE_MEDIA_CONTENT_TYPES, VIDEO_MEDIA_CONTENT_TYPES } from "@/lib/instagram/backend/media-service";

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === "string" && body.error ? body.error : fallback;
  } catch {
    return fallback;
  }
}

interface MediaItem {
  id: string;
  storageUrl: string;
  mediaType: "image" | "video";
  originalFilename: string | null;
}

function slugFileName(name: string, extension: string): string {
  const base = name
    .replace(/\.[^.]+$/, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 60);
  return `${base || "midia"}-${Date.now()}.${extension}`;
}

/**
 * Seletor de imagem/vídeo fixo para o Piloto Automático de Conteúdo:
 * escolhe entre mídias já enviadas (instagram_media) ou envia uma nova —
 * reaproveita o MESMO client upload (Vercel Blob) e o MESMO storage já
 * usados pelo Criador de Reels/Posts, nunca uma segunda implementação de
 * upload.
 */
export function MediaPicker({
  userId,
  mediaType,
  value,
  onChange,
}: {
  userId: string;
  mediaType: "image" | "video";
  value: string | null;
  onChange: (mediaId: string | null) => void;
}) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MediaItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const inputId = useId();

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/content-automation/media?type=${mediaType}`)
      .then((res) => res.json())
      .then((data: { media?: MediaItem[] }) => {
        if (!cancelled) setItems(data.media ?? []);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mediaType]);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const allowed = mediaType === "image" ? IMAGE_MEDIA_CONTENT_TYPES : VIDEO_MEDIA_CONTENT_TYPES;
    if (!allowed.includes(file.type)) {
      setError(
        mediaType === "image"
          ? "Envie uma imagem JPEG (a Meta só aceita JPEG para posts)."
          : "Envie um vídeo MP4 ou MOV.",
      );
      return;
    }

    setError(null);
    setBusy(true);
    try {
      const extension = mediaType === "image" ? "jpg" : file.name.toLowerCase().endsWith(".mov") ? "mov" : "mp4";
      const fileName = slugFileName(file.name, extension);
      const uploaded = await uploadPresigned(`${buildMediaPathnamePrefix(userId)}${fileName}`, file, {
        access: "public",
        handleUploadUrl: "/api/instagram/media/upload",
        clientPayload: JSON.stringify({ originalFilename: fileName, fileSizeBytes: file.size, contentType: file.type }),
      });

      const resolveResponse = await fetch("/api/content-automation/media/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: uploaded.url }),
      });
      if (!resolveResponse.ok) {
        throw new Error(await readErrorMessage(resolveResponse, "Não foi possível processar o arquivo enviado."));
      }
      const { mediaId } = (await resolveResponse.json()) as { mediaId: string };
      setItems((list) => [
        { id: mediaId, storageUrl: uploaded.url, mediaType, originalFilename: fileName },
        ...list,
      ]);
      onChange(mediaId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar o arquivo.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteConfirmed() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/content-automation/media/${target.id}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Não foi possível apagar a mídia."));
      }
      setItems((list) => list.filter((item) => item.id !== target.id));
      if (value === target.id) onChange(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível apagar a mídia.");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  return (
    <div className="space-y-2">
      {loading ? (
        <p className="text-xs text-zinc-500">Carregando mídias…</p>
      ) : items.length > 0 ? (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {items.map((item) => {
            const selected = item.id === value;
            return (
              <div key={item.id} className="group relative aspect-square">
                <button
                  type="button"
                  onClick={() => onChange(item.id)}
                  className={`absolute inset-0 overflow-hidden rounded-md ring-2 transition-shadow ${
                    selected ? "ring-teal-600" : "ring-transparent hover:ring-zinc-300"
                  }`}
                  aria-pressed={selected}
                  aria-label={item.originalFilename ?? "Selecionar mídia"}
                >
                  {item.mediaType === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.storageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <video src={item.storageUrl} className="h-full w-full object-cover" muted />
                  )}
                  {selected ? (
                    <span className="absolute inset-0 flex items-center justify-center bg-teal-900/30 text-xs font-semibold text-white">
                      Selecionada
                    </span>
                  ) : null}
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setDeleteTarget(item);
                  }}
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity hover:bg-red-700 focus-visible:opacity-100 group-hover:opacity-100"
                  aria-label="Apagar mídia"
                  title="Apagar mídia"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-zinc-500">
          Nenhum{mediaType === "video" ? " vídeo" : "a imagem"} enviad{mediaType === "video" ? "o" : "a"} ainda.
        </p>
      )}

      {value && !items.some((item) => item.id === value) ? (
        <p className="text-xs text-teal-700">Mídia selecionada (fora desta lista).</p>
      ) : null}

      <div className="flex items-center gap-2">
        <label htmlFor={inputId} className="sr-only">
          {mediaType === "image" ? "Enviar imagem" : "Enviar vídeo"}
        </label>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={mediaType === "image" ? "image/jpeg" : "video/mp4,video/quicktime"}
          onChange={handleFile}
          disabled={busy}
          className="hidden"
        />
        <Button type="button" variant="secondary" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? "Enviando…" : mediaType === "image" ? "Enviar nova imagem" : "Enviar novo vídeo"}
        </Button>
        {value ? (
          <Button type="button" variant="ghost" onClick={() => onChange(null)}>
            Remover seleção
          </Button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      ) : null}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Apagar mídia"
        description="Isso apaga o arquivo da sua biblioteca para sempre. Não é possível desfazer."
        confirmLabel="Apagar"
        destructive
        busy={deleting}
        onConfirm={handleDeleteConfirmed}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
