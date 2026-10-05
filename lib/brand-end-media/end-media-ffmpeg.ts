/**
 * Argumentos do FFmpeg para o encerramento padrão — funções PURAS
 * (testáveis sem rodar o FFmpeg). Padrão de saída comum a todos os
 * trechos, para a emenda nunca falhar por formato diferente:
 * H.264 / yuv420p / 30 fps / SAR 1 / AAC 48 kHz estéreo (com trilha de
 * silêncio quando não há áudio).
 */

export const END_MEDIA_FPS = 30;
export const END_MEDIA_AUDIO_RATE = 48_000;

export interface OutputSize {
  width: number;
  height: number;
}

/** Encaixa sem cortar (letterbox): o encerramento nunca perde o logo/texto nas bordas. */
export function fitPadFilter(size: OutputSize): string {
  return [
    `scale=${size.width}:${size.height}:force_original_aspect_ratio=decrease`,
    `pad=${size.width}:${size.height}:(ow-iw)/2:(oh-ih)/2:color=black`,
    "setsar=1",
    `fps=${END_MEDIA_FPS}`,
    "format=yuv420p",
  ].join(",");
}

/** Mesma normalização para o vídeo principal, mas preenchendo a tela (cobre e corta o excesso). */
export function coverFilter(size: OutputSize): string {
  return [
    `scale=${size.width}:${size.height}:force_original_aspect_ratio=increase`,
    `crop=${size.width}:${size.height}`,
    "setsar=1",
    `fps=${END_MEDIA_FPS}`,
    "format=yuv420p",
  ].join(",");
}

const AUDIO_FORMAT = `aresample=${END_MEDIA_AUDIO_RATE},aformat=sample_fmts=fltp:channel_layouts=stereo`;

export const ENCODE_ARGS = [
  "-c:v", "libx264", "-preset", "ultrafast", "-crf", "22", "-pix_fmt", "yuv420p",
  "-r", String(END_MEDIA_FPS),
  "-c:a", "aac", "-b:a", "128k", "-ar", String(END_MEDIA_AUDIO_RATE), "-ac", "2",
  "-movflags", "+faststart",
];

function round(value: number): string {
  return (Math.round(value * 1000) / 1000).toString();
}

export interface NormalizeEndClipInput {
  inputPath: string;
  outputPath: string;
  kind: "VIDEO" | "IMAGE";
  size: OutputSize;
  /** IMAGEM: duração do trecho. VÍDEO: limite opcional (null = duração original). */
  durationSeconds: number | null;
  /** Só para vídeo: duração real do arquivo (para calcular o fade e o limite). */
  sourceDurationSeconds: number | null;
  sourceHasAudio: boolean;
  keepAudio: boolean;
  fadeSeconds: number;
}

/** Duração final do trecho de encerramento. */
export function endClipDuration(input: Pick<NormalizeEndClipInput, "kind" | "durationSeconds" | "sourceDurationSeconds">): number {
  if (input.kind === "IMAGE") return Math.max(0.5, input.durationSeconds ?? 3);
  const source = input.sourceDurationSeconds ?? input.durationSeconds ?? 3;
  return Math.max(0.5, input.durationSeconds ? Math.min(source, input.durationSeconds) : source);
}

/**
 * Gera o trecho de encerramento já no padrão de emenda (pré-normalizado e
 * guardado em cache). Imagem → vídeo de N segundos. Fade-in curto opcional.
 */
export function buildNormalizeEndClipArgs(input: NormalizeEndClipInput): string[] {
  const duration = endClipDuration(input);
  const args = ["-y", "-hide_banner", "-loglevel", "error"];
  if (input.kind === "IMAGE") {
    args.push("-loop", "1", "-framerate", String(END_MEDIA_FPS), "-t", round(duration), "-i", input.inputPath);
  } else {
    args.push("-t", round(duration), "-i", input.inputPath);
  }
  const useSourceAudio = input.kind === "VIDEO" && input.keepAudio && input.sourceHasAudio;
  if (!useSourceAudio) {
    args.push("-f", "lavfi", "-t", round(duration), "-i", `anullsrc=r=${END_MEDIA_AUDIO_RATE}:cl=stereo`);
  }
  const fade = input.fadeSeconds > 0 ? `,fade=t=in:st=0:d=${round(Math.min(input.fadeSeconds, duration / 2))}` : "";
  const filters = [`[0:v]${fitPadFilter(input.size)}${fade}[v]`, `[${useSourceAudio ? "0:a" : "1:a"}]${AUDIO_FORMAT}[a]`];
  args.push("-filter_complex", filters.join(";"), "-map", "[v]", "-map", "[a]", "-t", round(duration), ...ENCODE_ARGS, input.outputPath);
  return args;
}

export interface AppendEndClipInput {
  mainPath: string;
  mainDurationSeconds: number;
  mainHasAudio: boolean;
  /** Trecho de encerramento JÁ normalizado (buildNormalizeEndClipArgs) no mesmo tamanho. */
  endClipPath: string;
  endClipDurationSeconds: number;
  size: OutputSize;
  fadeSeconds: number;
  outputPath: string;
}

/**
 * Reel/Piloto: vídeo principal (normalizado para o tamanho do Reel) +
 * encerramento → um MP4. O encerramento entra DEPOIS, nunca por cima.
 */
export function buildAppendEndClipArgs(input: AppendEndClipInput): string[] {
  const mainDuration = Math.max(0.1, input.mainDurationSeconds);
  const args = ["-y", "-hide_banner", "-loglevel", "error", "-i", input.mainPath, "-i", input.endClipPath];
  if (!input.mainHasAudio) {
    args.push("-f", "lavfi", "-t", round(mainDuration), "-i", `anullsrc=r=${END_MEDIA_AUDIO_RATE}:cl=stereo`);
  }
  const fadeOut =
    input.fadeSeconds > 0 && mainDuration > input.fadeSeconds * 2
      ? `,fade=t=out:st=${round(mainDuration - input.fadeSeconds)}:d=${round(input.fadeSeconds)}`
      : "";
  const mainAudio = input.mainHasAudio ? "[0:a]" : "[2:a]";
  const filters = [
    `[0:v]trim=duration=${round(mainDuration)},setpts=PTS-STARTPTS,${coverFilter(input.size)}${fadeOut}[v0]`,
    `${mainAudio}atrim=duration=${round(mainDuration)},asetpts=PTS-STARTPTS,${AUDIO_FORMAT}[a0]`,
    `[1:v]setsar=1,fps=${END_MEDIA_FPS},format=yuv420p[v1]`,
    `[1:a]${AUDIO_FORMAT}[a1]`,
    `[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]`,
  ];
  args.push(
    "-filter_complex", filters.join(";"),
    "-map", "[v]", "-map", "[a]",
    "-t", round(mainDuration + input.endClipDurationSeconds),
    ...ENCODE_ARGS,
    input.outputPath,
  );
  return args;
}

/** Chave do cache: muda quando o arquivo do encerramento ou qualquer opção que afeta o vídeo muda. */
export function endClipCacheKey(input: {
  assetId: string;
  size: OutputSize;
  kind: "VIDEO" | "IMAGE";
  durationSeconds: number | null;
  keepAudio: boolean;
  fadeSeconds: number;
}): string {
  return [
    input.assetId,
    `${input.size.width}x${input.size.height}`,
    input.kind,
    `d${input.durationSeconds ?? "orig"}`,
    input.keepAudio ? "audio" : "mute",
    `f${input.fadeSeconds}`,
  ].join(":");
}
