"use client";

import { useEffect, useId, useMemo, useRef, useState, type ChangeEvent } from "react";
import { uploadPresigned } from "@vercel/blob/client";
import { ArrowLeftRight, Download, Pause, Play, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  MAX_OUTPUT_DURATION_SECONDS,
  MAX_VIDEO_INPUT_BYTES,
  SATISFYING_PRESET,
  VIDEO_INPUT_CONTENT_TYPES,
  VIDEO_UPLOAD_PATH_PREFIX,
  isAllowedVideoInputContentType,
  sanitizeOriginalFilename,
} from "@/lib/videos/config";
import {
  VIDEO_LAYOUT_TOP_RATIO,
  VIDEO_OUTPUT_DIMENSIONS,
  computeOutputDurationSeconds,
  type VideoAudioSource,
  type VideoDurationMode,
  type VideoOutputFormat,
  type VideoSplitLayoutRatio,
} from "@/lib/videos/split-screen-ffmpeg";

/**
 * Editor de vídeo split-screen (Fase A). Envia os dois vídeos direto para
 * o Vercel Blob (mesma técnica de client upload já usada em
 * components/instagram/ReelsComposer.tsx) e chama
 * POST /api/videos/split-screen para gerar o resultado no servidor com
 * FFmpeg. Sem login — ferramenta pública.
 *
 * O preview (dois <video> nativos posicionados conforme o layout, tocados
 * em conjunto) é só uma aproximação: mostra a posição/proporção real, mas
 * nunca o resultado pixel-exato (cortes, loop e mix de áudio só existem de
 * verdade depois do processamento no servidor).
 */

type Stage = "idle" | "enviando" | "processando" | "sucesso" | "erro";

interface VideoSlotState {
  file: File | null;
  objectUrl: string | null;
  durationSeconds: number | null;
  trimStartText: string;
  trimEndText: string;
}

const EMPTY_SLOT: VideoSlotState = {
  file: null,
  objectUrl: null,
  durationSeconds: null,
  trimStartText: "00:00",
  trimEndText: "00:00",
};

const OUTPUT_FORMAT_OPTIONS: { value: VideoOutputFormat; label: string }[] = [
  { value: "vertical", label: "Vertical (9:16)" },
  { value: "square", label: "Quadrado (1:1)" },
  { value: "horizontal", label: "Horizontal (16:9)" },
];

const LAYOUT_RATIO_OPTIONS: { value: VideoSplitLayoutRatio; label: string }[] = [
  { value: "50-50", label: "50 / 50" },
  { value: "60-40", label: "60 / 40" },
  { value: "40-60", label: "40 / 60" },
];

const DURATION_MODE_OPTIONS: { value: VideoDurationMode; label: string; hint: string }[] = [
  { value: "loop", label: "Repetir em loop", hint: "O complementar repete até acompanhar o principal." },
  { value: "shortest", label: "Cortar no mais curto", hint: "O resultado dura o mesmo que o vídeo mais curto dos dois." },
];

const AUDIO_SOURCE_OPTIONS: { value: VideoAudioSource; label: string }[] = [
  { value: "primary", label: "Vídeo principal" },
  { value: "secondary", label: "Vídeo complementar" },
  { value: "both", label: "Ambos" },
];

const ACCEPT_ATTRIBUTE = VIDEO_INPUT_CONTENT_TYPES.join(",");
const MAX_INPUT_MEGABYTES = Math.round(MAX_VIDEO_INPUT_BYTES / (1024 * 1024));

/**
 * Não há como saber o progresso real do FFmpeg no servidor sem uma fila de
 * status (fora de escopo nesta fase — ver relatório). Simplificação
 * aceita: depois desse tempo de espera pela resposta da API, o texto do
 * estado "processando" muda de "Processando..." para "Finalizando..." —
 * só para dar uma sensação de progresso, sem porcentagem real.
 */
const PROCESSING_TO_FINALIZING_DELAY_MS = 8000;

