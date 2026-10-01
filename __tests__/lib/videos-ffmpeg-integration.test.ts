import { describe, expect, it, afterAll, beforeAll } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import { path as ffprobePath } from "ffprobe-static";
import { buildSplitScreenFfmpegArgs } from "@/lib/videos/split-screen-ffmpeg";

/**
 * Teste de INTEGRAÇÃO real com o FFmpeg (não é um teste unitário puro —
 * ver __tests__/lib/videos-split-screen-ffmpeg.test.ts para a função pura
 * isolada). Gera 2 clipes sintéticos minúsculos com o próprio
 * `ffmpeg-static`/lavfi (não depende de nenhum arquivo de vídeo real),
 * roda a função de construção de argumentos de verdade contra esses
 * clipes, executa o FFmpeg real via child_process e confere que o
 * arquivo de saída existe, tem duração aproximada correta e é um MP4
 * válido (relido com ffprobe-static).
 *
 * Se o binário do FFmpeg não estiver disponível neste ambiente de teste
 * (por exemplo, porque o passo `npm install` não conseguiu baixar o
 * binário do `ffmpeg-static` por uma restrição de rede do ambiente — ver
 * relatório da Fase A), os testes deste arquivo são pulados em vez de
 * falhar silenciosamente: cada `it` verifica a disponibilidade e usa
 * `expect.fail` com uma mensagem explícita do que faltou, para nunca
 * passar "verde" sem ter rodado de verdade.
 */

const workDir = mkdtempSync(path.join(tmpdir(), "alilu-videos-ffmpeg-test-"));
const primaryPath = path.join(workDir, "primary.mp4");
const secondaryPath = path.join(workDir, "secondary.mp4");
const outputPath = path.join(workDir, "output.mp4");

const ffmpegAvailable = typeof ffmpegPath === "string" && existsSync(ffmpegPath);
const ffprobeAvailable = Boolean(ffprobePath) && existsSync(ffprobePath);

function runFfmpeg(args: string[]) {
  return spawnSync(ffmpegPath as string, args, { encoding: "utf-8" });
}

function runFfprobe(args: string[]) {
  return spawnSync(ffprobePath, args, { encoding: "utf-8" });
}

function readBottomFrameMd5s(videoPath: string, frameA: number, frameB: number): string[] {
  const result = runFfmpeg([
    "-v",
    "error",
    "-i",
    videoPath,
    "-vf",
    `crop=1080:960:0:960,select=eq(n\\,${frameA})+eq(n\\,${frameB})`,
    "-vsync",
    "0",
    "-f",
    "framemd5",
    "-",
  ]);
  expect(result.status, `framemd5 falhou: ${result.stderr}`).toBe(0);
  return result.stdout
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.split(",").at(-1)?.trim() ?? "")
    .filter(Boolean);
}

beforeAll(() => {
  if (!ffmpegAvailable || !ffprobeAvailable) return;

  // Principal: 3s, 320x240, COM áudio (sine) — simula o vídeo "principal".
  const primaryResult = runFfmpeg([
    "-y",
    "-f",
    "lavfi",
    "-i",
    "testsrc=duration=3:size=320x240:rate=10",
    "-f",
    "lavfi",
    "-i",
    "sine=duration=3",
    "-shortest",
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-c:a",
    "aac",
    "-pix_fmt",
    "yuv420p",
    primaryPath,
  ]);
  if (primaryResult.status !== 0) {
    throw new Error(`Falha ao gerar o clipe sintético principal: ${primaryResult.stderr}`);
  }

  // Complementar: 1s, 320x240, SEM áudio — simula o vídeo "complementar"
  // mais curto, sem trilha sonora (cobre o caso de vídeo sem áudio).
  const secondaryResult = runFfmpeg([
    "-y",
    "-f",
    "lavfi",
    "-i",
    "testsrc2=duration=1:size=320x240:rate=10",
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-pix_fmt",
    "yuv420p",
    secondaryPath,
  ]);
  if (secondaryResult.status !== 0) {
    throw new Error(`Falha ao gerar o clipe sintético complementar: ${secondaryResult.stderr}`);
  }
}, 30_000);

afterAll(() => {
  rmSync(workDir, { recursive: true, force: true });
});

