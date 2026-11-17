import "server-only";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import { buildReframeArgs, type ReframePlan } from "@/lib/video-queue/reframe";

/**
 * Executa o plano de adaptação 9:16 com o ffmpeg estático do projeto, com
 * tempo máximo (a função serverless tem orçamento limitado). Qualquer falha
 * devolve null: o vídeo segue no formato original, com aviso no item.
 */
export async function renderReframe(video: Buffer, plan: ReframePlan, timeoutMs = 75_000): Promise<Buffer | null> {
  if (!ffmpegPath) return null;
  const dir = await mkdtemp(path.join(tmpdir(), "vq-reframe-"));
  try {
    const input = path.join(dir, "input");
    const output = path.join(dir, "output.mp4");
    await writeFile(input, video);
    const ok = await new Promise<boolean>((resolve) => {
      const child = spawn(ffmpegPath as string, buildReframeArgs(input, output, plan), { stdio: ["ignore", "ignore", "ignore"] });
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
    const result = await readFile(output);
    return result.length > 0 ? result : null;
  } catch {
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}