function formatClock(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** Aceita "mm:ss" ou "m:ss" — devolve null se o formato não for reconhecido. */
function parseClock(text: string): number | null {
  const match = /^(\d{1,3}):([0-5]?\d)$/.exec(text.trim());
  if (!match) return null;
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  return minutes * 60 + seconds;
}

function buildUploadPathname(file: File): string {
  const uuid = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  return `${VIDEO_UPLOAD_PATH_PREFIX}${uuid}-${sanitizeOriginalFilename(file.name)}`;
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === "string" && body.error ? body.error : fallback;
  } catch {
    return fallback;
  }
}

/** Valida um corte (início/fim em texto "mm:ss") contra a duração real conhecida do vídeo. Retorna a mensagem de erro amigável, ou null se estiver tudo certo. */
function validateTrim(slot: VideoSlotState): string | null {
  if (!slot.file) return null;
  const start = parseClock(slot.trimStartText);
  const end = parseClock(slot.trimEndText);
  if (start === null || end === null) return "Use o formato mm:ss (ex.: 01:30).";
  if (end <= start) return "O fim do corte precisa ser depois do início.";
  if (slot.durationSeconds !== null && end > slot.durationSeconds + 0.5) {
    return `O vídeo enviado dura ${formatClock(slot.durationSeconds)} — o fim do corte não pode passar disso.`;
  }
  return null;
}