describe("Integração real com FFmpeg — split-screen com loop do complementar", () => {
  it("gera um MP4 válido, com duração aproximada igual à do vídeo principal (loop do complementar mais curto)", () => {
    if (!ffmpegAvailable || !ffprobeAvailable) {
      expect.fail(
        "Binário do ffmpeg-static/ffprobe-static não disponível neste ambiente de teste " +
          `(ffmpegPath=${String(ffmpegPath)}, ffprobePath=${String(ffprobePath)}). ` +
          "Ver relatório da Fase A, seção do teste de integração, para o erro exato encontrado ao tentar " +
          "baixar o binário via npm install neste ambiente.",
      );
      return;
    }

    const args = buildSplitScreenFfmpegArgs({
      primaryInputPath: primaryPath,
      secondaryInputPath: secondaryPath,
      outputPath,
      outputFormat: "vertical",
      layoutRatio: "50-50",
      primaryTrim: { startSeconds: 0, endSeconds: 3 },
      secondaryTrim: { startSeconds: 0, endSeconds: 1 },
      durationMode: "loop",
      audio: { source: "primary" },
      primaryHasAudio: true,
      secondaryHasAudio: false,
    });

    const result = runFfmpeg(args);
    expect(result.status, `ffmpeg falhou: ${result.stderr}`).toBe(0);
    expect(existsSync(outputPath)).toBe(true);

    const probe = runFfprobe([
      "-v",
      "error",
      "-print_format",
      "json",
      "-show_format",
      "-show_streams",
      outputPath,
    ]);
    expect(probe.status, `ffprobe falhou: ${probe.stderr}`).toBe(0);

    const parsed = JSON.parse(probe.stdout) as {
      format: { duration: string };
      streams: Array<{ codec_type: string; width?: number; height?: number }>;
    };

    const duration = Number(parsed.format.duration);
    // Tolerância de 0.3s: o encode de vídeo trabalha em quadros, não em
    // segundos exatos — não esperamos um valor cravado.
    expect(duration).toBeGreaterThan(2.7);
    expect(duration).toBeLessThan(3.3);

    const videoStream = parsed.streams.find((stream) => stream.codec_type === "video");
    expect(videoStream).toBeDefined();
    expect(videoStream?.width).toBe(1080);
    expect(videoStream?.height).toBe(1920);

    const audioStream = parsed.streams.find((stream) => stream.codec_type === "audio");
    expect(audioStream, "a saída deveria ter áudio (fonte = vídeo principal, que tem trilha de som)").toBeDefined();
  }, 30_000);

  it('modo "shortest": gera um MP4 com duração aproximada igual à do vídeo mais curto (o complementar, 1s)', () => {
    if (!ffmpegAvailable || !ffprobeAvailable) {
      expect.fail("Binário do ffmpeg-static/ffprobe-static não disponível neste ambiente de teste.");
      return;
    }

    const shortestOutputPath = path.join(workDir, "output-shortest.mp4");
    const args = buildSplitScreenFfmpegArgs({
      primaryInputPath: primaryPath,
      secondaryInputPath: secondaryPath,
      outputPath: shortestOutputPath,
      outputFormat: "square",
      layoutRatio: "60-40",
      primaryTrim: { startSeconds: 0, endSeconds: 3 },
      secondaryTrim: { startSeconds: 0, endSeconds: 1 },
      durationMode: "shortest",
      audio: { source: "secondary" },
      primaryHasAudio: true,
      secondaryHasAudio: false,
    });

    const result = runFfmpeg(args);
    expect(result.status, `ffmpeg falhou: ${result.stderr}`).toBe(0);

    const probe = runFfprobe(["-v", "error", "-print_format", "json", "-show_format", "-show_streams", shortestOutputPath]);
    expect(probe.status).toBe(0);
    const parsed = JSON.parse(probe.stdout) as { format: { duration: string }; streams: Array<{ codec_type: string }> };

    const duration = Number(parsed.format.duration);
    expect(duration).toBeGreaterThan(0.7);
    expect(duration).toBeLessThan(1.3);

    // Fonte de áudio = complementar, que NÃO tem trilha — o mapeamento
    // opcional (1:a?) não deve falhar, e a saída simplesmente sai muda.
    const audioStream = parsed.streams.find((stream) => stream.codec_type === "audio");
    expect(audioStream).toBeUndefined();
  }, 30_000);

  it("complementar preparado como segmento de loop continua mudando depois do primeiro ciclo", () => {
    if (!ffmpegAvailable || !ffprobeAvailable) {
      expect.fail("Binário do ffmpeg-static/ffprobe-static não disponível neste ambiente de teste.");
      return;
    }

    const segmentPath = path.join(workDir, "secondary-loop-segment.mkv");
    const preparedOutputPath = path.join(workDir, "output-prepared-loop.mp4");
    const segment = runFfmpeg([
      "-y",
      "-ss",
      "0",
      "-t",
      "1",
      "-i",
      secondaryPath,
      "-map",
      "0",
      "-c",
      "copy",
      "-avoid_negative_ts",
      "make_zero",
      segmentPath,
    ]);
    expect(segment.status, `falha ao preparar segmento: ${segment.stderr}`).toBe(0);

    const args = buildSplitScreenFfmpegArgs({
      primaryInputPath: primaryPath,
      secondaryInputPath: segmentPath,
      outputPath: preparedOutputPath,
      outputFormat: "vertical",
      layoutRatio: "50-50",
      primaryTrim: { startSeconds: 0, endSeconds: 3 },
      secondaryTrim: { startSeconds: 0, endSeconds: 1 },
      durationMode: "loop",
      audio: { source: "primary" },
      primaryHasAudio: true,
      secondaryHasAudio: false,
      secondaryInputIsLoopSegment: true,
    });

    const result = runFfmpeg(args);
    expect(result.status, `ffmpeg falhou: ${result.stderr}`).toBe(0);

    const md5s = readBottomFrameMd5s(preparedOutputPath, 15, 20);
    expect(md5s).toHaveLength(2);
    expect(md5s[0]).not.toBe(md5s[1]);
  }, 30_000);
});
