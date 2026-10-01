import "server-only";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import ffmpegStatic from "ffmpeg-static";
import { path as ffprobeStatic } from "ffprobe-static";
import { createCanvas, GlobalFonts, loadImage, type SKRSContext2D } from "@napi-rs/canvas";
import type { AiVideoOverlay } from "../overlays";

/**
 * Pós-processamento do vídeo gerado pela IA — SEPARADO do provedor:
 *
 *   provedor de IA (só movimento) → validar MP4 (ffprobe) →
 *   overlays fixos (canvas + FFmpeg) → storage
 *
 * Cada overlay vira uma camada PNG do tamanho do quadro, desenhada aqui
 * com fontes EMBUTIDAS (./fonts, DejaVu — licença em LICENSE-DejaVu.txt),
 * e é sobreposta pelo filtro `overlay` do FFmpeg, com janela de tempo
 * (`enable=between(t,…)`). O texto final é exatamente o digitado — a IA
 * nunca desenha letra nenhuma.
 *
 * Os binários vêm de ffmpeg-static/ffprobe-static (os mesmos do editor
 * split-screen; ver next.config.ts → outputFileTracingIncludes).
 */

export class VideoOutputInvalidError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = "VideoOutputInvalidError";
  }
}

export class VideoPostProcessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VideoPostProcessError";
  }
}

const FFMPEG_TIMEOUT_MS = 45_000;
const FONT_FAMILY: Record<AiVideoOverlay["fontFamily"], string> = { sans: "Alilu Overlay Sans", serif: "Alilu Overlay Serif" };
const FONT_FILES: Array<[string, string]> = [
  ["DejaVuSans.ttf", FONT_FAMILY.sans],
  ["DejaVuSans-Bold.ttf", FONT_FAMILY.sans],
  ["DejaVuSerif.ttf", FONT_FAMILY.serif],
  ["DejaVuSerif-Bold.ttf", FONT_FAMILY.serif],
];

let fontsRegistered = false;
function ensureFontsRegistered(): void {
  if (fontsRegistered) return;
  fontsRegistered = true;
  for (const [file, family] of FONT_FILES) {
    const fontPath = path.join(process.cwd(), "lib/ai-video/backend/fonts", file);
    if (!GlobalFonts.registerFromPath(fontPath, family)) {
      console.error("[ai-video] falha ao registrar fonte do overlay", { fontPath });
    }
  }
}

function ffmpegPath(): string {
  if (!ffmpegStatic) throw new VideoPostProcessError("FFmpeg indisponível neste ambiente.");
  return ffmpegStatic;
}

function runProcess(command: string, args: string[], timeoutMs = FFMPEG_TIMEOUT_MS): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args);
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new VideoPostProcessError("Tempo esgotado no processamento do vídeo."));
    }, timeoutMs);
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
      if (stderr.length > 20_000) stderr = stderr.slice(-10_000);
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new VideoPostProcessError(`Processo saiu com código ${code}: ${stderr.slice(-500)}`));
    });
  });
}

// ---------------------------------------------------------------------------
// Validação do MP4 (resultado inválido → devolução automática).
// ---------------------------------------------------------------------------

export interface VideoProbe {
  hasVideo: boolean;
  width: number;
  height: number;
  durationSeconds: number;
  sizeBytes: number;
}

