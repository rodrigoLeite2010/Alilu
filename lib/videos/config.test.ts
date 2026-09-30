import { describe, expect, it } from "vitest";
import {
  MAX_OUTPUT_DURATION_SECONDS,
  MAX_VIDEO_INPUT_BYTES,
  SATISFYING_PRESET,
  VIDEO_INPUT_CONTENT_TYPES,
} from "./config";
import { VIDEO_LAYOUT_TOP_RATIO, VIDEO_OUTPUT_DIMENSIONS } from "./split-screen-ffmpeg";

/**
 * Testes de sanidade das constantes centrais da categoria "Vídeos" — não
 * repete o comportamento do FFmpeg (isso já é coberto por
 * __tests__/lib/videos-split-screen-ffmpeg.test.ts e
 * __tests__/lib/videos-ffmpeg-integration.test.ts), só garante que os
 * números em si fazem sentido e que o preset "Vídeo satisfatório" bate com
 * a descrição do produto (vertical, 50/50, loop, áudio do principal).
 */

describe("MAX_VIDEO_INPUT_BYTES", () => {
  it("é 100 MB — menor que o limite de 250 MB dos Reels autenticados, de propósito", () => {
    expect(MAX_VIDEO_INPUT_BYTES).toBe(100 * 1024 * 1024);
  });
});

describe("MAX_OUTPUT_DURATION_SECONDS", () => {
  it("é um número positivo e razoável para um vídeo curto (Reels/Shorts/TikTok)", () => {
    expect(MAX_OUTPUT_DURATION_SECONDS).toBeGreaterThan(0);
    expect(MAX_OUTPUT_DURATION_SECONDS).toBe(180);
  });
});

describe("VIDEO_INPUT_CONTENT_TYPES", () => {
  it("aceita MP4, MOV (QuickTime) e WEBM — e nada além disso", () => {
    expect(VIDEO_INPUT_CONTENT_TYPES).toEqual(["video/mp4", "video/quicktime", "video/webm"]);
  });
});

describe("VIDEO_OUTPUT_DIMENSIONS", () => {
  it("vertical é 1080x1920 (9:16)", () => {
    expect(VIDEO_OUTPUT_DIMENSIONS.vertical).toEqual({ width: 1080, height: 1920 });
  });

  it("quadrado é 1080x1080 (1:1)", () => {
    expect(VIDEO_OUTPUT_DIMENSIONS.square).toEqual({ width: 1080, height: 1080 });
  });

  it("horizontal é 1920x1080 (16:9)", () => {
    expect(VIDEO_OUTPUT_DIMENSIONS.horizontal).toEqual({ width: 1920, height: 1080 });
  });

  it("toda dimensão de todo formato é um número par (libx264/yuv420p exige dimensões pares)", () => {
    for (const { width, height } of Object.values(VIDEO_OUTPUT_DIMENSIONS)) {
      expect(width % 2).toBe(0);
      expect(height % 2).toBe(0);
    }
  });
});

describe("VIDEO_LAYOUT_TOP_RATIO", () => {
  it("50/50, 60/40 e 40/60 somam exatamente a proporção esperada para a metade de cima", () => {
    expect(VIDEO_LAYOUT_TOP_RATIO["50-50"]).toBe(0.5);
    expect(VIDEO_LAYOUT_TOP_RATIO["60-40"]).toBe(0.6);
    expect(VIDEO_LAYOUT_TOP_RATIO["40-60"]).toBe(0.4);
  });

  it("toda proporção fica estritamente entre 0 e 1 (nunca zera uma das metades)", () => {
    for (const ratio of Object.values(VIDEO_LAYOUT_TOP_RATIO)) {
      expect(ratio).toBeGreaterThan(0);
      expect(ratio).toBeLessThan(1);
    }
  });
});

describe("SATISFYING_PRESET", () => {
  it('bate com a descrição do produto: vertical, 50/50, complementar em loop, áudio só do principal', () => {
    expect(SATISFYING_PRESET).toEqual({
      outputFormat: "vertical",
      layoutRatio: "50-50",
      durationMode: "loop",
      audioSource: "primary",
    });
  });

  it("usa valores que existem de fato em VIDEO_OUTPUT_DIMENSIONS e VIDEO_LAYOUT_TOP_RATIO", () => {
    expect(VIDEO_OUTPUT_DIMENSIONS).toHaveProperty(SATISFYING_PRESET.outputFormat);
    expect(VIDEO_LAYOUT_TOP_RATIO).toHaveProperty(SATISFYING_PRESET.layoutRatio);
  });
});
