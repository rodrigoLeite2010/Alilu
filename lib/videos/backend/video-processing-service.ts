import "server-only";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { finished } from "node:stream/promises";
import { del as deleteBlob, put } from "@vercel/blob";
import ffmpegPath from "ffmpeg-static";
import { path as ffprobePath } from "ffprobe-static";
import { MAX_OUTPUT_DURATION_SECONDS, VIDEO_OUTPUT_PATH_PREFIX } from "../config";
import { buildSplitScreenFfmpegArgs, computeOutputDurationSeconds } from "../split-screen-ffmpeg";
import type { SplitScreenRequestBody } from "../validation";

/**
 * Orquestração do processamento de vídeo split-screen (Fase A): baixa os
 * dois vídeos de entrada do Vercel Blob para /tmp (único diretório
 * gravável em Vercel Functions), mede a duração REAL de cada um via
 * ffprobe, monta os argumentos do FFmpeg (lib/videos/split-screen-ffmpeg.ts,
 * função pura) e roda o binário via `spawn` com um array de argumentos
 * (nunca `exec` com string interpolada, mesmo os valores já validados —
 * não abre brecha nenhuma de shell injection). Sempre limpa: os dois
 * blobs de ENTRADA são apagados no final (sucesso ou erro, `finally`), e
 * os arquivos temporários locais também (`finally`). O blob de SAÍDA não é
 * apagado aqui — ver VIDEO_OUTPUT_PATH_PREFIX em lib/videos/config.ts.
 */

export class VideoProcessingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VideoProcessingValidationError";
  }
}

export class VideoProcessingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VideoProcessingError";
  }
}

interface ProbedMediaInfo {
  durationSeconds: number;
  hasAudio: boolean;
}

function logStructuredError(event: string, details: Record<string, unknown>): void {
  console.error(JSON.stringify({ scope: "videos", event, ...details }));
}

/**
 * Log de tempo por etapa — adicionado depois de um timeout real em
 * produção ("Task timed out after 60 seconds") sem nenhuma pista de qual
 * etapa (download, probe, encode ou upload) consumiu o orçamento de 60s
 * da function. Sem isso, calibrar MAX_OUTPUT_DURATION_SECONDS de novo
 * seria só chute — com isso, os logs da Vercel mostram exatamente onde o
 * tempo foi gasto (mesmo que a function seja morta no meio, os logs já
 * emitidos até ali permanecem).
 */
function logStructuredTiming(event: string, startedAtMs: number, details: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ scope: "videos", event, durationMs: Date.now() - startedAtMs, ...details }));
}

async function downloadToFile(url: string, destinationPath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new VideoProcessingError(`Falha ao baixar vídeo de entrada (status ${response.status}).`);
  }
  const nodeStream = Readable.fromWeb(response.body as unknown as Parameters<typeof Readable.fromWeb>[0]);
  const fileStream = createWriteStream(destinationPath);
  nodeStream.pipe(fileStream);
  await finished(fileStream);
}

function runProcess(command: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`"${command}" saiu com código ${code}: ${stderr.slice(-2000)}`));
      }
    });
  });
}

interface FfprobeStream {
  codec_type?: string;
}
interface FfprobeOutput {
  format?: { duration?: string };
  streams?: FfprobeStream[];
}

async function probeMedia(filePath: string): Promise<ProbedMediaInfo> {
  const { stdout } = await runProcess(ffprobePath, [
    "-v",
    "error",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    filePath,
  ]);

  let parsed: FfprobeOutput;
  try {
    parsed = JSON.parse(stdout) as FfprobeOutput;
  } catch {
    throw new VideoProcessingError("Não foi possível ler os metadados de um dos vídeos enviados.");
  }

  const durationRaw = parsed.format?.duration;
  const durationSeconds = durationRaw ? Number(durationRaw) : NaN;
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new VideoProcessingValidationError("Não foi possível determinar a duração real de um dos vídeos enviados.");
  }

  const hasAudio = (parsed.streams ?? []).some((stream) => stream.codec_type === "audio");

  return { durationSeconds, hasAudio };
}

/** Tolerância (segundos) entre o fim do corte pedido e a duração real medida — evita rejeitar um corte "até o fim" por causa de arredondamento de metadados. */
const TRIM_DURATION_TOLERANCE_SECONDS = 0.5;

export interface ProcessSplitScreenVideoResult {
  url: string;
}

