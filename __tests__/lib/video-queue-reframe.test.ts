// @vitest-environment node
// Adaptação 9:16 com o ffmpeg/ffprobe estáticos REAIS (os mesmos da Vercel).
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import { describe, expect, it } from "vitest";
import { renderReframe } from "@/lib/video-queue/backend/reframe-runner";
import { planReframe } from "@/lib/video-queue/reframe";

function probe(file: string) {
  const out = spawnSync(ffprobe.path, ["-v", "error", "-show_entries", "stream=codec_type,codec_name,width,height:format=duration", "-of", "json", file]);
  return JSON.parse(out.stdout.toString()) as { streams: Array<{ codec_type: string; codec_name: string; width?: number; height?: number }>; format: { duration: string } };
}

describe("adaptação para Reels (9:16)", () => {
  it("converte 16:9 em 720×1280 H.264/AAC sem cortar o conteúdo, encurta a duração e não altera o original", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "vq-reframe-test-"));
    try {
      const input = path.join(dir, "h.mp4");
      const made = spawnSync(ffmpegPath as string, [
        "-y", "-f", "lavfi", "-i", "testsrc=size=640x360:rate=30:duration=6", "-f", "lavfi", "-i", "sine=frequency=440:duration=6",
        "-pix_fmt", "yuv420p", "-c:v", "libx264", "-c:a", "aac", "-shortest", input,
      ]);
      expect(made.status).toBe(0);
      const original = readFileSync(input);
      const plan = planReframe({ width: 640, height: 360, durationSeconds: 6 }, { mode: "FIT_9_16", maxDurationSeconds: 4 })!;
      const output = await renderReframe(original, plan, 60_000);
      expect(output).not.toBeNull();
      const outFile = path.join(dir, "out.mp4");
      writeFileSync(outFile, output!);
      const info = probe(outFile);
      const video = info.streams.find((stream) => stream.codec_type === "video")!;
      expect([video.codec_name, video.width, video.height]).toEqual(["h264", 720, 1280]);
      expect(info.streams.some((stream) => stream.codec_type === "audio" && stream.codec_name === "aac")).toBe(true);
      expect(Number(info.format.duration)).toBeLessThanOrEqual(4.2);
      expect(readFileSync(input).equals(original)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 90_000);

  it("arquivo inválido: devolve null (o vídeo segue no formato original)", async () => {
    expect(await renderReframe(Buffer.from("não é vídeo"), { reframe: true, trimToSeconds: null, reasons: [] }, 10_000)).toBeNull();
  });
});
