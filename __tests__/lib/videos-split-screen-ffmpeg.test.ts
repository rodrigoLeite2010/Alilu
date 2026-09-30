import { describe, expect, it } from "vitest";
import {
  buildSplitScreenFfmpegArgs,
  computeOutputDurationSeconds,
  VIDEO_LAYOUT_TOP_RATIO,
  VIDEO_OUTPUT_DIMENSIONS,
  type BuildSplitScreenFfmpegArgsInput,
  type VideoDurationMode,
  type VideoOutputFormat,
  type VideoSplitLayoutRatio,
} from "@/lib/videos/split-screen-ffmpeg";

/**
 * Testes unitários puros da função de construção de argumentos do FFmpeg
 * — nunca toca em disco nem roda nada, só confere presença/ordem de flags
 * específicas no array retornado. Cobre os 3 formatos, os 3 layouts, os 2
 * modos de duração e os 3 modos de áudio isoladamente, além de algumas
 * combinações compostas, troca de principal/complementar e vídeo sem
 * trilha de áudio.
 */

const BASE_INPUT: BuildSplitScreenFfmpegArgsInput = {
  primaryInputPath: "/tmp/primary-input",
  secondaryInputPath: "/tmp/secondary-input",
  outputPath: "/tmp/output.mp4",
  outputFormat: "vertical",
  layoutRatio: "50-50",
  primaryTrim: { startSeconds: 0, endSeconds: 10 },
  secondaryTrim: { startSeconds: 0, endSeconds: 10 },
  durationMode: "loop",
  audio: { source: "primary" },
  primaryHasAudio: true,
  secondaryHasAudio: true,
};

function argAfter(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}

function countOccurrences(args: string[], flag: string): number {
  return args.filter((arg) => arg === flag).length;
}

describe("buildSplitScreenFfmpegArgs — formatos de saída", () => {
  const formats: VideoOutputFormat[] = ["vertical", "square", "horizontal"];

  it.each(formats)("formato %s usa as dimensões corretas no filtro de scale/crop", (format) => {
    const { width, height } = VIDEO_OUTPUT_DIMENSIONS[format];
    const args = buildSplitScreenFfmpegArgs({ ...BASE_INPUT, outputFormat: format });
    const filterComplex = argAfter(args, "-filter_complex")!;

    expect(filterComplex).toContain(`scale=${width}:${Math.round((height * 0.5) / 2) * 2}`);
    expect(filterComplex).toContain(`crop=${width}:`);
  });
});

describe("buildSplitScreenFfmpegArgs — proporções de layout", () => {
  const ratios: VideoSplitLayoutRatio[] = ["50-50", "60-40", "40-60"];

  it.each(ratios)("proporção %s soma a altura total entre as duas metades", (ratio) => {
    const { height } = VIDEO_OUTPUT_DIMENSIONS.vertical;
    const args = buildSplitScreenFfmpegArgs({ ...BASE_INPUT, layoutRatio: ratio });
    const filterComplex = argAfter(args, "-filter_complex")!;

    const topRatio = VIDEO_LAYOUT_TOP_RATIO[ratio];
    const expectedTop = Math.round((height * topRatio) / 2) * 2;
    const expectedBottom = height - expectedTop;

    expect(filterComplex).toContain(`[0:v]scale=1080:${expectedTop}`);
    expect(filterComplex).toContain(`[1:v]scale=1080:${expectedBottom}`);
    expect(filterComplex).toContain("vstack=inputs=2");
  });
});

describe("buildSplitScreenFfmpegArgs — modos de duração", () => {
  it('modo "loop": complementar mais curto ganha -stream_loop -1 e -t usa a duração do principal', () => {
    const args = buildSplitScreenFfmpegArgs({
      ...BASE_INPUT,
      durationMode: "loop",
      primaryTrim: { startSeconds: 0, endSeconds: 10 },
      secondaryTrim: { startSeconds: 0, endSeconds: 4 },
    });

    expect(args).toContain("-stream_loop");
    expect(argAfter(args, "-stream_loop")).toBe("-1");
    expect(argAfter(args, "-t")).toBe("10");
  });

  it('modo "loop": quando o complementar NÃO é mais curto, não usa -stream_loop (só o -t já corta no ponto certo)', () => {
    const args = buildSplitScreenFfmpegArgs({
      ...BASE_INPUT,
      durationMode: "loop",
      primaryTrim: { startSeconds: 0, endSeconds: 5 },
      secondaryTrim: { startSeconds: 0, endSeconds: 10 },
    });

    expect(args).not.toContain("-stream_loop");
    expect(argAfter(args, "-t")).toBe("5");
  });

  it('modo "shortest": nunca usa -stream_loop, e -t usa a menor das duas durações', () => {
    const args = buildSplitScreenFfmpegArgs({
      ...BASE_INPUT,
      durationMode: "shortest",
      primaryTrim: { startSeconds: 0, endSeconds: 10 },
      secondaryTrim: { startSeconds: 0, endSeconds: 4 },
    });

    expect(args).not.toContain("-stream_loop");
    expect(argAfter(args, "-t")).toBe("4");
  });

  it("-stream_loop, quando presente, vem antes do -i do vídeo complementar (índice 1)", () => {
    const args = buildSplitScreenFfmpegArgs({
      ...BASE_INPUT,
      durationMode: "loop",
      primaryTrim: { startSeconds: 0, endSeconds: 10 },
      secondaryTrim: { startSeconds: 0, endSeconds: 4 },
    });

    const streamLoopIndex = args.indexOf("-stream_loop");
    const secondInputIndex = args.lastIndexOf("-i");
    expect(streamLoopIndex).toBeGreaterThan(-1);
    expect(streamLoopIndex).toBeLessThan(secondInputIndex);
    expect(args[secondInputIndex + 1]).toBe(BASE_INPUT.secondaryInputPath);
  });
});

