import "server-only";
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { finished } from "node:stream/promises";
import ffmpegPath from "ffmpeg-static";
import { path as ffprobePath } from "ffprobe-static";

/** Execução do FFmpeg/ffprobe para o encerramento padrão (com limite de tempo — nunca trava a função). */

export class EndMediaProcessingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EndMediaProcessingError";
  }
}

export function runTool(command: string, args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args);
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new EndMediaProcessingError("O processamento do encerramento demorou demais."));
    }, timeoutMs);
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout);
      else reject(new EndMediaProcessingError(`ffmpeg saiu com código ${code}: ${stderr.slice(-800)}`));
    });
  });
}

export function requireFfmpeg(): string {
  if (!ffmpegPath) throw new EndMediaProcessingError("Binário do FFmpeg não encontrado neste ambiente.");
  return ffmpegPath;
}

export interface ProbedVideo {
  durationSeconds: number;
  width: number;
  height: number;
  codec: string;
  fps: number | null;
  hasAudio: boolean;
}

function parseFps(value: string | undefined): number | null {
  if (!value) return null;
  const [num, den] = value.split("/").map(Number);
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null;
  const fps = num / den;
  return Number.isFinite(fps) && fps > 0 ? Math.round(fps * 100) / 100 : null;
}

export async function probeVideoFile(filePath: string): Promise<ProbedVideo> {
  let parsed: {
    format?: { duration?: string };
    streams?: Array<{ codec_type?: string; codec_name?: string; width?: number; height?: number; avg_frame_rate?: string; r_frame_rate?: string; duration?: string }>;
  };
  try {
    parsed = JSON.parse(await runTool(ffprobePath, ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", filePath], 20_000));
  } catch {
    throw new EndMediaProcessingError("O arquivo não é um vídeo válido.");
  }
  const video = (parsed.streams ?? []).find((stream) => stream.codec_type === "video");
  if (!video?.width || !video.height) throw new EndMediaProcessingError("O arquivo não tem uma trilha de vídeo válida.");
  const durationSeconds = Number(parsed.format?.duration ?? video.duration ?? NaN);
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) throw new EndMediaProcessingError("Não foi possível ler a duração do vídeo.");
  return {
    durationSeconds,
    width: Number(video.width),
    height: Number(video.height),
    codec: (video.codec_name ?? "").toLowerCase(),
    fps: parseFps(video.avg_frame_rate) ?? parseFps(video.r_frame_rate),
    hasAudio: (parsed.streams ?? []).some((stream) => stream.codec_type === "audio"),
  };
}

export async function downloadToFile(url: string, destination: string, maxBytes = 300 * 1024 * 1024): Promise<void> {
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new EndMediaProcessingError(`Falha ao baixar o arquivo (status ${response.status}).`);
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new EndMediaProcessingError("Arquivo grande demais.");
  const stream = Readable.fromWeb(response.body as unknown as Parameters<typeof Readable.fromWeb>[0]);
  const file = createWriteStream(destination);
  stream.pipe(file);
  await finished(file);
}

/** Pasta temporária com limpeza garantida. */
export async function withWorkDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(tmpdir(), "alilu-end-media-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export { readFile };
