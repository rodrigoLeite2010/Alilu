import {
  isVideoInputBlobUrl,
  MAX_OUTPUT_DURATION_SECONDS,
} from "./config";
import type {
  VideoAudioConfig,
  VideoAudioSource,
  VideoDurationMode,
  VideoFraming,
  VideoOutputFormat,
  VideoSplitLayoutRatio,
  VideoTrimRange,
} from "./split-screen-ffmpeg";
import {
  VIDEO_FRAMING_MAX_POSITION,
  VIDEO_FRAMING_MAX_ZOOM,
  VIDEO_FRAMING_MIN_POSITION,
  VIDEO_FRAMING_MIN_ZOOM,
  VIDEO_LAYOUT_TOP_RATIO,
  VIDEO_OUTPUT_DIMENSIONS,
  computeOutputDurationSeconds,
} from "./split-screen-ffmpeg";

/**
 * Validação do corpo de POST /api/videos/split-screen. Lógica pura de
 * parsing manual (mesmo estilo de lib/lotteries/validation.ts) — o
 * projeto não usa uma lib de validação como zod de forma consistente, então
 * não introduzimos uma nova só para esta rota.
 *
 * IMPORTANTE: esta validação verifica a FORMA do corte (fim > início,
 * dentro de um teto de sanidade) mas nunca confia no valor de duração
 * calculado a partir dela como limite de abuso — o limite real
 * (MAX_OUTPUT_DURATION_SECONDS) só é aplicado aqui como uma pré-checagem
 * otimista (mensagem de erro cedo, sem baixar nada); a checagem que
 * realmente importa usa a duração REAL medida via ffprobe nos arquivos já
 * baixados (lib/videos/backend/video-processing-service.ts), porque o
 * cliente pode estar errado ou ser malicioso sobre a duração real do
 * arquivo que enviou.
 */

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

export const VIDEO_OUTPUT_FORMATS = Object.keys(VIDEO_OUTPUT_DIMENSIONS) as VideoOutputFormat[];
export const VIDEO_LAYOUT_RATIOS = Object.keys(VIDEO_LAYOUT_TOP_RATIO) as VideoSplitLayoutRatio[];
const VIDEO_DURATION_MODES: VideoDurationMode[] = ["loop", "shortest"];
const VIDEO_AUDIO_SOURCES: VideoAudioSource[] = ["primary", "secondary", "both"];

/** Teto de sanidade para qualquer limite de corte (1 hora) — não é o limite de duração do resultado (esse é MAX_OUTPUT_DURATION_SECONDS), só uma guarda contra valores absurdos chegando no FFmpeg como `-to`. */
const MAX_TRIM_BOUNDARY_SECONDS = 60 * 60;

export interface SplitScreenRequestTrimRange {
  /** Segundos, relativo ao início real do arquivo. */
  startSeconds: number;
  /**
   * Segundos, relativo ao início real do arquivo.
   * `null` significa "usar a duração real medida via ffprobe no servidor".
   */
  endSeconds: number | null;
}

export interface SplitScreenRequestBody {
  primaryBlobUrl: string;
  secondaryBlobUrl: string;
  outputFormat: VideoOutputFormat;
  layoutRatio: VideoSplitLayoutRatio;
  primaryTrim: SplitScreenRequestTrimRange;
  secondaryTrim: SplitScreenRequestTrimRange;
  primaryFraming?: VideoFraming;
  secondaryFraming?: VideoFraming;
  durationMode: VideoDurationMode;
  audio: VideoAudioConfig;
}

function parseBlobUrl(raw: unknown, label: string): ParseResult<string> {
  if (typeof raw !== "string" || !raw) {
    return { ok: false, error: `URL do ${label} ausente.` };
  }
  if (!isVideoInputBlobUrl(raw)) {
    return { ok: false, error: `URL do ${label} inválida.` };
  }
  return { ok: true, value: raw };
}

function parseTrim(raw: unknown, label: string): ParseResult<SplitScreenRequestTrimRange> {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: `Corte do ${label} inválido.` };
  }
  const value = raw as Record<string, unknown>;
  const startSeconds = value.startSeconds;
  const endSeconds = value.endSeconds;

  if (typeof startSeconds !== "number" || !Number.isFinite(startSeconds) || startSeconds < 0) {
    return { ok: false, error: `Início do corte do ${label} inválido.` };
  }
  if (endSeconds !== null && (typeof endSeconds !== "number" || !Number.isFinite(endSeconds))) {
    return { ok: false, error: `Fim do corte do ${label} inválido.` };
  }
  if (endSeconds !== null && endSeconds <= startSeconds) {
    return { ok: false, error: `O fim do corte do ${label} precisa ser depois do início.` };
  }
  if (endSeconds !== null && endSeconds > MAX_TRIM_BOUNDARY_SECONDS) {
    return { ok: false, error: `Corte do ${label} grande demais.` };
  }

  return { ok: true, value: { startSeconds, endSeconds } };
}

function parseVolumePercent(raw: unknown, label: string): ParseResult<number> {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0 || raw > 100) {
    return { ok: false, error: `Volume do ${label} inválido (0 a 100).` };
  }
  return { ok: true, value: raw };
}