describe("computeOutputDurationSeconds", () => {
  const modes: VideoDurationMode[] = ["loop", "shortest"];

  it.each(modes)('modo %s calcula a duração final consistente com buildSplitScreenFfmpegArgs', (mode) => {
    const primaryTrim = { startSeconds: 2, endSeconds: 12 };
    const secondaryTrim = { startSeconds: 0, endSeconds: 6 };
    const expectedDuration = computeOutputDurationSeconds(primaryTrim, secondaryTrim, mode);

    const args = buildSplitScreenFfmpegArgs({
      ...BASE_INPUT,
      durationMode: mode,
      primaryTrim,
      secondaryTrim,
    });

    expect(argAfter(args, "-t")).toBe(String(expectedDuration));
  });
});

describe("buildSplitScreenFfmpegArgs — corte (trim) por input", () => {
  it("usa -ss/-to como opção de INPUT para cada vídeo, na ordem principal (índice 0) e complementar (índice 1)", () => {
    const args = buildSplitScreenFfmpegArgs({
      ...BASE_INPUT,
      // modo "shortest" para isolar só a ordem/valores de -ss/-to, sem o
      // -stream_loop entrar no meio (esse é testado à parte, acima).
      durationMode: "shortest",
      primaryTrim: { startSeconds: 3, endSeconds: 13 },
      secondaryTrim: { startSeconds: 1, endSeconds: 6 },
    });

    const firstInputIndex = args.indexOf("-i");
    expect(args.slice(0, firstInputIndex)).toEqual(["-y", "-ss", "3", "-to", "13"]);
    expect(args[firstInputIndex + 1]).toBe(BASE_INPUT.primaryInputPath);

    const secondInputIndex = args.indexOf("-i", firstInputIndex + 1);
    expect(args.slice(firstInputIndex + 2, secondInputIndex)).toEqual(["-ss", "1", "-to", "6"]);
    expect(args[secondInputIndex + 1]).toBe(BASE_INPUT.secondaryInputPath);
  });
});

