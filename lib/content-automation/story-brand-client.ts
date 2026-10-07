"use client";

import { uploadPresignedResilient } from "@/lib/client/blob-upload";
import { ensureReadableFile } from "@/lib/client/file-readability";
import {
  STORY_BRAND_CONTENT_TYPES,
  STORY_BRAND_MAX_UPLOAD_BYTES,
  storyBrandUploadPrefix,
  type StoryBrandProfileDto,
} from "./smart-story/brand";

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === "string" && body.error ? body.error : fallback;
  } catch {
    return fallback;
  }
}

function inferType(file: File): string | null {
  if (STORY_BRAND_CONTENT_TYPES.includes(file.type)) return file.type;
  const name = file.name.toLowerCase();
  return name.match(/\.jpe?g$/) ? "image/jpeg" : name.endsWith(".png") ? "image/png" : name.endsWith(".webp") ? "image/webp" : null;
}

export async function saveStoryBrandTextsRequest(texts: Record<string, string>): Promise<StoryBrandProfileDto> {
  const response = await fetch("/api/smart-story/brand", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(texts),
  });
  if (!response.ok) throw new Error(await readError(response, "Não foi possível salvar a identidade."));
  return (await response.json()) as StoryBrandProfileDto;
}

export async function uploadStoryBrandImage(userId: string, slot: "LOGO" | "MASCOT", picked: File): Promise<StoryBrandProfileDto> {
  const type = inferType(picked);
  if (!type) throw new Error("Envie uma imagem PNG, JPG ou WebP.");
  if (picked.size > STORY_BRAND_MAX_UPLOAD_BYTES) throw new Error("A imagem passa do limite de 5 MB.");
  const readable = await ensureReadableFile(picked.type === type ? picked : new File([picked], picked.name, { type, lastModified: picked.lastModified }));
  const extension = type.split("/")[1].replace("jpeg", "jpg");
  const { result: uploaded } = await uploadPresignedResilient(`${storyBrandUploadPrefix(userId)}${slot.toLowerCase()}-upload.${extension}`, readable, {
    access: "public",
    handleUploadUrl: "/api/smart-story/brand/upload",
    contentType: type,
  });
  const response = await fetch("/api/smart-story/brand/assets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slot, url: uploaded.url }),
  });
  if (!response.ok) throw new Error(await readError(response, "Não foi possível salvar a imagem."));
  return (await response.json()) as StoryBrandProfileDto;
}

export async function removeStoryBrandImage(slot: "LOGO" | "MASCOT"): Promise<StoryBrandProfileDto> {
  const response = await fetch(`/api/smart-story/brand/assets?slot=${slot}`, { method: "DELETE" });
  if (!response.ok) throw new Error(await readError(response, "Não foi possível remover a imagem."));
  return (await response.json()) as StoryBrandProfileDto;
}
