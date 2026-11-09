import "server-only";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { del as deleteBlob, put } from "@vercel/blob";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import {
  getInstagramAccountByIdForUser,
  getInstagramAccountForUser,
  listInstagramAccountsForUser,
} from "@/lib/instagram/backend/instagram-account-repository";
import { downloadToFile, probeVideoFile, readFile, withWorkDir } from "@/lib/brand-end-media/backend/end-media-processing";
import {
  SPLIT_BOTTOM_MAX_IMAGE_BYTES,
  SPLIT_BOTTOM_MAX_VIDEO_BYTES,
  SPLIT_BOTTOM_MAX_VIDEO_SECONDS,
  splitBottomUploadPrefix,
  type SplitBottomMediaDto,
  type SplitBottomSummaryDto,
} from "./split-bottom-config";
import {
  deleteSplitBottomMedia,
  getSplitBottomMedia,
  listSplitBottomMedia,
  upsertSplitBottomMedia,
  type SplitBottomMediaRecord,
} from "./split-bottom-repository";

export class SplitBottomValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SplitBottomValidationError";
  }
}

function toDto(media: SplitBottomMediaRecord): SplitBottomMediaDto {
  return {
    kind: media.kind,
    url: media.storageUrl,
    contentType: media.contentType,
    fileSizeBytes: media.fileSizeBytes,
    width: media.width,
    height: media.height,
    durationSeconds: media.durationSeconds,
    hasAudio: media.hasAudio,
  };
}

/** Todas as contas do usuário, cada uma com a sua mídia fixa (ou null). */
export async function getSplitBottomSummary(userId: string): Promise<SplitBottomSummaryDto> {
  const [accounts, media, primary] = await Promise.all([
    listInstagramAccountsForUser(userId),
    listSplitBottomMedia(userId),
    getInstagramAccountForUser(userId),
  ]);
  const byAccount = new Map(media.map((item) => [item.instagramAccountId, item]));
  return {
    accounts: accounts
      .filter((account) => account.status === "connected" || byAccount.has(account.id))
      .map((account) => {
        const item = byAccount.get(account.id);
        return {
          instagramAccountId: account.id,
          username: account.igUsername,
          connected: account.status === "connected",
          primary: primary?.id === account.id,
          media: item ? toDto(item) : null,
        };
      })
      .sort((a, b) => Number(b.primary) - Number(a.primary)),
  };
}

function storageKeyFromUrl(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
  } catch {
    return "";
  }
}

function assertOwnUpload(userId: string, url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new SplitBottomValidationError("Arquivo inválido.");
  }
  const key = storageKeyFromUrl(url);
  if (
    parsed.protocol !== "https:" ||
    !parsed.hostname.endsWith(".blob.vercel-storage.com") ||
    !key.startsWith(splitBottomUploadPrefix(userId)) ||
    key.includes("..")
  ) {
    throw new SplitBottomValidationError("Arquivo inválido.");
  }
  return key;
}

async function requireOwnAccount(userId: string, accountId: unknown) {
  const id = typeof accountId === "string" ? accountId : "";
  const account = id && /^[0-9a-f-]{36}$/i.test(id) ? await getInstagramAccountByIdForUser(id, userId) : null;
  if (!account) throw new SplitBottomValidationError("Conta do Instagram não encontrada.");
  return account;
}

function looksLikeVideo(key: string): boolean {
  return /\.(mp4|mov|webm)$/i.test(key);
}

/**
 * Recebe o arquivo já enviado ao Blob (prefixo do próprio usuário), valida
 * PELO CONTEÚDO (ffprobe ou decodificação da imagem), converte imagem para
 * JPEG e grava como mídia fixa da conta escolhida.
 */
