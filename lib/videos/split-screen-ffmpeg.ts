/**
 * Núcleo técnico do editor de vídeo split-screen (Fase A). Função pura:
 * recebe tudo já resolvido (caminhos dos arquivos já baixados, config já
 * validada, flags de áudio já medidas via ffprobe) e devolve o array de
 * argumentos para `spawn(ffmpegPath, args)`. NÃO toca em disco nem roda
 * nada — testada só conferindo a lista de argumentos (ver
 * __tests__/lib/videos-split-screen-ffmpeg.test.ts).
 *
 * Estratégia (validada rodando o FFmpeg real com clipes sintéticos — ver
 * __tests__/lib/videos-ffmpeg-integration.test.ts — e o relatório final
 * para os desvios encontrados em relação ao plano de referência original):
 *
 * - Split top/bottom: dois inputs (principal = índice 0, complementar =
 *   índice 1) cada um escalado+recortado ("cover", nunca deforma) para a
 *   metade da tela que lhe cabe, depois empilhados com vstack.
 * - Corte: `-ss <início> -to <fim>` como opção de INPUT (seek de input,
 *   mais rápido e preciso o bastante para este caso de uso).
 * - Loop do complementar quando mais curto (modo "loop"): `-stream_loop -1`
 *   antes do `-i` do complementar, deixando o `-t` da saída (duração do
 *   principal já cortado) cortar o loop no ponto certo.
 * - Modo "cortar no mais curto": sem `-stream_loop`; `-t` da saída é a
 *   menor das duas durações já cortadas.
 * - Áudio: mapeamento opcional (`0:a?`/`1:a?`) quando a fonte é só um dos
 *   dois vídeos — nunca falha se a trilha não existir. Quando a fonte é
 *   "ambos", o grafo de filtros só referencia `0:a`/`1:a` quando aquele
 *   input REALMENTE tem trilha de áudio (`primaryHasAudio`/
 *   `secondaryHasAudio`, medidos via ffprobe antes de chamar esta função)
 *   — referenciar `[0:a]` num filtro quando o input não tem áudio quebra o
 *   grafo de filtros do FFmpeg (diferente de `-map 0:a?`, que é opcional
 *   só para `-map`). Se nenhum dos dois tiver áudio, a saída sai muda.
 */

export type VideoOutputFormat = "vertical" | "square" | "horizontal";
export type VideoSplitLayoutRatio = "50-50" | "60-40" | "40-60";
export type VideoDurationMode = "loop" | "shortest";
export type VideoAudioSource = "primary" | "secondary" | "both";

export interface VideoTrimRange {
  /** Segundos, relativo ao início real do arquivo. */
  startSeconds: number;
  /** Segundos, relativo ao início real do arquivo (sempre > startSeconds). */
  endSeconds: number;
}

export interface VideoAudioConfig {
  source: VideoAudioSource;
  /** 0–100. Só usado (e obrigatório) quando source === "both". */
  primaryVolumePercent?: number;
  /** 0–100. Só usado (e obrigatório) quando source === "both". */
  secondaryVolumePercent?: number;
}

export interface VideoOutputDimensions {
  width: number;
  height: number;
}

/** Dimensões de saída por formato — únicas usadas nesta fase (sem controle manual). */
export const VIDEO_OUTPUT_DIMENSIONS: Record<VideoOutputFormat, VideoOutputDimensions> = {
  vertical: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
  horizontal: { width: 1920, height: 1080 },
};

/** Proporção da metade de CIMA (sempre o vídeo principal) — a de baixo é o complemento (1 - top). */
export const VIDEO_LAYOUT_TOP_RATIO: Record<VideoSplitLayoutRatio, number> = {
  "50-50": 0.5,
  "60-40": 0.6,
  "40-60": 0.4,
};

export interface BuildSplitScreenFfmpegArgsInput {
  /** Caminho local (já baixado em /tmp) do vídeo principal — sempre renderizado em cima. */
  primaryInputPath: string;
  /** Caminho local (já baixado em /tmp) do vídeo complementar — sempre renderizado embaixo. */
  secondaryInputPath: string;
  /** Caminho local de saída (ex.: /tmp/<uuid>.mp4). */
  outputPath: string;
  outputFormat: VideoOutputFormat;
  layoutRatio: VideoSplitLayoutRatio;
  primaryTrim: VideoTrimRange;
  secondaryTrim: VideoTrimRange;
  durationMode: VideoDurationMode;
  audio: VideoAudioConfig;
  /** Medido via ffprobe no arquivo já baixado — nunca inferido do lado do cliente. */
  primaryHasAudio: boolean;
  /** Medido via ffprobe no arquivo já baixado — nunca inferido do lado do cliente. */
  secondaryHasAudio: boolean;
}

