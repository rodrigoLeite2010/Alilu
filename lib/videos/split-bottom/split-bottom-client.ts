"use client";

import { uploadPresignedResilient } from "@/lib/client/blob-upload";
import { ensureReadableFile } from "@/lib/client/file-readability";
import {
  SPLIT_BOTTOM_IMAGE_CONTENT_TYPES,
  SPLIT_BOTTOM_MAX_IMAGE_BYTES,
  SPLIT_BOTTOM_MAX_VIDEO_BYTES,
  SPLIT_BOTTOM_VIDEO_CONTENT_TYPES,
  splitBottomUploadPrefix,
  type SplitBottomSummaryDto,
} from "./split-bottom-config";

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === "string" && body.error ? body.error : fallback;
  } catch {
    return fallback;
  }
}

export async function fetchSplitBottomSummary(): Promise<SplitBottomSummaryDto> {
  const response = await fetch("/api/videos/split-bottom-media", { cache: "no-store" });
  if (!response.ok) return { accounts: [] };
  return (await response.json()) as SplitBottomSummaryDto;
}

function inferType(file: File): string | null {
  if ([...SPLIT_BOTTOM_VIDEO_CONTENT_TYPES, ...SPLIT_BOTTOM_IMAGE_CONTENT_TYPES].includes(file.type)) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith(".mov")) return "video/quicktime";
  if (name.endsWith(".webm")) return "video/webm";
  if (name.endsWith(".mp4")) return "video/mp4";
  if (/\.jpe?g$/.test(name)) return "image/jpeg";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  return null;
}

/** Envia o arquivo direto ao Blob e pede ao servidor para validar e guardar como mídia fixa da conta. */
export async function uploadSplitBottomFile(userId: string, instagramAccountId: string, picked: File): Promise<SplitBottomSummaryDto> {
  const type = inferType(picked);
  if (!type) throw new Error("Envie um vídeo (MP4, MOV, WEBM) ou uma imagem (JPG, PNG, WebP).");
  const video = type.startsWith("video/");
  const limit = video ? SPLIT_BOTTOM_MAX_VIDEO_BYTES : SPLIT_BOTTOM_MAX_IMAGE_BYTES;
  if (picked.size > limit) throw new Error(`O arquivo passa do limite de ${Math.round(limit / 1024 / 1024)} MB.`);
  const readable = await ensureReadableFile(picked.type === type ? picked : new File([picked], picked.name, { type, lastModified: picked.lastModified }));
  const extension = type.split("/")[1].replace("quicktime", "mov").replace("jpeg", "jpg");
  const { result: uploaded } = await uploadPresignedResilient(`${splitBottomUploadPrefix(userId)}${instagramAccountId}.${extension}`, readable, {
    access: "public",
    handleUploadUrl: "/api/brand-end-media/upload",
    contentType: type,
  });
  const response = await fetch("/api/videos/split-bottom-media", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ instagramAccountId, url: uploaded.url }),
  });
  if (!response.ok) throw new Error(await readError(response, "Não foi possível salvar a mídia."));
  return (await response.json()) as SplitBottomSummaryDto;
}

export async function deleteSplitBottomFile(instagramAccountId: string): Promise<SplitBottomSummaryDto> {
  const response = await fetch(`/api/videos/split-bottom-media?instagramAccountId=${encodeURIComponent(instagramAccountId)}`, { method: "DELETE" });
  if (!response.ok) throw new Error(await readError(response, "Não foi possível excluir a mídia."));
  return (await response.json()) as SplitBottomSummaryDto;
}