export async function saveSplitBottomMedia(
  userId: string,
  input: { instagramAccountId?: unknown; url?: unknown },
): Promise<SplitBottomSummaryDto> {
  const account = await requireOwnAccount(userId, input.instagramAccountId);
  const url = typeof input.url === "string" ? input.url : "";
  const uploadedKey = assertOwnUpload(userId, url);
  const video = looksLikeVideo(uploadedKey);

  const record = await withWorkDir(async (dir) => {
    const localPath = path.join(dir, "upload");
    await downloadToFile(url, localPath, video ? SPLIT_BOTTOM_MAX_VIDEO_BYTES : SPLIT_BOTTOM_MAX_IMAGE_BYTES);
    const buffer = await readFile(localPath);
    if (video) {
      if (buffer.byteLength > SPLIT_BOTTOM_MAX_VIDEO_BYTES) throw new SplitBottomValidationError("O vídeo passa do limite de 100 MB.");
      let probed;
      try {
        probed = await probeVideoFile(localPath);
      } catch {
        throw new SplitBottomValidationError("O arquivo não é um vídeo válido (use MP4, MOV ou WEBM).");
      }
      if (probed.durationSeconds > SPLIT_BOTTOM_MAX_VIDEO_SECONDS + 0.5) {
        throw new SplitBottomValidationError(`O vídeo pode ter no máximo ${SPLIT_BOTTOM_MAX_VIDEO_SECONDS} segundos.`);
      }
      const lower = uploadedKey.toLowerCase();
      return {
        kind: "VIDEO" as const,
        storageUrl: url,
        storageKey: uploadedKey,
        contentType: lower.endsWith(".mov") ? "video/quicktime" : lower.endsWith(".webm") ? "video/webm" : "video/mp4",
        fileSizeBytes: buffer.byteLength,
        width: probed.width,
        height: probed.height,
        durationSeconds: Math.round(probed.durationSeconds * 100) / 100,
        hasAudio: probed.hasAudio,
      };
    }
    if (buffer.byteLength > SPLIT_BOTTOM_MAX_IMAGE_BYTES) throw new SplitBottomValidationError("A imagem passa do limite de 15 MB.");
    let image;
    try {
      image = await loadImage(buffer);
    } catch {
      throw new SplitBottomValidationError("O arquivo não é uma imagem válida (use JPG, PNG ou WebP).");
    }
    if (!image.width || !image.height) throw new SplitBottomValidationError("O arquivo não é uma imagem válida.");
    // Sempre JPEG com fundo branco (PNG/WebP transparentes) — o FFmpeg lê sem surpresas.
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, image.width, image.height);
    ctx.drawImage(image, 0, 0);
    const jpeg = canvas.toBuffer("image/jpeg", 92);
    const blob = await put(`${splitBottomUploadPrefix(userId)}${account.id}-${randomUUID()}.jpg`, jpeg, {
      access: "public",
      contentType: "image/jpeg",
      addRandomSuffix: false,
    });
    await deleteBlob(url).catch(() => undefined);
    return {
      kind: "IMAGE" as const,
      storageUrl: blob.url,
      storageKey: storageKeyFromUrl(blob.url),
      contentType: "image/jpeg",
      fileSizeBytes: jpeg.byteLength,
      width: image.width,
      height: image.height,
      durationSeconds: null,
      hasAudio: false,
    };
  });

  const { media, previous } = await upsertSplitBottomMedia({ userId, instagramAccountId: account.id, ...record });
  if (previous && previous.storageUrl !== media.storageUrl) await deleteBlob(previous.storageUrl).catch(() => undefined);
  return getSplitBottomSummary(userId);
}

export async function removeSplitBottomMedia(userId: string, instagramAccountId: unknown): Promise<SplitBottomSummaryDto> {
  const account = await requireOwnAccount(userId, instagramAccountId);
  const removed = await deleteSplitBottomMedia(userId, account.id);
  if (removed) await deleteBlob(removed.storageUrl).catch(() => undefined);
  return getSplitBottomSummary(userId);
}

/** Usada pelo processamento: a mídia fixa da conta, só se for do próprio usuário. */
export async function resolveSplitBottomMediaForUser(userId: string, instagramAccountId: string): Promise<SplitBottomMediaRecord | null> {
  return getSplitBottomMedia(userId, instagramAccountId);
}