function trimDurationSeconds(trim: VideoTrimRange): number {
  return trim.endSeconds - trim.startSeconds;
}

/** Arredonda para o inteiro par mais próximo — libx264 (yuv420p) exige dimensões pares. */
function roundToEven(value: number): number {
  return Math.round(value / 2) * 2;
}

/**
 * Duração final do vídeo de saída, em segundos, dado o modo escolhido.
 * Exportada porque tanto o validador (lib/videos/validation.ts, checagem
 * client-side otimista) quanto o serviço de processamento (checagem
 * server-side com durações REAIS medidas via ffprobe) precisam do mesmo
 * cálculo.
 */
export function computeOutputDurationSeconds(
  primaryTrim: VideoTrimRange,
  secondaryTrim: VideoTrimRange,
  durationMode: VideoDurationMode,
): number {
  const primaryDuration = trimDurationSeconds(primaryTrim);
  const secondaryDuration = trimDurationSeconds(secondaryTrim);
  return durationMode === "loop" ? primaryDuration : Math.min(primaryDuration, secondaryDuration);
}

export function buildSplitScreenFfmpegArgs(input: BuildSplitScreenFfmpegArgsInput): string[] {
  const { width, height } = VIDEO_OUTPUT_DIMENSIONS[input.outputFormat];
  const topRatio = VIDEO_LAYOUT_TOP_RATIO[input.layoutRatio];
  const topHeight = roundToEven(height * topRatio);
  const bottomHeight = height - topHeight;

  const primaryDuration = trimDurationSeconds(input.primaryTrim);
  const secondaryDuration = trimDurationSeconds(input.secondaryTrim);
  const needsLoop = input.durationMode === "loop" && secondaryDuration < primaryDuration;
  const outputDuration = computeOutputDurationSeconds(input.primaryTrim, input.secondaryTrim, input.durationMode);

  const args: string[] = ["-y"];

  // Input 0: vídeo principal (sempre em cima).
  args.push("-ss", String(input.primaryTrim.startSeconds), "-to", String(input.primaryTrim.endSeconds));
  args.push("-i", input.primaryInputPath);

  // Input 1: vídeo complementar (sempre embaixo). `-stream_loop` é uma
  // opção de INPUT e precisa vir antes do `-i` a que se aplica.
  if (needsLoop) {
    args.push("-stream_loop", "-1");
  }
  args.push("-ss", String(input.secondaryTrim.startSeconds), "-to", String(input.secondaryTrim.endSeconds));
  args.push("-i", input.secondaryInputPath);

  const filters: string[] = [
    `[0:v]scale=${width}:${topHeight}:force_original_aspect_ratio=increase,crop=${width}:${topHeight},setsar=1[top]`,
    `[1:v]scale=${width}:${bottomHeight}:force_original_aspect_ratio=increase,crop=${width}:${bottomHeight},setsar=1[bottom]`,
    `[top][bottom]vstack=inputs=2[vout]`,
  ];

  let audioMapArgs: string[] = [];
  if (input.audio.source === "both") {
    if (input.primaryHasAudio && input.secondaryHasAudio) {
      const primaryVolume = (input.audio.primaryVolumePercent ?? 100) / 100;
      const secondaryVolume = (input.audio.secondaryVolumePercent ?? 100) / 100;
      filters.push(`[0:a]volume=${primaryVolume}[a0]`);
      filters.push(`[1:a]volume=${secondaryVolume}[a1]`);
      filters.push(`[a0][a1]amix=inputs=2:duration=first[aout]`);
      audioMapArgs = ["-map", "[aout]"];
    } else if (input.primaryHasAudio) {
      // Só um dos dois tem trilha — cai para o que existe, em vez de
      // quebrar o grafo de filtros referenciando um stream inexistente.
      audioMapArgs = ["-map", "0:a"];
    } else if (input.secondaryHasAudio) {
      audioMapArgs = ["-map", "1:a"];
    } else {
      audioMapArgs = [];
    }
  } else if (input.audio.source === "primary") {
    audioMapArgs = ["-map", "0:a?"];
  } else {
    audioMapArgs = ["-map", "1:a?"];
  }

  args.push("-filter_complex", filters.join(";"));
  args.push("-map", "[vout]");
  args.push(...audioMapArgs);
  args.push("-t", String(outputDuration));
  args.push(
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
  );
  args.push(input.outputPath);

  return args;
}
