"use client";

import { uploadPresigned } from "@vercel/blob/client";
import { buildMediaPathnamePrefix } from "@/lib/instagram/backend/media-service";
import { buildPostFileName } from "@/lib/instagram/layout-math";

/**
 * Chamadas do navegador para a API de publicações do Instagram. Nenhum
 * token passa por aqui: o navegador só conhece a sessão do Alilu (cookie
 * HttpOnly) — quem fala com a Meta é sempre o servidor.
 */

export type PublishOutcome = "PUBLISHED" | "PROCESSING" | "RETRY_SCHEDULED";

export async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === "string" && body.error ? body.error : fallback;
  } catch {
    return fallback;
  }
}

async function jsonOrThrow<T>(response: Response, fallback: string): Promise<T> {
  if (!response.ok) throw new Error(await readErrorMessage(response, fallback));
  return (await response.json()) as T;
}

/**
 * Converte qualquer imagem (PNG/WEBP/JPEG) em JPEG — o único formato de
 * imagem aceito pela Content Publishing API da Meta. Se já for JPEG,
 * devolve o próprio arquivo, sem recompressão.
 */
export async function ensureJpeg(file: Blob, quality = 0.92): Promise<Blob> {
  if (file.type === "image/jpeg") return file;
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Não foi possível ler a imagem."));
      element.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Seu navegador não conseguiu converter a imagem.");
    ctx.fillStyle = "#ffffff"; // JPEG não tem transparência
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Falha ao converter a imagem."))), "image/jpeg", quality),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Envia um arquivo direto do navegador para o storage persistente (Vercel
 * Blob, URL pública que a Meta consegue baixar no horário agendado) e
 * devolve a URL. Nunca guarda blob:/base64 para publicar depois.
 */
export async function uploadInstagramMedia(
  userId: string,
  blob: Blob,
  kind: "image" | "video",
  originalName?: string,
): Promise<string> {
  const contentType = kind === "image" ? "image/jpeg" : blob.type || "video/mp4";
  const extension = kind === "image" ? "jpg" : contentType === "video/quicktime" ? "mov" : "mp4";
  const fileName = kind === "image" ? buildPostFileName("jpg") : `video-${Date.now()}.${extension}`;
  const pathname = `${buildMediaPathnamePrefix(userId)}${fileName}`;
  const uploaded = await uploadPresigned(pathname, blob, {
    access: "public",
    handleUploadUrl: "/api/instagram/media/upload",
    clientPayload: JSON.stringify({
      originalFilename: originalName ?? fileName,
      fileSizeBytes: blob.size,
      contentType,
    }),
  });
  return uploaded.url;
}

export interface CreatePublicationBody {
  postType?: "image" | "carousel" | "reels";
  mediaUrl?: string;
  mediaUrls?: string[];
  caption: string;
  scheduledAt: string | null;
  timezone: string;
  source?: "MANUAL" | "VIRAL_POST";
  templateId?: string | null;
  templateData?: unknown;
}

export async function createPublication(body: CreatePublicationBody): Promise<string> {
  const response = await fetch("/api/instagram/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const { postId } = await jsonOrThrow<{ postId: string }>(response, "Não foi possível salvar a publicação.");
  return postId;
}

export interface UpdatePublicationBody {
  caption?: string;
  scheduledAt?: string | null;
  timezone?: string;
  mediaUrls?: string[];
  templateId?: string | null;
  templateData?: unknown;
}

export async function updatePublication(postId: string, body: UpdatePublicationBody): Promise<{ status: string }> {
  const response = await fetch(`/api/instagram/posts/${postId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "update", ...body }),
  });
  return jsonOrThrow(response, "Não foi possível salvar as alterações.");
}

export async function reschedulePublication(postId: string, scheduledAt: string | null, timezone: string) {
  const response = await fetch(`/api/instagram/posts/${postId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "reschedule", scheduledAt, timezone }),
  });
  return jsonOrThrow<{ status: string }>(response, "Não foi possível alterar o horário.");
}

export async function cancelPublication(postId: string) {
  const response = await fetch(`/api/instagram/posts/${postId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "cancel" }),
  });
  return jsonOrThrow<{ status: string }>(response, "Não foi possível cancelar o agendamento.");
}

export async function deletePublication(postId: string): Promise<void> {
  const response = await fetch(`/api/instagram/posts/${postId}`, { method: "DELETE" });
  await jsonOrThrow(response, "Não foi possível excluir a publicação.");
}

export async function publishPublicationNow(postId: string): Promise<PublishOutcome> {
  const response = await fetch(`/api/instagram/posts/${postId}/publish`, { method: "POST" });
  const { status } = await jsonOrThrow<{ status: PublishOutcome }>(response, "Não foi possível publicar no Instagram.");
  return status;
}

export function describePublishOutcome(status: PublishOutcome): string {
  if (status === "PUBLISHED") return "Publicação realizada com sucesso.";
  if (status === "PROCESSING") {
    return "O Instagram ainda está processando a mídia. A publicação será concluída automaticamente em instantes.";
  }
  return "O Instagram não respondeu agora. Uma nova tentativa automática já foi agendada.";
}

export interface AccountStatus {
  authenticated: boolean;
  userId?: string | null;
  connected: boolean;
  username: string | null;
  needsReconnect?: boolean;
}

export async function fetchAccountStatus(): Promise<AccountStatus> {
  const response = await fetch("/api/instagram/account", { cache: "no-store" });
  if (!response.ok) return { authenticated: false, connected: false, username: null, userId: null };
  return (await response.json()) as AccountStatus;
}
