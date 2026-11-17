// @vitest-environment node
// Miniatura com o ffmpeg estático REAL (o mesmo que vai para a Vercel).
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import { describe, expect, it } from "vitest";
import { extractThumbnailJpeg } from "@/lib/video-queue/backend/thumbnail";

describe("miniatura da fila", () => {
  it("gera um JPEG a partir de um vídeo vertical", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "vq-test-"));
    try {
      const file = path.join(dir, "v.mp4");
      const made = spawnSync(ffmpegPath as string, ["-y", "-f", "lavfi", "-i", "testsrc=size=540x960:rate=30:duration=3", "-pix_fmt", "yuv420p", "-c:v", "libx264", file]);
      expect(made.status).toBe(0);
      const jpeg = await extractThumbnailJpeg(readFileSync(file), 3);
      expect(jpeg).not.toBeNull();
      expect(jpeg!.subarray(0, 2).toString("hex")).toBe("ffd8");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);

  it("arquivo inválido: devolve null (nunca derruba a importação)", async () => {
    expect(await extractThumbnailJpeg(Buffer.from("não é vídeo"), null)).toBeNull();
  });
});