describe("buildSplitScreenFfmpegArgs — modos de áudio", () => {
  it('fonte "primary": mapeia 0:a de forma opcional (não falha se não houver trilha)', () => {
    const args = buildSplitScreenFfmpegArgs({ ...BASE_INPUT, audio: { source: "primary" } });
    expect(argAfter(args, "-map")).toBe("[vout]");
    expect(args).toContain("0:a?");
  });

  it('fonte "secondary": mapeia 1:a de forma opcional', () => {
    const args = buildSplitScreenFfmpegArgs({ ...BASE_INPUT, audio: { source: "secondary" } });
    expect(args).toContain("1:a?");
    expect(args).not.toContain("0:a?");
  });

  it('fonte "both" com os dois vídeos tendo áudio: usa amix com os volumes escolhidos', () => {
    const args = buildSplitScreenFfmpegArgs({
      ...BASE_INPUT,
      audio: { source: "both", primaryVolumePercent: 80, secondaryVolumePercent: 30 },
      primaryHasAudio: true,
      secondaryHasAudio: true,
    });

    const filterComplex = argAfter(args, "-filter_complex")!;
    expect(filterComplex).toContain("[0:a]volume=0.8[a0]");
    expect(filterComplex).toContain("[1:a]volume=0.3[a1]");
    expect(filterComplex).toContain("[a0][a1]amix=inputs=2:duration=first[aout]");
    expect(args).toContain("[aout]");
  });

  it('fonte "both" quando só o principal tem áudio: cai para 0:a (sem quebrar o grafo de filtros referenciando um stream inexistente)', () => {
    const args = buildSplitScreenFfmpegArgs({
      ...BASE_INPUT,
      audio: { source: "both", primaryVolumePercent: 100, secondaryVolumePercent: 100 },
      primaryHasAudio: true,
      secondaryHasAudio: false,
    });

    const filterComplex = argAfter(args, "-filter_complex")!;
    expect(filterComplex).not.toContain("amix");
    expect(countOccurrences(args, "-map")).toBe(2);
    expect(args).toContain("0:a");
  });

  it('fonte "both" quando só o complementar tem áudio: cai para 1:a', () => {
    const args = buildSplitScreenFfmpegArgs({
      ...BASE_INPUT,
      audio: { source: "both" },
      primaryHasAudio: false,
      secondaryHasAudio: true,
    });

    expect(args).toContain("1:a");
  });

  it('fonte "both" quando NENHUM dos dois tem áudio: só mapeia o vídeo, sem falhar', () => {
    const args = buildSplitScreenFfmpegArgs({
      ...BASE_INPUT,
      audio: { source: "both" },
      primaryHasAudio: false,
      secondaryHasAudio: false,
    });

    expect(countOccurrences(args, "-map")).toBe(1);
    expect(argAfter(args, "-map")).toBe("[vout]");
  });

  it('vídeo escolhido como fonte de áudio sem trilha (fonte "primary", sem áudio): ainda assim usa mapeamento opcional, sem falhar', () => {
    const args = buildSplitScreenFfmpegArgs({
      ...BASE_INPUT,
      audio: { source: "primary" },
      primaryHasAudio: false,
    });

    expect(args).toContain("0:a?");
  });
});

describe("buildSplitScreenFfmpegArgs — troca de principal/complementar", () => {
  it("o vídeo passado como primaryInputPath sempre vira o input 0 (em cima), e secondaryInputPath o input 1 (embaixo) — a troca é feita pelo chamador, não por uma flag aqui", () => {
    const swapped = buildSplitScreenFfmpegArgs({
      ...BASE_INPUT,
      primaryInputPath: BASE_INPUT.secondaryInputPath,
      secondaryInputPath: BASE_INPUT.primaryInputPath,
    });

    const firstInputIndex = swapped.indexOf("-i");
    const secondInputIndex = swapped.indexOf("-i", firstInputIndex + 1);
    expect(swapped[firstInputIndex + 1]).toBe(BASE_INPUT.secondaryInputPath);
    expect(swapped[secondInputIndex + 1]).toBe(BASE_INPUT.primaryInputPath);
  });
});

describe("buildSplitScreenFfmpegArgs — parâmetros fixos de saída", () => {
  it("sempre inclui os codecs/flags de saída do plano de referência", () => {
    const args = buildSplitScreenFfmpegArgs(BASE_INPUT);

    expect(args).toEqual(
      expect.arrayContaining([
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "23",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-movflags",
        "+faststart",
      ]),
    );
    expect(args[args.length - 1]).toBe(BASE_INPUT.outputPath);
    expect(args[0]).toBe("-y");
  });
});

describe("buildSplitScreenFfmpegArgs — combinações compostas", () => {
  it("quadrado + 60/40 + shortest + ambos os áudios", () => {
    const args = buildSplitScreenFfmpegArgs({
      ...BASE_INPUT,
      outputFormat: "square",
      layoutRatio: "60-40",
      durationMode: "shortest",
      primaryTrim: { startSeconds: 0, endSeconds: 8 },
      secondaryTrim: { startSeconds: 0, endSeconds: 6 },
      audio: { source: "both", primaryVolumePercent: 50, secondaryVolumePercent: 100 },
    });

    expect(argAfter(args, "-t")).toBe("6");
    expect(args).not.toContain("-stream_loop");
    const filterComplex = argAfter(args, "-filter_complex")!;
    expect(filterComplex).toContain("scale=1080:648"); // 1080 * 0.6
    expect(filterComplex).toContain("amix=inputs=2:duration=first[aout]");
  });

  it("horizontal + 40/60 + loop + áudio do complementar", () => {
    const args = buildSplitScreenFfmpegArgs({
      ...BASE_INPUT,
      outputFormat: "horizontal",
      layoutRatio: "40-60",
      durationMode: "loop",
      primaryTrim: { startSeconds: 0, endSeconds: 20 },
      secondaryTrim: { startSeconds: 0, endSeconds: 5 },
      audio: { source: "secondary" },
    });

    expect(args).toContain("-stream_loop");
    expect(argAfter(args, "-t")).toBe("20");
    const filterComplex = argAfter(args, "-filter_complex")!;
    expect(filterComplex).toContain("scale=1920:432"); // 1080 * 0.4
    expect(args).toContain("1:a?");
  });
});
