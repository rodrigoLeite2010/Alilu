"use client";

import { uploadPresignedResilient } from "@/lib/client/blob-upload";
import { ensureReadableFile } from "@/lib/client/file-readability";
import {
  END_MEDIA_IMAGE_CONTENT_TYPES,
  END_MEDIA_MAX_IMAGE_BYTES,
  END_MEDIA_MAX_VIDEO_BYTES,
  END_MEDIA_VIDEO_CONTENT_TYPES,
  endMediaUploadPrefix,
  isVideoSlot,
  type EndMediaSlot,
  type EndMediaSummaryDto,
} from "./end-media-config";

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === "string" && body.error ? body.error : fallback;
  } catch {
    return fallback;
  }
}

export async function fetchEndMediaSummary(): Promise<EndMediaSummaryDto | null> {
  const response = await fetch("/api/brand-end-media", { cache: "no-store" });
  if (!response.ok) return null;
  return (await response.json()) as EndMediaSummaryDto;
}

function inferType(file: File, video: boolean): string | null {
  const allowed = video ? END_MEDIA_VIDEO_CONTENT_TYPES : END_MEDIA_IMAGE_CONTENT_TYPES;
  if (allowed.includes(file.type)) return file.type;
  const name = file.name.toLowerCase();
  if (video) return name.endsWith(".mov") ? "video/quicktime" : name.endsWith(".webm") ? "video/webm" : name.endsWith(".mp4") ? "video/mp4" : null;
  return name.match(/\.jpe?g$/) ? "image/jpeg" : name.endsWith(".png") ? "image/png" : name.endsWith(".webp") ? "image/webp" : null;
}

/** Envia o arquivo direto ao Blob (prefixo do usuário) e pede ao servidor para validar e guardar no slot. */
export async function uploadEndMediaFile(userId: string, slot: EndMediaSlot, picked: File, onProgress?: (percent: number) => void): Promise<EndMediaSummaryDto> {
  const video = isVideoSlot(slot);
  const type = inferType(picked, video);
  if (!type) throw new Error(video ? "Envie um vídeo MP4, MOV ou WEBM." : "Envie uma imagem JPG, PNG ou WebP.");
  const limit = video ? END_MEDIA_MAX_VIDEO_BYTES : END_MEDIA_MAX_IMAGE_BYTES;
  if (picked.size > limit) throw new Error(`O arquivo passa do limite de ${Math.round(limit / 1024 / 1024)} MB.`);
  const readable = await ensureReadableFile(picked.type === type ? picked : new File([picked], picked.name, { type, lastModified: picked.lastModified }));
  const extension = type.split("/")[1].replace("quicktime", "mov").replace("jpeg", "jpg");
  const { result: uploaded } = await uploadPresignedResilient(`${endMediaUploadPrefix(userId)}${slot.toLowerCase()}.${extension}`, readable, {
    access: "public",
    handleUploadUrl: "/api/brand-end-media/upload",
    contentType: type,
    onUploadProgress: onProgress ? (event) => onProgress(Math.round(event.percentage)) : undefined,
  });
  const response = await fetch("/api/brand-end-media/assets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slot, url: uploaded.url }),
  });
  if (!response.ok) throw new Error(await readError(response, "Não foi possível salvar a mídia final."));
  return (await response.json()) as EndMediaSummaryDto;
}

export async function deleteEndMediaFile(slot: EndMediaSlot): Promise<EndMediaSummaryDto> {
  const response = await fetch(`/api/brand-end-media/assets?slot=${slot}`, { method: "DELETE" });
  if (!response.ok) throw new Error(await readError(response, "Não foi possível excluir a mídia final."));
  return (await response.json()) as EndMediaSummaryDto;
}

export async function saveEndMediaSettingsRequest(patch: Record<string, unknown>): Promise<EndMediaSummaryDto> {
  const response = await fetch("/api/brand-end-media", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!response.ok) throw new Error(await readError(response, "Não foi possível salvar as configurações."));
  return (await response.json()) as EndMediaSummaryDto;
}

/** Reel: emenda o encerramento no vídeo já enviado. Devolve a URL do vídeo final e o id do registro. */
export async function applyEndMediaToReel(mediaUrl: string): Promise<{ mediaUrl: string; renderId: string }> {
  const response = await fetch("/api/brand-end-media/apply-reel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mediaUrl }),
  });
  if (!response.ok) throw new Error(await readError(response, "Não foi possível adicionar o encerramento padrão."));
  return (await response.json()) as { mediaUrl: string; renderId: string };
}