function parseAudio(raw: unknown): ParseResult<VideoAudioConfig> {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "Configuração de áudio inválida." };
  }
  const value = raw as Record<string, unknown>;
  const source = value.source;
  if (typeof source !== "string" || !VIDEO_AUDIO_SOURCES.includes(source as VideoAudioSource)) {
    return { ok: false, error: "Fonte de áudio inválida." };
  }

  if (source !== "both") {
    return { ok: true, value: { source: source as VideoAudioSource } };
  }

  const primaryVolume = parseVolumePercent(value.primaryVolumePercent, "vídeo principal");
  if (!primaryVolume.ok) return primaryVolume;
  const secondaryVolume = parseVolumePercent(value.secondaryVolumePercent, "vídeo complementar");
  if (!secondaryVolume.ok) return secondaryVolume;

  return {
    ok: true,
    value: {
      source: "both",
      primaryVolumePercent: primaryVolume.value,
      secondaryVolumePercent: secondaryVolume.value,
    },
  };
}

function parseFraming(raw: unknown, label: string): ParseResult<VideoFraming | undefined> {
  if (raw === undefined) return { ok: true, value: undefined };
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: `Enquadramento do ${label} inválido.` };
  }
  const value = raw as Record<string, unknown>;
  const { positionX, positionY, zoom } = value;

  if (
    typeof positionX !== "number" ||
    !Number.isFinite(positionX) ||
    positionX < VIDEO_FRAMING_MIN_POSITION ||
    positionX > VIDEO_FRAMING_MAX_POSITION
  ) {
    return { ok: false, error: `Posição horizontal do ${label} inválida.` };
  }
  if (
    typeof positionY !== "number" ||
    !Number.isFinite(positionY) ||
    positionY < VIDEO_FRAMING_MIN_POSITION ||
    positionY > VIDEO_FRAMING_MAX_POSITION
  ) {
    return { ok: false, error: `Posição vertical do ${label} inválida.` };
  }
  if (typeof zoom !== "number" || !Number.isFinite(zoom) || zoom < VIDEO_FRAMING_MIN_ZOOM || zoom > VIDEO_FRAMING_MAX_ZOOM) {
    return { ok: false, error: `Zoom do ${label} inválido.` };
  }

  return { ok: true, value: { positionX, positionY, zoom } };
}

export function parseSplitScreenRequest(body: unknown): ParseResult<SplitScreenRequestBody> {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Dados inválidos." };
  }
  const raw = body as Record<string, unknown>;

  const primaryBlobUrl = parseBlobUrl(raw.primaryBlobUrl, "vídeo principal");
  if (!primaryBlobUrl.ok) return primaryBlobUrl;

  const secondaryBlobUrl = parseBlobUrl(raw.secondaryBlobUrl, "vídeo complementar");
  if (!secondaryBlobUrl.ok) return secondaryBlobUrl;

  const outputFormat = raw.outputFormat;
  if (typeof outputFormat !== "string" || !VIDEO_OUTPUT_FORMATS.includes(outputFormat as VideoOutputFormat)) {
    return { ok: false, error: "Formato de saída inválido." };
  }

  const layoutRatio = raw.layoutRatio;
  if (typeof layoutRatio !== "string" || !VIDEO_LAYOUT_RATIOS.includes(layoutRatio as VideoSplitLayoutRatio)) {
    return { ok: false, error: "Proporção de layout inválida." };
  }

  const durationMode = raw.durationMode;
  if (typeof durationMode !== "string" || !VIDEO_DURATION_MODES.includes(durationMode as VideoDurationMode)) {
    return { ok: false, error: "Modo de duração inválido." };
  }

  const primaryTrim = parseTrim(raw.primaryTrim, "vídeo principal");
  if (!primaryTrim.ok) return primaryTrim;

  const secondaryTrim = parseTrim(raw.secondaryTrim, "vídeo complementar");
  if (!secondaryTrim.ok) return secondaryTrim;

  const primaryFraming = parseFraming(raw.primaryFraming, "vídeo principal");
  if (!primaryFraming.ok) return primaryFraming;

  const secondaryFraming = parseFraming(raw.secondaryFraming, "vídeo complementar");
  if (!secondaryFraming.ok) return secondaryFraming;

  const audio = parseAudio(raw.audio);
  if (!audio.ok) return audio;

  if (primaryTrim.value.endSeconds !== null && secondaryTrim.value.endSeconds !== null) {
    const estimatedDuration = computeOutputDurationSeconds(
      primaryTrim.value as VideoTrimRange,
      secondaryTrim.value as VideoTrimRange,
      durationMode as VideoDurationMode,
    );
    if (estimatedDuration > MAX_OUTPUT_DURATION_SECONDS) {
      return {
        ok: false,
        error: `O resultado ficaria com ${Math.round(estimatedDuration)}s — o limite desta ferramenta é ${MAX_OUTPUT_DURATION_SECONDS}s.`,
      };
    }
  }

  return {
    ok: true,
    value: {
      primaryBlobUrl: primaryBlobUrl.value,
      secondaryBlobUrl: secondaryBlobUrl.value,
      outputFormat: outputFormat as VideoOutputFormat,
      layoutRatio: layoutRatio as VideoSplitLayoutRatio,
      primaryTrim: primaryTrim.value,
      secondaryTrim: secondaryTrim.value,
      primaryFraming: primaryFraming.value,
      secondaryFraming: secondaryFraming.value,
      durationMode: durationMode as VideoDurationMode,
      audio: audio.value,
    },
  };
}
