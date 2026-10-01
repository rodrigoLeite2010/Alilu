import "server-only";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { path as ffprobePath } from "ffprobe-static";
import { loadImage } from "@napi-rs/canvas";

/**
 * Validação do arquivo baixado pelo CONTEÚDO (nunca pela extensão):
 * vídeo → ffprobe (stream de vídeo, codec, duração, resolução, áudio);
 * imagem → decodificação real (dimensões).
 */

export interface ProbedMedia {
  mediaType: "VIDEO" | "IMAGE";
  durationSeconds: number | null;
  width: number;
  height: number;
  videoCodec: string | null;
  hasAudio: boolean;
}

export class InvalidMediaError extends Error {
  constructor(message: string, readonly code: "INVALID_MEDIA" | "TOO_LONG") {
    super(message);
    this.name = "InvalidMediaError";
  }
}

function run(command: string, args: string[], timeoutMs = 20_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args);
    let stdout = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout);
      else reject(new Error(`ffprobe saiu com código ${code}`));
    });
  });
}

const ACCEPTED_VIDEO_CODECS = new Set(["h264", "hevc", "vp9", "av1", "mpeg4"]);

export async function probeVideoBuffer(buffer: Buffer, maxDurationSeconds: number): Promise<ProbedMedia> {
  if (buffer.length < 1024) throw new InvalidMediaError("O arquivo de vídeo está vazio ou corrompido.", "INVALID_MEDIA");
  const dir = await mkdtemp(path.join(tmpdir(), "ig-import-"));
  try {
    const file = path.join(dir, "media");
    await writeFile(file, buffer);
    let parsed: { format?: { duration?: string }; streams?: Array<{ codec_type?: string; codec_name?: string; width?: number; height?: number; duration?: string }> };
    try {
      parsed = JSON.parse(await run(ffprobePath, ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file]));
    } catch {
      throw new InvalidMediaError("O arquivo não é um vídeo válido.", "INVALID_MEDIA");
    }
    const video = (parsed.streams ?? []).find((stream) => stream.codec_type === "video");
    if (!video || !video.width || !video.height) throw new InvalidMediaError("O arquivo não tem uma trilha de vídeo válida.", "INVALID_MEDIA");
    const codec = (video.codec_name ?? "").toLowerCase();
    if (!ACCEPTED_VIDEO_CODECS.has(codec)) throw new InvalidMediaError("Codec de vídeo não suportado.", "INVALID_MEDIA");
    const duration = Number(parsed.format?.duration ?? video.duration ?? NaN);
    if (!Number.isFinite(duration) || duration <= 0) throw new InvalidMediaError("Não foi possível ler a duração do vídeo.", "INVALID_MEDIA");
    if (duration > maxDurationSeconds) {
      throw new InvalidMediaError(`O vídeo passa do limite de ${Math.round(maxDurationSeconds / 60)} minutos.`, "TOO_LONG");
    }
    return {
      mediaType: "VIDEO",
      durationSeconds: duration,
      width: Number(video.width),
      height: Number(video.height),
      videoCodec: codec,
      hasAudio: (parsed.streams ?? []).some((stream) => stream.codec_type === "audio"),
    };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function probeImageBuffer(buffer: Buffer): Promise<ProbedMedia> {
  try {
    const image = await loadImage(buffer);
    if (!image.width || !image.height) throw new Error("sem dimensões");
    return { mediaType: "IMAGE", durationSeconds: null, width: image.width, height: image.height, videoCodec: null, hasAudio: false };
  } catch {
    throw new InvalidMediaError("O arquivo não é uma imagem válida.", "INVALID_MEDIA");
  }
}