export async function probeVideoFile(filePath: string): Promise<VideoProbe> {
  const sizeBytes = (await stat(filePath)).size;
  if (sizeBytes === 0) return { hasVideo: false, width: 0, height: 0, durationSeconds: 0, sizeBytes };
  let parsed: { format?: { duration?: string }; streams?: Array<{ codec_type?: string; width?: number; height?: number; duration?: string }> };
  try {
    const { stdout } = await runProcess(ffprobeStatic, ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", filePath], 20_000);
    parsed = JSON.parse(stdout);
  } catch {
    return { hasVideo: false, width: 0, height: 0, durationSeconds: 0, sizeBytes };
  }
  const video = (parsed.streams ?? []).find((stream) => stream.codec_type === "video");
  const duration = Number(parsed.format?.duration ?? video?.duration ?? NaN);
  return {
    hasVideo: Boolean(video),
    width: Number(video?.width ?? 0),
    height: Number(video?.height ?? 0),
    durationSeconds: Number.isFinite(duration) ? duration : 0,
    sizeBytes,
  };
}

/** Motivo pelo qual o MP4 é inutilizável, ou null se está ok. */
export function invalidVideoReason(probe: VideoProbe): string | null {
  if (probe.sizeBytes < 1024) return "EMPTY_FILE";
  if (!probe.hasVideo || probe.width < 16 || probe.height < 16) return "NO_VIDEO_STREAM";
  if (probe.durationSeconds < 0.5) return "NO_DURATION";
  return null;
}

// ---------------------------------------------------------------------------
// Camadas de overlay (canvas).
// ---------------------------------------------------------------------------

function hexToRgba(hex: string): string {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  const a = value.length === 8 ? parseInt(value.slice(6, 8), 16) / 255 : 1;
  return `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
}

function roundRect(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** Quebra o texto em linhas que cabem em `maxWidth` (palavras longas demais forçam fonte menor). */
function wrapLines(ctx: SKRSContext2D, text: string, maxWidth: number): string[] | null {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (ctx.measureText(word).width > maxWidth) return null;
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) current = candidate;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export interface TextLayout {
  fontPx: number;
  lines: string[];
  lineHeight: number;
}

/** Maior fonte (≤ fontSize) em que o texto inteiro cabe na caixa — nunca corta letra. */
export function layoutOverlayText(ctx: SKRSContext2D, overlay: AiVideoOverlay, frameHeight: number, boxW: number, boxH: number): TextLayout {
  ensureFontsRegistered();
  const padding = Math.round(Math.min(boxW, boxH) * 0.12);
  let fontPx = Math.max(8, Math.round(overlay.fontSize * frameHeight));
  for (; fontPx >= 8; fontPx -= 1) {
    ctx.font = `${overlay.fontWeight === "bold" ? "bold " : ""}${fontPx}px "${FONT_FAMILY[overlay.fontFamily]}"`;
    const lines = wrapLines(ctx, overlay.text ?? "", boxW - padding * 2);
    const lineHeight = Math.round(fontPx * 1.2);
    if (lines && lines.length * lineHeight <= boxH - padding * 2 + 1) return { fontPx, lines, lineHeight };
  }
  ctx.font = `${overlay.fontWeight === "bold" ? "bold " : ""}8px "${FONT_FAMILY[overlay.fontFamily]}"`;
  return { fontPx: 8, lines: [overlay.text ?? ""], lineHeight: 10 };
}

/** Uma camada PNG transparente do tamanho do quadro com UM overlay desenhado. */
export async function renderOverlayLayer(
  overlay: AiVideoOverlay,
  frameWidth: number,
  frameHeight: number,
  imageBuffer: Buffer | null,
): Promise<Buffer> {
  ensureFontsRegistered();
  const canvas = createCanvas(frameWidth, frameHeight);
  const ctx = canvas.getContext("2d");
  const boxX = Math.round(overlay.x * frameWidth);
  const boxY = Math.round(overlay.y * frameHeight);
  const boxW = Math.round(overlay.width * frameWidth);
  const boxH = Math.round(overlay.height * frameHeight);
  ctx.globalAlpha = overlay.opacity;

  if (overlay.type === "LOGO" || overlay.type === "IMAGE") {
    if (!imageBuffer) throw new VideoPostProcessError("Imagem do overlay indisponível.");
    const image = await loadImage(imageBuffer);
    const scale = Math.min(boxW / image.width, boxH / image.height);
    const drawW = Math.round(image.width * scale);
    const drawH = Math.round(image.height * scale);
    const drawX = overlay.textAlign === "left" ? boxX : overlay.textAlign === "right" ? boxX + boxW - drawW : boxX + Math.round((boxW - drawW) / 2);
    const drawY = boxY + Math.round((boxH - drawH) / 2);
    ctx.drawImage(image, drawX, drawY, drawW, drawH);
    return canvas.toBuffer("image/png");
  }

  const layout = layoutOverlayText(ctx, overlay, frameHeight, boxW, boxH);
  const padding = Math.round(Math.min(boxW, boxH) * 0.12);
  const textWidth = Math.max(...layout.lines.map((line) => ctx.measureText(line).width));
  const blockH = layout.lines.length * layout.lineHeight;
  const blockY = boxY + Math.round((boxH - blockH) / 2);
  const anchorX = overlay.textAlign === "left" ? boxX + padding : overlay.textAlign === "right" ? boxX + boxW - padding : boxX + boxW / 2;

  if (overlay.backgroundColor) {
    const bgW = Math.min(boxW, Math.ceil(textWidth) + padding * 2);
    const bgX = overlay.textAlign === "left" ? boxX : overlay.textAlign === "right" ? boxX + boxW - bgW : boxX + Math.round((boxW - bgW) / 2);
    const bgH = Math.min(boxH, blockH + padding * 2);
    ctx.fillStyle = hexToRgba(overlay.backgroundColor);
    roundRect(ctx, bgX, boxY + Math.round((boxH - bgH) / 2), bgW, bgH, Math.round(layout.fontPx * 0.35));
    ctx.fill();
  }

  ctx.fillStyle = hexToRgba(overlay.textColor);
  ctx.textAlign = overlay.textAlign;
  ctx.textBaseline = "middle";
  if (!overlay.backgroundColor) {
    // Contorno leve garante leitura sobre qualquer fundo animado.
    ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
    ctx.shadowBlur = Math.max(2, Math.round(layout.fontPx * 0.15));
  }
  layout.lines.forEach((line, index) => {
    ctx.fillText(line, anchorX, blockY + layout.lineHeight * index + layout.lineHeight / 2);
  });
  return canvas.toBuffer("image/png");
}

// ---------------------------------------------------------------------------
// FFmpeg.
// ---------------------------------------------------------------------------

export interface OverlayLayerFile {
  path: string;
  startTime: number;
  endTime: number | null;
}

/** Argumentos do FFmpeg (puro, testável): cada camada entra com sua janela de tempo, na ordem do zIndex. */
export function buildOverlayFfmpegArgs(inputPath: string, layers: OverlayLayerFile[], outputPath: string): string[] {
  const args = ["-y", "-hide_banner", "-loglevel", "error", "-i", inputPath];
  for (const layer of layers) args.push("-i", layer.path);
  const filters: string[] = [];
  let previous = "[0:v]";
  layers.forEach((layer, index) => {
    const label = `[v${index + 1}]`;
    const fmt = (value: number) => Number(value.toFixed(3)).toString();
    const enable =
      layer.endTime !== null
        ? `:enable='between(t,${fmt(layer.startTime)},${fmt(layer.endTime)})'`
        : layer.startTime > 0
          ? `:enable='gte(t,${fmt(layer.startTime)})'`
          : "";
    filters.push(`${previous}[${index + 1}:v]overlay=0:0:format=auto${enable}${label}`);
    previous = label;
  });
  // H.264/yuv420p exige largura/altura pares.
  filters.push(`${previous}crop=trunc(iw/2)*2:trunc(ih/2)*2[vout]`);
  args.push(
    "-filter_complex",
    filters.join(";"),
    "-map",
    "[vout]",
    "-map",
    "0:a?",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "20",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "copy",
    "-movflags",
    "+faststart",
    outputPath,
  );
  return args;
}

export interface ProcessAiVideoInput {
  videoBuffer: Buffer;
  overlays: AiVideoOverlay[];
  /** Baixa a imagem de um overlay LOGO/IMAGE (URL já validada na criação). */
  loadOverlayImage: (url: string) => Promise<Buffer>;
}

export interface ProcessAiVideoResult {
  buffer: Buffer;
  probe: VideoProbe;
  overlaysApplied: number;
}

/**
 * Valida o MP4 da IA e, se houver overlays, aplica-os. Lança
 * VideoOutputInvalidError (MP4 inutilizável — devolução automática) ou
 * VideoPostProcessError (falha do pós-processamento).
 */
export async function processAiVideo(input: ProcessAiVideoInput): Promise<ProcessAiVideoResult> {
  const dir = await mkdtemp(path.join(tmpdir(), "ai-video-"));
  try {
    const inputPath = path.join(dir, "input.mp4");
    await writeFile(inputPath, input.videoBuffer);
    const probe = await probeVideoFile(inputPath);
    const reason = invalidVideoReason(probe);
    if (reason) throw new VideoOutputInvalidError("O vídeo gerado veio vazio ou corrompido.", reason);
    if (input.overlays.length === 0) return { buffer: input.videoBuffer, probe, overlaysApplied: 0 };

    // H.264/yuv420p exige dimensões pares.
    const width = probe.width - (probe.width % 2);
    const height = probe.height - (probe.height % 2);
    const layers: OverlayLayerFile[] = [];
    for (const [index, overlay] of input.overlays.entries()) {
      const image = overlay.imageUrl ? await input.loadOverlayImage(overlay.imageUrl) : null;
      const png = await renderOverlayLayer(overlay, width, height, image);
      const layerPath = path.join(dir, `layer-${index}.png`);
      await writeFile(layerPath, png);
      layers.push({ path: layerPath, startTime: overlay.startTime, endTime: overlay.endTime });
    }

    const outputPath = path.join(dir, "output.mp4");
    await runProcess(ffmpegPath(), buildOverlayFfmpegArgs(inputPath, layers, outputPath));
    const outputProbe = await probeVideoFile(outputPath);
    if (invalidVideoReason(outputProbe)) throw new VideoPostProcessError("O vídeo final saiu inválido.");
    return { buffer: await readFile(outputPath), probe: outputProbe, overlaysApplied: layers.length };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}