export async function processSplitScreenVideo(request: SplitScreenRequestBody): Promise<ProcessSplitScreenVideoResult> {
  if (!ffmpegPath) {
    throw new VideoProcessingError("Binário do FFmpeg não encontrado neste ambiente.");
  }

  const workDir = await mkdtemp(path.join(tmpdir(), "alilu-videos-"));
  const primaryInputPath = path.join(workDir, "primary-input");
  const secondaryInputPath = path.join(workDir, "secondary-input");
  const outputPath = path.join(workDir, `${randomUUID()}.mp4`);
  const inputBlobUrls = [request.primaryBlobUrl, request.secondaryBlobUrl];

  try {
    try {
      const downloadStartedAt = Date.now();
      await Promise.all([
        downloadToFile(request.primaryBlobUrl, primaryInputPath),
        downloadToFile(request.secondaryBlobUrl, secondaryInputPath),
      ]);
      logStructuredTiming("split-screen.download-done", downloadStartedAt);

      const probeStartedAt = Date.now();
      const [primaryInfo, secondaryInfo] = await Promise.all([
        probeMedia(primaryInputPath),
        probeMedia(secondaryInputPath),
      ]);
      logStructuredTiming("split-screen.probe-done", probeStartedAt);

      if (request.primaryTrim.endSeconds > primaryInfo.durationSeconds + TRIM_DURATION_TOLERANCE_SECONDS) {
        throw new VideoProcessingValidationError("O corte do vídeo principal vai além da duração real do arquivo enviado.");
      }
      if (request.secondaryTrim.endSeconds > secondaryInfo.durationSeconds + TRIM_DURATION_TOLERANCE_SECONDS) {
        throw new VideoProcessingValidationError("O corte do vídeo complementar vai além da duração real do arquivo enviado.");
      }

      const outputDuration = computeOutputDurationSeconds(request.primaryTrim, request.secondaryTrim, request.durationMode);
      if (outputDuration > MAX_OUTPUT_DURATION_SECONDS) {
        throw new VideoProcessingValidationError(
          `O resultado ficaria com ${Math.round(outputDuration)}s — o limite desta ferramenta é ${MAX_OUTPUT_DURATION_SECONDS}s.`,
        );
      }

      const args = buildSplitScreenFfmpegArgs({
        primaryInputPath,
        secondaryInputPath,
        outputPath,
        outputFormat: request.outputFormat,
        layoutRatio: request.layoutRatio,
        primaryTrim: request.primaryTrim,
        secondaryTrim: request.secondaryTrim,
        primaryFraming: request.primaryFraming,
        secondaryFraming: request.secondaryFraming,
        durationMode: request.durationMode,
        audio: request.audio,
        primaryHasAudio: primaryInfo.hasAudio,
        secondaryHasAudio: secondaryInfo.hasAudio,
      });

      const ffmpegStartedAt = Date.now();
      try {
        await runProcess(ffmpegPath, args);
      } catch (error) {
        logStructuredError("split-screen.ffmpeg-failed", {
          message: error instanceof Error ? error.message : String(error),
        });
        throw new VideoProcessingError("Não foi possível gerar o vídeo.");
      }
      logStructuredTiming("split-screen.ffmpeg-done", ffmpegStartedAt, { outputDurationSeconds: outputDuration });

      const uploadStartedAt = Date.now();
      const outputBuffer = await readFile(outputPath);
      const blob = await put(`${VIDEO_OUTPUT_PATH_PREFIX}${randomUUID()}.mp4`, outputBuffer, {
        access: "public",
        contentType: "video/mp4",
        addRandomSuffix: false,
      });
      logStructuredTiming("split-screen.upload-done", uploadStartedAt, { bytes: outputBuffer.byteLength });

      return { url: blob.url };
    } finally {
      // Apaga os dois blobs de ENTRADA sempre — sucesso ou erro no meio do
      // processamento (try/finally). O blob de SAÍDA nunca é apagado aqui.
      await Promise.all(
        inputBlobUrls.map((url) =>
          deleteBlob(url).catch((error) => {
            logStructuredError("split-screen.input-blob-delete-failed", {
              url,
              message: error instanceof Error ? error.message : String(error),
            });
          }),
        ),
      );
    }
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch((error: unknown) => {
      logStructuredError("split-screen.tmp-cleanup-failed", {
        message: error instanceof Error ? error.message : String(error),
      });
    });
  }
}
