// @vitest-environment node
// Mídia final padrão — FFmpeg REAL com clipes sintéticos: imagem → trecho
// de vídeo, vídeo principal (sem áudio, outra resolução/fps) + encerramento,
// e Split Screen + encerramento no mesmo passe. Confere duração, tamanho,
// fps e que sempre sai uma trilha de áudio (emenda uniforme).
import { afterAll, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import { path as ffprobePath } from "ffprobe-static";
import { buildAppendEndClipArgs, buildNormalizeEndClipArgs, endClipCacheKey } from "@/lib/brand-end-media/end-media-ffmpeg";
import { buildSplitScreenFfmpegArgs } from "@/lib/videos/split-screen-ffmpeg";

const dir = mkdtempSync(path.join(tmpdir(), "alilu-end-media-test-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
const size = { width: 360, height: 640 };

function ffmpeg(args: string[]) {
  const result = spawnSync(ffmpegPath as string, args, { encoding: "utf-8" });
  expect(result.status, result.stderr).toBe(0);
}

function probe(file: string) {
  const result = spawnSync(ffprobePath, ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file], { encoding: "utf-8" });
  const parsed = JSON.parse(result.stdout) as { format: { duration: string }; streams: Array<{ codec_type: string; width?: number; height?: number; avg_frame_rate?: string }> };
  const video = parsed.streams.find((stream) => stream.codec_type === "video")!;
  return {
    duration: Number(parsed.format.duration),
    width: video.width,
    height: video.height,
    fps: video.avg_frame_rate,
    hasAudio: parsed.streams.some((stream) => stream.codec_type === "audio"),
  };
}

describe.skipIf(!ffmpegPath || !existsSync(ffmpegPath as string))("encerramento padrão com FFmpeg real", () => {
  const image = path.join(dir, "cta.png");
  const imageClip = path.join(dir, "cta-clip.mp4");

  it("imagem vira trecho de N segundos, no tamanho do Reel, com áudio mudo e 30 fps", () => {
    ffmpeg(["-y", "-f", "lavfi", "-i", "color=c=orange:s=400x400", "-frames:v", "1", image]);
    ffmpeg(
      buildNormalizeEndClipArgs({
        inputPath: image,
        outputPath: imageClip,
        kind: "IMAGE",
        size,
        durationSeconds: 2,
        sourceDurationSeconds: null,
        sourceHasAudio: false,
        keepAudio: false,
        fadeSeconds: 0.3,
      }),
    );
    const info = probe(imageClip);
    expect(info.duration).toBeGreaterThan(1.8);
    expect(info.duration).toBeLessThan(2.3);
    expect([info.width, info.height]).toEqual([360, 640]);
    expect(info.fps).toBe("30/1");
    expect(info.hasAudio).toBe(true);
  });

  it("vídeo principal SEM áudio, outra resolução e fps + encerramento = soma das durações", () => {
    const main = path.join(dir, "main.mp4");
    const out = path.join(dir, "reel-final.mp4");
    ffmpeg(["-y", "-f", "lavfi", "-i", "testsrc=duration=3:size=640x360:rate=24", "-pix_fmt", "yuv420p", main]);
    ffmpeg(
      buildAppendEndClipArgs({
        mainPath: main,
        mainDurationSeconds: 3,
        mainHasAudio: false,
        endClipPath: imageClip,
        endClipDurationSeconds: 2,
        size,
        fadeSeconds: 0.3,
        outputPath: out,
      }),
    );
    const info = probe(out);
    expect(info.duration).toBeGreaterThan(4.7);
    expect(info.duration).toBeLessThan(5.4);
    expect([info.width, info.height]).toEqual([360, 640]);
    expect(info.hasAudio).toBe(true);
  });

  it("vídeo de encerramento com áudio: 'sem áudio' troca por silêncio; limite de duração respeitado", () => {
    const endSource = path.join(dir, "end-source.mp4");
    const endClip = path.join(dir, "end-clip.mp4");
    ffmpeg(["-y", "-f", "lavfi", "-i", "testsrc2=duration=4:size=720x1280:rate=60", "-f", "lavfi", "-i", "sine=duration=4", "-shortest", "-pix_fmt", "yuv420p", endSource]);
    ffmpeg(
      buildNormalizeEndClipArgs({
        inputPath: endSource,
        outputPath: endClip,
        kind: "VIDEO",
        size,
        durationSeconds: 1.5,
        sourceDurationSeconds: 4,
        sourceHasAudio: true,
        keepAudio: false,
        fadeSeconds: 0,
      }),
    );
    const info = probe(endClip);
    expect(info.duration).toBeLessThan(1.8);
    expect(info.fps).toBe("30/1");
    expect(info.hasAudio).toBe(true);
  });

  it("Split Screen + encerramento no MESMO passe: o encerramento entra depois do split (loop do complementar)", () => {
    const primary = path.join(dir, "p.mp4");
    const secondary = path.join(dir, "s.mp4");
    const out = path.join(dir, "split-final.mp4");
    ffmpeg(["-y", "-f", "lavfi", "-i", "testsrc=duration=3:size=320x240:rate=25", "-f", "lavfi", "-i", "sine=duration=3", "-shortest", "-pix_fmt", "yuv420p", primary]);
    ffmpeg(["-y", "-f", "lavfi", "-i", "testsrc2=duration=1:size=320x240:rate=30", "-pix_fmt", "yuv420p", secondary]);
    const verticalClip = path.join(dir, "cta-vertical.mp4");
    ffmpeg(
      buildNormalizeEndClipArgs({
        inputPath: image,
        outputPath: verticalClip,
        kind: "IMAGE",
        size: { width: 1080, height: 1920 },
        durationSeconds: 2,
        sourceDurationSeconds: null,
        sourceHasAudio: false,
        keepAudio: false,
        fadeSeconds: 0.3,
      }),
    );
    ffmpeg(
      buildSplitScreenFfmpegArgs({
        primaryInputPath: primary,
        secondaryInputPath: secondary,
        outputPath: out,
        outputFormat: "vertical",
        layoutRatio: "50-50",
        primaryTrim: { startSeconds: 0, endSeconds: 3 },
        secondaryTrim: { startSeconds: 0, endSeconds: 1 },
        durationMode: "loop",
        audio: { source: "primary" },
        primaryHasAudio: true,
        secondaryHasAudio: false,
        endClip: { path: verticalClip, durationSeconds: 2, fadeSeconds: 0.3 },
      }),
    );
    const info = probe(out);
    expect(info.duration).toBeGreaterThan(4.7);
    expect(info.duration).toBeLessThan(5.4);
    expect([info.width, info.height]).toEqual([1080, 1920]);
    expect(info.hasAudio).toBe(true);
  }, 60_000);

  it("Split Screen com áudio dos DOIS vídeos (mix) + encerramento em vídeo, modo 'mais curto'", () => {
    const primary = path.join(dir, "p2.mp4");
    const secondary = path.join(dir, "s2.mp4");
    const endClip = path.join(dir, "end-sq.mp4");
    const out = path.join(dir, "split-mix.mp4");
    ffmpeg(["-y", "-f", "lavfi", "-i", "testsrc=duration=2:size=320x240:rate=25", "-f", "lavfi", "-i", "sine=duration=2", "-shortest", "-pix_fmt", "yuv420p", primary]);
    ffmpeg(["-y", "-f", "lavfi", "-i", "testsrc2=duration=3:size=320x240:rate=30", "-f", "lavfi", "-i", "sine=frequency=600:duration=3", "-shortest", "-pix_fmt", "yuv420p", secondary]);
    ffmpeg(["-y", "-f", "lavfi", "-i", "testsrc2=duration=1:size=640x640:rate=24", "-pix_fmt", "yuv420p", path.join(dir, "end-raw.mp4")]);
    ffmpeg(
      buildNormalizeEndClipArgs({
        inputPath: path.join(dir, "end-raw.mp4"),
        outputPath: endClip,
        kind: "VIDEO",
        size: { width: 1080, height: 1080 },
        durationSeconds: null,
        sourceDurationSeconds: 1,
        sourceHasAudio: false,
        keepAudio: true,
        fadeSeconds: 0.2,
      }),
    );
    ffmpeg(
      buildSplitScreenFfmpegArgs({
        primaryInputPath: primary,
        secondaryInputPath: secondary,
        outputPath: out,
        outputFormat: "square",
        layoutRatio: "60-40",
        primaryTrim: { startSeconds: 0, endSeconds: 2 },
        secondaryTrim: { startSeconds: 0, endSeconds: 3 },
        durationMode: "shortest",
        audio: { source: "both", primaryVolumePercent: 100, secondaryVolumePercent: 50 },
        primaryHasAudio: true,
        secondaryHasAudio: true,
        endClip: { path: endClip, durationSeconds: 1, fadeSeconds: 0.2 },
      }),
    );
    const info = probe(out);
    expect(info.duration).toBeGreaterThan(2.7);
    expect(info.duration).toBeLessThan(3.4);
    expect([info.width, info.height]).toEqual([1080, 1080]);
    expect(info.hasAudio).toBe(true);
  }, 60_000);

  it("chave do cache muda quando o arquivo ou qualquer opção que afeta o vídeo muda", () => {
    const base = { assetId: "a", size, kind: "IMAGE" as const, durationSeconds: 3, keepAudio: false, fadeSeconds: 0.3 };
    const key = endClipCacheKey(base);
    expect(endClipCacheKey({ ...base })).toBe(key);
    expect(endClipCacheKey({ ...base, assetId: "b" })).not.toBe(key);
    expect(endClipCacheKey({ ...base, durationSeconds: 4 })).not.toBe(key);
    expect(endClipCacheKey({ ...base, fadeSeconds: 0 })).not.toBe(key);
    expect(endClipCacheKey({ ...base, size: { width: 1080, height: 1080 } })).not.toBe(key);
  });
});
