"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { uploadPresigned } from "@vercel/blob/client";
import { buildMediaPathnamePrefix } from "@/lib/instagram/backend/media-service";
import { CAROUSEL_FULL_MESSAGE, CAROUSEL_MAX_ITEMS_WITH_END, type CarouselEndMediaChoice, type EndMediaSummaryDto } from "@/lib/brand-end-media/end-media-config";
import { fetchEndMediaSummary } from "@/lib/brand-end-media/end-media-client";
import { ensureReadableFile } from "@/lib/client/file-readability";

/** Converte qualquer imagem para JPEG no navegador (a Meta só aceita JPEG em carrossel). */
async function toJpeg(file: File): Promise<Blob> {
  if (file.type === "image/jpeg") return file;
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível preparar a imagem.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Não foi possível preparar a imagem."))), "image/jpeg", 0.92));
}

/**
 * "Encerramento" na criação de carrossel: [✓] Adicionar imagem padrão da
 * empresa (último slide), prévia, "Alterar somente nesta publicação" e
 * "Remover desta publicação". Nunca altera a configuração global.
 * `onChange(undefined)` = sem mídia configurada (o servidor decide).
 */
export function CarouselEndMediaOption({
  userId,
  itemCount,
  disabled,
  onChange,
}: {
  userId: string;
  itemCount: number;
  disabled?: boolean;
  onChange: (choice: CarouselEndMediaChoice | undefined) => void;
}) {
  const [summary, setSummary] = useState<EndMediaSummaryDto | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [override, setOverride] = useState<{ url: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchEndMediaSummary()
      .then((loaded) => {
        if (cancelled || !loaded) return;
        setSummary(loaded);
        setEnabled(Boolean(loaded.assets.CAROUSEL_IMAGE) && loaded.settings.carouselEnabled);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const asset = summary?.assets.CAROUSEL_IMAGE;
  useEffect(() => {
    if (!summary) return;
    if (!asset && !override) onChange(undefined);
    else if (!enabled) onChange({ mode: "none" });
    else if (override) onChange({ mode: "override", mediaUrl: override.url });
    else onChange({ mode: "default" });
  }, [summary, asset, enabled, override, onChange]);

  async function pickOverride(file: File) {
    setError(null);
    setUploading(true);
    try {
      const readable = await ensureReadableFile(file);
      const jpeg = await toJpeg(readable);
      const fileName = `encerramento-${Date.now()}.jpg`;
      const uploaded = await uploadPresigned(`${buildMediaPathnamePrefix(userId)}${fileName}`, jpeg, {
        access: "public",
        handleUploadUrl: "/api/instagram/media/upload",
        clientPayload: JSON.stringify({ originalFilename: fileName, fileSizeBytes: jpeg.size, contentType: "image/jpeg" }),
      });
      setOverride({ url: uploaded.url });
      setEnabled(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar a imagem.");
    } finally {
      setUploading(false);
    }
  }

  if (!summary) return null;
  const previewUrl = override?.url ?? asset?.url ?? null;
  const full = enabled && itemCount >= CAROUSEL_MAX_ITEMS_WITH_END;

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-3 text-sm" data-testid="carousel-end-media">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Encerramento</p>
      {!asset && !override ? (
        <p className="mt-1 text-xs text-zinc-600">
          Mídia final padrão não configurada.{" "}
          <Link href="/minha-conta/midia-final" className="font-medium text-teal-700 underline">
            Configurar
          </Link>
        </p>
      ) : (
        <>
          <label className="mt-1 flex items-center gap-2 font-medium text-zinc-900">
            <input type="checkbox" className="h-4 w-4" checked={enabled} disabled={disabled || uploading} onChange={(event) => setEnabled(event.target.checked)} />
            Adicionar imagem padrão da empresa no final
          </label>
          {enabled && previewUrl ? (
            <div className="mt-2 flex items-start gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="Imagem final" className="h-24 w-auto rounded border border-zinc-200 object-contain" />
              <div className="flex flex-col gap-1 text-xs">
                <span className="text-zinc-600">{override ? "Imagem final só desta publicação" : "Imagem final padrão"} · entra como slide {Math.min(itemCount + 1, CAROUSEL_MAX_ITEMS_WITH_END)}</span>
                <label className={`cursor-pointer font-medium text-teal-700 underline ${disabled || uploading ? "pointer-events-none opacity-60" : ""}`}>
                  {uploading ? "Enviando…" : "Alterar somente nesta publicação"}
                  <input
                    type="file"
                    className="sr-only"
                    accept="image/jpeg,image/png,image/webp"
                    onClick={(event) => {
                      event.currentTarget.value = "";
                    }}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void pickOverride(file);
                    }}
                  />
                </label>
                {override ? (
                  <button type="button" className="text-left font-medium text-zinc-600 underline" disabled={disabled} onClick={() => setOverride(null)}>
                    Voltar para a imagem padrão
                  </button>
                ) : null}
                <button type="button" className="text-left font-medium text-zinc-600 underline" disabled={disabled} onClick={() => setEnabled(false)}>
                  Remover desta publicação
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
      {full ? <p role="alert" className="mt-2 text-xs text-red-700">{CAROUSEL_FULL_MESSAGE}</p> : null}
      {error ? <p role="alert" className="mt-2 text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
