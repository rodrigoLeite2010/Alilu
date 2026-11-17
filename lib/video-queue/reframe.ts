/**
 * Adaptação para Reels (9:16) — plano puro e testável.
 *
 * Estratégia SEM distorção e SEM cortar o conteúdo: o vídeo inteiro é
 * reduzido para caber em 720×1280 e centralizado sobre um fundo feito do
 * próprio vídeo ampliado e desfocado (preserva o enquadramento importante,
 * diferente de um corte central). Duração acima do limite é encurtada.
 * O arquivo original nunca é alterado (o adaptado é um arquivo novo).
 */

export const REFRAME_WIDTH = 720;
export const REFRAME_HEIGHT = 1280;
const VERTICAL_RATIO = 9 / 16;
const RATIO_TOLERANCE = 0.02;

export interface ReframeInput {
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
}

export interface ReframeOptions {
  mode: "NONE" | "FIT_9_16";
  maxDurationSeconds: number | null;
}

export interface ReframePlan {
  reframe: boolean;
  trimToSeconds: number | null;
  reasons: string[];
}

/** null = nada a fazer (já 9:16 e dentro da duração, ou opção desligada). */
export function planReframe(input: ReframeInput, options: ReframeOptions): ReframePlan | null {
  const reasons: string[] = [];
  let reframe = false;
  if (options.mode === "FIT_9_16" && input.width && input.height) {
    const ratio = input.width / input.height;
    if (Math.abs(ratio - VERTICAL_RATIO) > RATIO_TOLERANCE) {
      reframe = true;
      reasons.push(`proporção ${input.width}×${input.height} → 9:16`);
    }
  }
  let trimToSeconds: number | null = null;
  if (options.maxDurationSeconds && input.durationSeconds && input.durationSeconds > options.maxDurationSeconds + 0.5) {
    trimToSeconds = options.maxDurationSeconds;
    reasons.push(`duração ${Math.round(input.durationSeconds)} s → ${options.maxDurationSeconds} s`);
  }
  if (!reframe && trimToSeconds === null) return null;
  return { reframe, trimToSeconds, reasons };
}

/** Argumentos do ffmpeg para o plano (MP4 H.264/AAC, faststart — compatível com Instagram e Facebook). */
export function buildReframeArgs(inputPath: string, outputPath: string, plan: ReframePlan): string[] {
  const args = ["-y", "-i", inputPath];
  if (plan.trimToSeconds) args.push("-t", String(plan.trimToSeconds));
  const w = REFRAME_WIDTH;
  const h = REFRAME_HEIGHT;
  const filter = plan.reframe
    ? `[0:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},boxblur=20:2[bg];` +
      `[0:v]scale=${w}:${h}:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1,fps=30[v]`
    : `[0:v]scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v]`;
  args.push(
    "-filter_complex",
    filter,
    "-map",
    "[v]",
    "-map",
    "0:a?",
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
    "-ar",
    "48000",
    "-movflags",
    "+faststart",
    outputPath,
  );
  return args;
}
