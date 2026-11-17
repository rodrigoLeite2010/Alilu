import "server-only";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";

/**
 * Miniatura (JPEG, 480 px de largura) de um vídeo já validado, com o
 * ffmpeg estático que o projeto já usa no Split-Screen. Falha da miniatura
 * nunca impede o vídeo de seguir na fila (devolve null).
 */
export async function extractThumbnailJpeg(video: Buffer, durationSeconds: number | null, timeoutMs = 20_000): Promise<Buffer | null> {
  if (!ffmpegPath) return null;
  const dir = await mkdtemp(path.join(tmpdir(), "vq-thumb-"));
  try {
    const input = path.join(dir, "input");
    const output = path.join(dir, "thumb.jpg");
    await writeFile(input, video);
    const at = durationSeconds && durationSeconds > 2 ? Math.min(1, durationSeconds / 2) : 0;
    const ok = await new Promise<boolean>((resolve) => {
      const child = spawn(ffmpegPath as string, ["-y", "-ss", String(at), "-i", input, "-frames:v", "1", "-vf", "scale=480:-2", "-q:v", "5", output]);
      const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
      child.on("error", () => {
        clearTimeout(timer);
        resolve(false);
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        resolve(code === 0);
      });
    });
    if (!ok) return null;
    const jpeg = await readFile(output);
    return jpeg.length > 0 ? jpeg : null;
  } catch {
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}
