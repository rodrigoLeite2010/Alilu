// Mídia de teste do vídeo com IA: MP4 sintético (cor sólida) gerado com o
// MESMO ffmpeg-static da aplicação, e um logo PNG desenhado com canvas.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import { createCanvas } from "@napi-rs/canvas";

export function makeSolidMp4(options: { width?: number; height?: number; seconds?: number; color?: string } = {}): Buffer {
  const { width = 360, height = 640, seconds = 2, color = "0x1e40af" } = options;
  const dir = mkdtempSync(path.join(tmpdir(), "ai-video-fixture-"));
  const out = path.join(dir, "fixture.mp4");
  const result = spawnSync(ffmpegPath as string, [
    "-y", "-hide_banner", "-loglevel", "error",
    "-f", "lavfi", "-i", `color=c=${color}:s=${width}x${height}:d=${seconds}:r=24`,
    "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", out,
  ]);
  if (result.status !== 0) throw new Error(`ffmpeg falhou: ${result.stderr?.toString()}`);
  const buffer = readFileSync(out);
  rmSync(dir, { recursive: true, force: true });
  return buffer;
}

export function makeLogoPng(): Buffer {
  const canvas = createCanvas(200, 80);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f59e0b";
  ctx.fillRect(0, 0, 200, 80);
  return canvas.toBuffer("image/png");
}

/** Extrai o quadro em `atSeconds` como PNG (RGBA cru via ffmpeg → rawvideo). */
export function extractFrameRgba(mp4: Buffer, width: number, height: number, atSeconds = 1): Uint8Array {
  const dir = mkdtempSync(path.join(tmpdir(), "ai-video-frame-"));
  const input = path.join(dir, "in.mp4");
  writeFileSync(input, mp4);
  const result = spawnSync(ffmpegPath as string, [
    "-hide_banner", "-loglevel", "error", "-ss", String(atSeconds), "-i", input,
    "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgba", "pipe:1",
  ], { maxBuffer: width * height * 4 + 1024 });
  rmSync(dir, { recursive: true, force: true });
  if (result.status !== 0) throw new Error(`ffmpeg (frame) falhou: ${result.stderr?.toString()}`);
  return new Uint8Array(result.stdout);
}