function VideoUploadSlot({
  label,
  testId,
  slot,
  onFileChange,
  onTrimStartChange,
  onTrimEndChange,
  trimError,
  disabled,
}: {
  label: string;
  testId: string;
  slot: VideoSlotState;
  onFileChange: (file: File | null) => void;
  onTrimStartChange: (text: string) => void;
  onTrimEndChange: (text: string) => void;
  trimError: string | null;
  disabled: boolean;
}) {
  const inputId = useId();
  const startId = useId();
  const endId = useId();
  const [localFileError, setLocalFileError] = useState<string | null>(null);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) return;

    if (!isAllowedVideoInputContentType(file.type)) {
      setLocalFileError("Formato não suportado. Envie um vídeo MP4, MOV ou WEBM.");
      onFileChange(null);
      return;
    }
    if (file.size > MAX_VIDEO_INPUT_BYTES) {
      setLocalFileError(`Esse vídeo é muito grande. Envie um arquivo de até ${MAX_INPUT_MEGABYTES} MB.`);
      onFileChange(null);
      return;
    }
    setLocalFileError(null);
    onFileChange(file);
  }

  return (
    <div data-testid={`video-slot-${testId}`} className="rounded-lg border border-zinc-200 bg-white p-4">
      <label htmlFor={inputId} className="text-sm font-semibold text-zinc-900">
        {label}
      </label>
      <input
        id={inputId}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        disabled={disabled}
        onChange={handleChange}
        className="mt-2 block w-full text-sm text-zinc-700 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-900 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
      />
      <p className="mt-1 text-xs text-zinc-500">MP4, MOV ou WEBM, até {MAX_INPUT_MEGABYTES} MB.</p>
      {localFileError ? <p role="alert" className="mt-1 text-xs text-red-700">{localFileError}</p> : null}

      {slot.file ? (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <p className="col-span-2 text-xs text-zinc-500">Arquivo selecionado: {slot.file.name}</p>
          <div>
            <label htmlFor={startId} className="block text-xs font-medium text-zinc-700">
              Início (mm:ss)
            </label>
            <input
              id={startId}
              value={slot.trimStartText}
              disabled={disabled}
              onChange={(event) => onTrimStartChange(event.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-zinc-300 px-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor={endId} className="block text-xs font-medium text-zinc-700">
              Fim (mm:ss)
            </label>
            <input
              id={endId}
              value={slot.trimEndText}
              disabled={disabled}
              onChange={(event) => onTrimEndChange(event.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-zinc-300 px-2 text-sm"
            />
          </div>
          {slot.durationSeconds !== null ? (
            <p className="col-span-2 text-xs text-zinc-500">Duração do arquivo enviado: {formatClock(slot.durationSeconds)}</p>
          ) : null}
          {trimError ? (
            <p role="alert" className="col-span-2 text-xs text-red-700">
              {trimError}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function VideoSplitScreenEditor() {
  const [primary, setPrimary] = useState<VideoSlotState>(EMPTY_SLOT);
  const [secondary, setSecondary] = useState<VideoSlotState>(EMPTY_SLOT);
  const [outputFormat, setOutputFormat] = useState<VideoOutputFormat>("vertical");
  const [layoutRatio, setLayoutRatio] = useState<VideoSplitLayoutRatio>("50-50");
  const [durationMode, setDurationMode] = useState<VideoDurationMode>("loop");
  const [audioSource, setAudioSource] = useState<VideoAudioSource>("primary");
  const [primaryVolumePercent, setPrimaryVolumePercent] = useState(100);
  const [secondaryVolumePercent, setSecondaryVolumePercent] = useState(100);
  const [stage, setStage] = useState<Stage>("idle");
  const [processingLabel, setProcessingLabel] = useState<"Processando..." | "Finalizando...">("Processando...");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);

  const primaryVideoRef = useRef<HTMLVideoElement>(null);
  const secondaryVideoRef = useRef<HTMLVideoElement>(null);

  const busy = stage === "enviando" || stage === "processando";

  useEffect(() => {
    return () => {
      if (primary.objectUrl) URL.revokeObjectURL(primary.objectUrl);
      if (secondary.objectUrl) URL.revokeObjectURL(secondary.objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só limpa as URLs criadas na desmontagem, não a cada troca (cada troca já revoga a anterior explicitamente).
  }, []);

  // Terceiro estado textual ("Finalizando...") do indicador de progresso —
  // ver PROCESSING_TO_FINALIZING_DELAY_MS acima. `processingLabel` volta a
  // "Processando..." no início de cada chamada (handleGenerate, ao entrar
  // no estágio "processando") — este efeito só agenda a troca posterior,
  // nunca chama setState de forma síncrona no corpo do efeito.
  useEffect(() => {
    if (stage !== "processando") return;
    const timeoutId = window.setTimeout(() => {
      setProcessingLabel("Finalizando...");
    }, PROCESSING_TO_FINALIZING_DELAY_MS);
    return () => window.clearTimeout(timeoutId);
  }, [stage]);

  function replaceSlotFile(
    setter: (updater: (previous: VideoSlotState) => VideoSlotState) => void,
    file: File | null,
  ) {
    setter((previous) => {
      if (previous.objectUrl) URL.revokeObjectURL(previous.objectUrl);
      if (!file) return { ...EMPTY_SLOT };
      return {
        file,
        objectUrl: URL.createObjectURL(file),
        durationSeconds: null,
        trimStartText: "00:00",
        trimEndText: "00:00",
      };
    });
    setStage("idle");
    setErrorMessage(null);
    setResultUrl(null);
  }

  function handleLoadedMetadata(
    setter: (updater: (previous: VideoSlotState) => VideoSlotState) => void,
    durationSeconds: number,
  ) {
    setter((previous) => ({
      ...previous,
      durationSeconds,
      trimEndText: previous.trimEndText === "00:00" ? formatClock(durationSeconds) : previous.trimEndText,
    }));
  }

  function handleSwap() {
    setPrimary(secondary);
    setSecondary(primary);
    setStage("idle");
    setErrorMessage(null);
    setResultUrl(null);
  }

  function applySatisfyingPreset() {
    setOutputFormat(SATISFYING_PRESET.outputFormat);
    setLayoutRatio(SATISFYING_PRESET.layoutRatio);
    setDurationMode(SATISFYING_PRESET.durationMode);
    setAudioSource(SATISFYING_PRESET.audioSource);
  }

  const primaryTrimError = validateTrim(primary);
  const secondaryTrimError = validateTrim(secondary);

  const primaryTrimSeconds = useMemo(() => {
    const start = parseClock(primary.trimStartText);
    const end = parseClock(primary.trimEndText);
    return start !== null && end !== null && end > start ? end - start : null;
  }, [primary.trimStartText, primary.trimEndText]);

  const secondaryTrimSeconds = useMemo(() => {
    const start = parseClock(secondary.trimStartText);
    const end = parseClock(secondary.trimEndText);
    return start !== null && end !== null && end > start ? end - start : null;
  }, [secondary.trimStartText, secondary.trimEndText]);

  const estimatedOutputDuration =
    primaryTrimSeconds !== null && secondaryTrimSeconds !== null
      ? computeOutputDurationSeconds(
          { startSeconds: 0, endSeconds: primaryTrimSeconds },
          { startSeconds: 0, endSeconds: secondaryTrimSeconds },
          durationMode,
        )
      : null;

  const exceedsMaxDuration = estimatedOutputDuration !== null && estimatedOutputDuration > MAX_OUTPUT_DURATION_SECONDS;

  const canGenerate =
    Boolean(primary.file) &&
    Boolean(secondary.file) &&
    !primaryTrimError &&
    !secondaryTrimError &&
    !exceedsMaxDuration &&
    !busy;

  const dimensions = VIDEO_OUTPUT_DIMENSIONS[outputFormat];
  const topRatio = VIDEO_LAYOUT_TOP_RATIO[layoutRatio];

  function togglePreviewPlayback() {
    const primaryEl = primaryVideoRef.current;
    const secondaryEl = secondaryVideoRef.current;
    if (!primaryEl || !secondaryEl) return;

    if (isPreviewPlaying) {
      primaryEl.pause();
      secondaryEl.pause();
      setIsPreviewPlaying(false);
    } else {
      void primaryEl.play();
      void secondaryEl.play();
      setIsPreviewPlaying(true);
    }
  }

  async function handleGenerate() {
    if (!canGenerate || !primary.file || !secondary.file) return;

    setErrorMessage(null);
    setResultUrl(null);
    setStage("enviando");

    try {
      const [primaryUpload, secondaryUpload] = await Promise.all([
        uploadPresigned(buildUploadPathname(primary.file), primary.file, {
          access: "public",
          handleUploadUrl: "/api/videos/upload",
          clientPayload: JSON.stringify({
            originalFilename: primary.file.name,
            fileSizeBytes: primary.file.size,
            contentType: primary.file.type,
          }),
        }),
        uploadPresigned(buildUploadPathname(secondary.file), secondary.file, {
          access: "public",
          handleUploadUrl: "/api/videos/upload",
          clientPayload: JSON.stringify({
            originalFilename: secondary.file.name,
            fileSizeBytes: secondary.file.size,
            contentType: secondary.file.type,
          }),
        }),
      ]);

      setStage("processando");
      setProcessingLabel("Processando...");

      const audio =
        audioSource === "both"
          ? { source: "both" as const, primaryVolumePercent, secondaryVolumePercent }
          : { source: audioSource };

      const response = await fetch("/api/videos/split-screen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primaryBlobUrl: primaryUpload.url,
          secondaryBlobUrl: secondaryUpload.url,
          outputFormat,
          layoutRatio,
          primaryTrim: { startSeconds: parseClock(primary.trimStartText), endSeconds: parseClock(primary.trimEndText) },
          secondaryTrim: {
            startSeconds: parseClock(secondary.trimStartText),
            endSeconds: parseClock(secondary.trimEndText),
          },
          durationMode,
          audio,
        }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Não foi possível gerar o vídeo."));
      }

      const data = (await response.json()) as { url: string };
      setResultUrl(data.url);
      setStage("sucesso");
    } catch (error) {
      setStage("erro");
      setErrorMessage(error instanceof Error ? error.message : "Erro inesperado ao gerar o vídeo.");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button type="button" variant="secondary" onClick={applySatisfyingPreset} disabled={busy}>
            <Sparkles className="size-4" aria-hidden />
            Preset: Vídeo satisfatório
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={handleSwap}
            disabled={busy || (!primary.file && !secondary.file)}
          >
            <ArrowLeftRight className="size-4" aria-hidden />
            Trocar vídeos
          </Button>
        </div>

        <VideoUploadSlot
          label="Vídeo principal (fica em cima)"
          testId="primary"
          slot={primary}
          onFileChange={(file) => replaceSlotFile(setPrimary, file)}
          onTrimStartChange={(text) => setPrimary((previous) => ({ ...previous, trimStartText: text }))}
          onTrimEndChange={(text) => setPrimary((previous) => ({ ...previous, trimEndText: text }))}
          trimError={primaryTrimError}
          disabled={busy}
        />

        <VideoUploadSlot
          label="Vídeo complementar (fica embaixo)"
          testId="secondary"
          slot={secondary}
          onFileChange={(file) => replaceSlotFile(setSecondary, file)}
          onTrimStartChange={(text) => setSecondary((previous) => ({ ...previous, trimStartText: text }))}
          onTrimEndChange={(text) => setSecondary((previous) => ({ ...previous, trimEndText: text }))}
          trimError={secondaryTrimError}
          disabled={busy}
        />

        <div className="rounded-lg border border-zinc-200 bg-zinc-950 p-3">
          <p className="mb-2 text-xs text-zinc-400">
            Pré-visualização aproximada — o resultado final (corte, loop e áudio) só existe depois de gerar o vídeo.
          </p>
          <div
            className="relative mx-auto flex max-h-[70vh] flex-col overflow-hidden bg-black"
            style={{ aspectRatio: `${dimensions.width} / ${dimensions.height}`, width: outputFormat === "horizontal" ? "100%" : "auto" }}
          >
            <div style={{ height: `${topRatio * 100}%` }} className="relative overflow-hidden bg-zinc-900">
              {primary.objectUrl ? (
                <video
                  ref={primaryVideoRef}
                  data-testid="preview-video-primary"
                  src={primary.objectUrl}
                  muted
                  playsInline
                  onLoadedMetadata={(event) => handleLoadedMetadata(setPrimary, event.currentTarget.duration)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-zinc-500">
                  Vídeo principal
                </div>
              )}
            </div>
            <div style={{ height: `${(1 - topRatio) * 100}%` }} className="relative overflow-hidden bg-zinc-900">
              {secondary.objectUrl ? (
                <video
                  ref={secondaryVideoRef}
                  data-testid="preview-video-secondary"
                  src={secondary.objectUrl}
                  muted
                  loop
                  playsInline
                  onLoadedMetadata={(event) => handleLoadedMetadata(setSecondary, event.currentTarget.duration)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-zinc-500">
                  Vídeo complementar
                </div>
              )}
            </div>
          </div>
          {primary.objectUrl && secondary.objectUrl ? (
            <Button type="button" variant="secondary" className="mt-3" onClick={togglePreviewPlayback}>
              {isPreviewPlaying ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
              {isPreviewPlaying ? "Pausar prévia" : "Reproduzir prévia"}
            </Button>
          ) : null}
        </div>
      </section>

      <aside className="space-y-4 rounded-lg border border-teal-200 bg-teal-50/50 p-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Configurações</h2>
        </div>

        <fieldset>
          <legend className="text-sm font-medium text-zinc-800">Formato de saída</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {OUTPUT_FORMAT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                disabled={busy}
                onClick={() => setOutputFormat(option.value)}
                aria-pressed={outputFormat === option.value}
                className={`min-h-9 rounded-md px-3 text-sm font-medium transition-colors ${
                  outputFormat === option.value ? "bg-zinc-900 text-white" : "bg-white text-zinc-700 ring-1 ring-inset ring-zinc-300"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-medium text-zinc-800">Proporção do split (principal / complementar)</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {LAYOUT_RATIO_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                disabled={busy}
                onClick={() => setLayoutRatio(option.value)}
                aria-pressed={layoutRatio === option.value}
                className={`min-h-9 rounded-md px-3 text-sm font-medium transition-colors ${
                  layoutRatio === option.value ? "bg-zinc-900 text-white" : "bg-white text-zinc-700 ring-1 ring-inset ring-zinc-300"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-medium text-zinc-800">Quando o complementar for mais curto</legend>
          <div className="mt-2 space-y-2">
            {DURATION_MODE_OPTIONS.map((option) => (
              <label key={option.value} className="flex items-start gap-2 text-sm text-zinc-700">
                <input
                  type="radio"
                  name="duration-mode"
                  checked={durationMode === option.value}
                  disabled={busy}
                  onChange={() => setDurationMode(option.value)}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium text-zinc-900">{option.label}</span>
                  <span className="block text-xs text-zinc-500">{option.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-medium text-zinc-800">Áudio</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {AUDIO_SOURCE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                disabled={busy}
                onClick={() => setAudioSource(option.value)}
                aria-pressed={audioSource === option.value}
                className={`min-h-9 rounded-md px-3 text-sm font-medium transition-colors ${
                  audioSource === option.value ? "bg-zinc-900 text-white" : "bg-white text-zinc-700 ring-1 ring-inset ring-zinc-300"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          {audioSource === "both" ? (
            <div className="mt-3 space-y-3">
              <label className="block text-xs font-medium text-zinc-700">
                Volume do principal: {primaryVolumePercent}%
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={primaryVolumePercent}
                  disabled={busy}
                  onChange={(event) => setPrimaryVolumePercent(Number(event.target.value))}
                  className="mt-1 w-full"
                />
              </label>
              <label className="block text-xs font-medium text-zinc-700">
                Volume do complementar: {secondaryVolumePercent}%
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={secondaryVolumePercent}
                  disabled={busy}
                  onChange={(event) => setSecondaryVolumePercent(Number(event.target.value))}
                  className="mt-1 w-full"
                />
              </label>
            </div>
          ) : null}
        </fieldset>

        {estimatedOutputDuration !== null ? (
          <p className={`text-xs ${exceedsMaxDuration ? "text-red-700" : "text-zinc-600"}`}>
            Duração estimada do resultado: {formatClock(estimatedOutputDuration)}
            {exceedsMaxDuration ? ` — acima do limite de ${MAX_OUTPUT_DURATION_SECONDS}s desta ferramenta.` : "."}
          </p>
        ) : null}

        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <p>
            Os vídeos enviados são usados só para gerar o resultado e os arquivos originais são apagados do servidor
            logo após o processamento. Cada vídeo pode ter até {MAX_INPUT_MEGABYTES} MB, e o resultado final tem no
            máximo {MAX_OUTPUT_DURATION_SECONDS} segundos.
          </p>
        </div>

        <Button type="button" data-testid="generate-button" className="w-full" disabled={!canGenerate} onClick={() => void handleGenerate()}>
          {stage === "enviando" ? "Enviando vídeos..." : stage === "processando" ? processingLabel : "Gerar vídeo"}
        </Button>

        {busy ? (
          <p role="status" className="rounded-md bg-white px-3 py-2 text-sm text-teal-800">
            {stage === "enviando" ? "Enviando vídeos..." : `${processingLabel} Isso pode levar até um minuto.`}
          </p>
        ) : null}

        {stage === "erro" && errorMessage ? (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </p>
        ) : null}

        {stage === "sucesso" && resultUrl ? (
          <div className="space-y-3 rounded-md bg-white p-3">
            <video data-testid="result-video" src={resultUrl} controls playsInline className="w-full rounded-md bg-black" />
            <a
              href={resultUrl}
              download
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800"
            >
              <Download className="size-4" aria-hidden />
              Baixar vídeo
            </a>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
