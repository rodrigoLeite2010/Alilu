import "server-only";
import { spawn } from "node:child_process";
import { put } from "@vercel/blob";
import { FacebookPublishValidationError } from "@/lib/facebook/backend/facebook-publish-errors";
import { validateFacebookReelSpecs, FACEBOOK_PHOTO_MAX_BYTES, type ReelProbe } from "@/lib/facebook/facebook-media-rules";

/**
 * Preparação de mídia para a Pages API. Reaproveita os MESMOS arquivos já
 * guardados para o Instagram (Vercel Blob, URL pública) e só cria uma
 * cópia convertida quando o Facebook não aceitaria o original.
 */

/**
 * Imagens: o Facebook aceita JPEG/PNG (e outros), recomendando < 4 MB.
 * JPEG/PNG até 4 MB seguem com a URL original (sem recompressão = sem
 * perda). Acima disso (ou formato desconhecido), gera um JPEG de alta
 * qualidade (90) com a MESMA proporção — reduzindo a resolução só se
 * ainda passar do limite — e envia uma cópia ao storage.
 */
export async function prepareFacebookImageUrl(input: { storageUrl: string; fileSizeBytes: number | null; userId: string }): Promise<string> {
  let size = input.fileSizeBytes;
  let contentType: string | null = null;
  try {
    const head = await fetch(input.storageUrl, { method: "HEAD", cache: "no-store", signal: AbortSignal.timeout(10_000) });
    if (head.ok) {
      contentType = head.headers.get("content-type");
      const length = Number(head.headers.get("content-length"));
      if (Number.isFinite(length) && length > 0) size = length;
    }
  } catch {
    // sem HEAD: segue com o que o banco sabe
  }
  const knownFormat = !contentType || /image\/(jpeg|jpg|png)/i.test(contentType);
  if (knownFormat && (size === null || size <= FACEBOOK_PHOTO_MAX_BYTES)) return input.storageUrl;

  const sharp = (await import("sharp")).default;
  const response = await fetch(input.storageUrl, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new FacebookPublishValidationError("Não foi possível ler a imagem salva para enviá-la ao Facebook.", "media");
  const original = Buffer.from(await response.arrayBuffer());
  let output = await sharp(original).rotate().jpeg({ quality: 90, mozjpeg: true }).toBuffer();
  for (const maxSide of [2560, 2048, 1440]) {
    if (output.length <= FACEBOOK_PHOTO_MAX_BYTES) break;
    output = await sharp(original).rotate().resize({ width: maxSide, height: maxSide, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 88, mozjpeg: true }).toBuffer();
  }
  if (output.length > FACEBOOK_PHOTO_MAX_BYTES) {
    throw new FacebookPublishValidationError("A imagem é grande demais para o Facebook mesmo após a conversão.", "media");
  }
  const blob = await put(`instagram-media/${input.userId}/facebook-${Date.now()}.jpg`, output, {
    access: "public",
    addRandomSuffix: true,
    contentType: "image/jpeg",
  });
  return blob.url;
}

/** ffprobe direto na URL (lê só cabeçalhos/índice). null = não foi possível medir (a Meta valida no envio). */
export async function probeRemoteVideo(url: string, timeoutMs = 15_000): Promise<ReelProbe | null> {
  let ffprobePath: string;
  try {
    ffprobePath = (await import("ffprobe-static")).path;
  } catch {
    return null;
  }
  const stdout = await new Promise<string | null>((resolve) => {
    let out = "";
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(ffprobePath, ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", url]);
    } catch {
      resolve(null);
      return;
    }
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.stdout?.on("data", (chunk: Buffer) => {
      out += chunk.toString();
    });
    child.on("error", () => {
      clearTimeout(timer);
      resolve(null);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve(code === 0 ? out : null);
    });
  });
  if (!stdout) return null;
  try {
    const parsed = JSON.parse(stdout) as {
      format?: { duration?: string; size?: string };
      streams?: Array<{ codec_type?: string; codec_name?: string; width?: number; height?: number; avg_frame_rate?: string; r_frame_rate?: string; duration?: string }>;
    };
    const video = (parsed.streams ?? []).find((stream) => stream.codec_type === "video");
    if (!video) return { width: null, height: null, durationSeconds: null, videoCodec: null, fps: null, hasVideo: false, sizeBytes: null };
    const rate = video.avg_frame_rate && video.avg_frame_rate !== "0/0" ? video.avg_frame_rate : video.r_frame_rate;
    let fps: number | null = null;
    if (rate) {
      const [num, den] = rate.split("/").map(Number);
      fps = den ? num / den : Number(num);
      if (!Number.isFinite(fps)) fps = null;
    }
    const duration = Number(parsed.format?.duration ?? video.duration ?? NaN);
    const size = Number(parsed.format?.size ?? NaN);
    return {
      width: video.width ?? null,
      height: video.height ?? null,
      durationSeconds: Number.isFinite(duration) ? duration : null,
      videoCodec: video.codec_name?.toLowerCase() ?? null,
      fps,
      hasVideo: true,
      sizeBytes: Number.isFinite(size) ? size : null,
    };
  } catch {
    return null;
  }
}

/** Valida o vídeo antes de iniciar o upload do Reel; lança erro permanente e claro quando incompatível. */
export async function assertReelCompatible(url: string, known: { width: number | null; height: number | null; durationSeconds: number | null }): Promise<void> {
  const probe = (await probeRemoteVideo(url)) ?? { ...known, videoCodec: null, fps: null, hasVideo: true, sizeBytes: null };
  const problem = validateFacebookReelSpecs(probe);
  if (problem) throw new FacebookPublishValidationError(problem, "media");
}
