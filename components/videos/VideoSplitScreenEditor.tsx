"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type PointerEvent,
  type SyntheticEvent,
} from "react";
import { useRouter } from "next/navigation";
import { uploadPresigned } from "@vercel/blob/client";
import {
  RELOADED_DURING_PICKER_MESSAGE,
  checkReloadDuringPicker,
  clearPickerMark,
  markPickerOpen,
  trackUpload,
} from "@/lib/client/upload-telemetry";
import { ArrowLeftRight, Download, Move, Pause, Play, RotateCcw, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConnectInstagramDialog, buildConnectTarget } from "@/components/instagram/ConnectInstagramDialog";
import { getBrowserTimeZone } from "@/lib/instagram/schedule-time";
import {
  describePublishOutcome,
  fetchAccountStatus,
  type AccountStatus,
  type PublishOutcome,
} from "@/lib/instagram/client/publication-api";
import { buildMediaPathnamePrefix, MAX_VIDEO_UPLOAD_BYTES } from "@/lib/instagram/backend/media-service";
import {
  MAX_OUTPUT_DURATION_SECONDS,
  MAX_VIDEO_INPUT_BYTES,
  SATISFYING_PRESET,
  VIDEO_INPUT_FILE_EXTENSIONS,
  VIDEO_INPUT_CONTENT_TYPES,
  VIDEO_UPLOAD_PATH_PREFIX,
  inferVideoInputContentTypeFromFilename,
  isAllowedVideoInputContentType,
  sanitizeOriginalFilename,
} from "@/lib/videos/config";
import {
  VIDEO_LAYOUT_TOP_RATIO,
  VIDEO_OUTPUT_DIMENSIONS,
  DEFAULT_VIDEO_FRAMING,
  VIDEO_FRAMING_MAX_ZOOM,
  VIDEO_FRAMING_MIN_ZOOM,
  computeVideoFramingLayout,
  computeOutputDurationSeconds,
  type VideoAudioSource,
  type VideoDurationMode,
  type VideoFraming,
  type VideoOutputFormat,
  type VideoSplitLayoutRatio,
} from "@/lib/videos/split-screen-ffmpeg";
import { importIdFromLocation, loadImportedVideoFile } from "@/components/instagram-import/imported-media-client";

/**
 * Editor de vídeo split-screen (Fase A). Envia os dois vídeos direto para
 * o Vercel Blob (mesma técnica de client upload já usada em
 * components/instagram/ReelsComposer.tsx) e chama
 * POST /api/videos/split-screen para gerar o resultado no servidor com
 * FFmpeg. Sem login — ferramenta pública.
 *
 * O preview usa a mesma regra de cover + enquadramento normalizado que o
 * filtro de vídeo. Loop, corte temporal e mix de áudio só existem de
 * verdade depois do processamento no servidor.
 */

type Stage = "idle" | "enviando" | "processando" | "sucesso" | "erro";
type PublishStage = "idle" | "baixando" | "enviando" | "salvando" | "publicando" | "sucesso" | "erro";

interface VideoSlotState {
  file: File | null;
  objectUrl: string | null;
  durationSeconds: number | null;
  videoWidth: number | null;
  videoHeight: number | null;
  trimStartText: string;
  trimEndText: string;
}

const EMPTY_SLOT: VideoSlotState = {
  file: null,
  objectUrl: null,
  durationSeconds: null,
  videoWidth: null,
  videoHeight: null,
  trimStartText: "00:00",
  trimEndText: "",
};

type VideoSlotKey = "primary" | "secondary";

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

// "video/*" abre a galeria certa no Android/iPhone; a validação (tipo ou extensão) continua abaixo.
const ACCEPT_ATTRIBUTE = ["video/*", ...VIDEO_INPUT_CONTENT_TYPES, ...VIDEO_INPUT_FILE_EXTENSIONS].join(",");
const MAX_INPUT_MEGABYTES = Math.round(MAX_VIDEO_INPUT_BYTES / (1024 * 1024));
const SPLIT_SCREEN_RESULT_DRAFT_KEY = "alilu.videos.splitScreenResult.v1";

/**
 * Não há como saber o progresso real do FFmpeg no servidor sem uma fila de
 * status (fora de escopo nesta fase — ver relatório). Simplificação
 * aceita: depois desse tempo de espera pela resposta da API, o texto do
 * estado "processando" muda de "Processando..." para "Finalizando..." —
 * só para dar uma sensação de progresso, sem porcentagem real.
 */
const PROCESSING_TO_FINALIZING_DELAY_MS = 8000;
const FRAMING_STEP = 0.05;

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

function normalizeVideoInputFile(file: File): File | null {
  const inferredType = inferVideoInputContentTypeFromFilename(file.name);
  if (isAllowedVideoInputContentType(file.type)) return file;
  if (!inferredType) return null;
  return new File([file], file.name, {
    type: inferredType,
    lastModified: file.lastModified,
  });
}

function clampFramingPosition(value: number): number {
  return Math.min(1, Math.max(-1, value));
}

function clampFramingZoom(value: number): number {
  return Math.min(VIDEO_FRAMING_MAX_ZOOM, Math.max(VIDEO_FRAMING_MIN_ZOOM, value));
}

function zoomPercent(zoom: number): string {
  return `${Math.round(zoom * 100)}%`;
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === "string" && body.error ? body.error : fallback;
  } catch {
    return fallback;
  }
}

function buildResultFilename(prefix = "alilu-split-screen"): string {
  return `${prefix}-${Date.now()}.mp4`;
}

function triggerBrowserDownload(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

async function fetchResultVideoBlob(resultUrl: string): Promise<Blob> {
  const response = await fetch(resultUrl);
  if (!response.ok) {
    throw new Error("Não foi possível buscar o vídeo gerado. Tente gerar novamente.");
  }
  const blob = await response.blob();
  return blob.type ? blob : new Blob([blob], { type: "video/mp4" });
}

async function uploadGeneratedVideoToInstagramMedia(userId: string, blob: Blob): Promise<string> {
  if (blob.size > MAX_VIDEO_UPLOAD_BYTES) {
    throw new Error("O vídeo gerado ficou grande demais para publicar no Instagram por este fluxo.");
  }
  const filename = buildResultFilename("split-screen");
  const uploaded = await uploadPresigned(`${buildMediaPathnamePrefix(userId)}${filename}`, blob, {
    access: "public",
    handleUploadUrl: "/api/instagram/media/upload",
    clientPayload: JSON.stringify({
      originalFilename: filename,
      fileSizeBytes: blob.size,
      contentType: "video/mp4",
    }),
  });
  return uploaded.url;
}

/** Valida um corte (início/fim em texto "mm:ss") contra a duração real conhecida do vídeo. Retorna a mensagem de erro amigável, ou null se estiver tudo certo. */
function validateTrim(slot: VideoSlotState): string | null {
  if (!slot.file) return null;
  const start = parseClock(slot.trimStartText);
  if (start === null) return "Use o formato mm:ss (ex.: 01:30).";
  if (slot.durationSeconds === null && !slot.trimEndText.trim()) return null;
  const end = parseClock(slot.trimEndText);
  if (end === null) return "Use o formato mm:ss (ex.: 01:30).";
  if (slot.durationSeconds === null && end === 0) return null;
  if (end <= start) return "O fim do corte precisa ser depois do início.";
  if (slot.durationSeconds !== null && end > slot.durationSeconds + 0.5) {
    return `O vídeo enviado dura ${formatClock(slot.durationSeconds)} — o fim do corte não pode passar disso.`;
  }
  return null;
}

function shouldUseAutomaticTrimEnd(slot: VideoSlotState): boolean {
  return Boolean(slot.file) && slot.durationSeconds === null && (!slot.trimEndText.trim() || parseClock(slot.trimEndText) === 0);
}

function buildRequestTrim(slot: VideoSlotState): { startSeconds: number; endSeconds: number | null } {
  return {
    startSeconds: parseClock(slot.trimStartText) ?? 0,
    endSeconds: shouldUseAutomaticTrimEnd(slot) ? null : parseClock(slot.trimEndText),
  };
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
    clearPickerMark();
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      trackUpload("split-screen", "no_file");
      return;
    }
    const normalizedFile = normalizeVideoInputFile(file);

    if (!normalizedFile) {
      event.target.value = "";
      trackUpload("split-screen", "validation_error", { file, message: "formato" });
      setLocalFileError(
        `Formato não suportado${file.type ? ` (${file.type})` : ""}. Envie um vídeo MP4, MOV ou WEBM — no celular, grave com a câmera padrão ou exporte como MP4.`,
      );
      onFileChange(null);
      return;
    }
    if (file.size > MAX_VIDEO_INPUT_BYTES) {
      event.target.value = "";
      trackUpload("split-screen", "validation_error", { file, message: "tamanho" });
      setLocalFileError(
        `Esse vídeo tem ${(file.size / 1024 / 1024).toFixed(0)} MB e o limite é ${MAX_INPUT_MEGABYTES} MB. Corte o vídeo ou grave em resolução menor (1080p) e tente de novo.`,
      );
      onFileChange(null);
      return;
    }
    trackUpload("split-screen", "file_selected", { file });
    setLocalFileError(null);
    onFileChange(normalizedFile);
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
        onClick={(event) => {
          event.currentTarget.value = "";
          markPickerOpen("split-screen");
        }}
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
              placeholder={slot.durationSeconds === null ? "Automático" : "00:05"}
              disabled={disabled}
              onChange={(event) => onTrimEndChange(event.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-zinc-300 px-2 text-sm"
            />
          </div>
          {slot.durationSeconds !== null ? (
            <p className="col-span-2 text-xs text-zinc-500">Duração do arquivo enviado: {formatClock(slot.durationSeconds)}</p>
          ) : shouldUseAutomaticTrimEnd(slot) ? (
            <p className="col-span-2 text-xs text-zinc-500">
              O vídeo será usado inteiro; a duração será confirmada no servidor.
            </p>
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

function FramingPreviewPane({
  slotKey,
  label,
  objectUrl,
  videoWidth,
  videoHeight,
  regionWidth,
  regionHeight,
  framing,
  selected,
  onSelect,
  onFramingChange,
  videoRef,
  loop,
  onLoadedMetadata,
}: {
  slotKey: VideoSlotKey;
  label: string;
  objectUrl: string | null;
  videoWidth: number | null;
  videoHeight: number | null;
  regionWidth: number;
  regionHeight: number;
  framing: VideoFraming;
  selected: boolean;
  onSelect: () => void;
  onFramingChange: (framing: VideoFraming) => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  loop?: boolean;
  onLoadedMetadata: (event: SyntheticEvent<HTMLVideoElement>) => void;
}) {
  const dragRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startPositionX: number;
    startPositionY: number;
    width: number;
    height: number;
  } | null>(null);

  const [previewFailed, setPreviewFailed] = useState(false);
  const hasSize = Boolean(videoWidth && videoHeight);
  const layout =
    hasSize && videoWidth !== null && videoHeight !== null
      ? computeVideoFramingLayout({ width: videoWidth, height: videoHeight }, { width: regionWidth, height: regionHeight }, framing)
      : null;

  useEffect(() => {
    if (!objectUrl) return;
    videoRef.current?.load();
  }, [objectUrl, videoRef]);

  // Novo arquivo: zera o aviso de prévia (ajuste de estado durante a renderização, sem efeito).
  const [previewFor, setPreviewFor] = useState(objectUrl);
  if (previewFor !== objectUrl) {
    setPreviewFor(objectUrl);
    setPreviewFailed(false);
  }

  function updatePosition(positionX: number, positionY: number) {
    onFramingChange({
      ...framing,
      positionX: clampFramingPosition(positionX),
      positionY: clampFramingPosition(positionY),
    });
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!objectUrl || !layout) return;
    onSelect();
    event.currentTarget.setPointerCapture(event.pointerId);
    const bounds = event.currentTarget.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPositionX: framing.positionX,
      startPositionY: framing.positionY,
      width: bounds.width,
      height: bounds.height,
    };
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!dragRef.current || !layout) return;
    event.preventDefault();
    const drag = dragRef.current;
    const maxOffsetX = (layout.maxOffsetX / regionWidth) * drag.width;
    const maxOffsetY = (layout.maxOffsetY / regionHeight) * drag.height;
    const deltaX = maxOffsetX > 0 ? -(event.clientX - drag.startClientX) / maxOffsetX : 0;
    const deltaY = maxOffsetY > 0 ? -(event.clientY - drag.startClientY) / maxOffsetY : 0;
    updatePosition(drag.startPositionX + deltaX, drag.startPositionY + deltaY);
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!objectUrl) return;
    const horizontal = event.key === "ArrowLeft" ? -FRAMING_STEP : event.key === "ArrowRight" ? FRAMING_STEP : 0;
    const vertical = event.key === "ArrowUp" ? -FRAMING_STEP : event.key === "ArrowDown" ? FRAMING_STEP : 0;
    if (horizontal === 0 && vertical === 0) return;
    event.preventDefault();
    onSelect();
    updatePosition(framing.positionX + horizontal, framing.positionY + vertical);
  }

  const videoStyle =
    layout && objectUrl
      ? {
          width: `${(layout.renderedWidth / regionWidth) * 100}%`,
          height: `${(layout.renderedHeight / regionHeight) * 100}%`,
          left: `${((regionWidth - layout.renderedWidth) / 2 - layout.offsetX) / regionWidth * 100}%`,
          top: `${((regionHeight - layout.renderedHeight) / 2 - layout.offsetY) / regionHeight * 100}%`,
        }
      : undefined;

  return (
    <div
      role="button"
      tabIndex={objectUrl ? 0 : -1}
      aria-label={`Editar enquadramento: ${label}`}
      data-testid={`framing-pane-${slotKey}`}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={`relative h-full overflow-hidden bg-zinc-900 outline-none touch-none ${
        objectUrl ? "cursor-grab active:cursor-grabbing" : ""
      } ${selected ? "ring-2 ring-teal-300 ring-inset" : "ring-1 ring-white/10 ring-inset"}`}
    >
      {objectUrl ? (
        <>
          <video
            ref={videoRef}
            data-testid={`preview-video-${slotKey}`}
            src={objectUrl}
            muted
            loop={loop}
            playsInline
            preload="metadata"
            onLoadedMetadata={(event) => {
              setPreviewFailed(false);
              onLoadedMetadata(event);
            }}
            onDurationChange={onLoadedMetadata}
            onError={() => {
              // Comum no celular com vídeo HEVC/H.265: o navegador não mostra a prévia, mas o servidor ainda converte.
              setPreviewFailed(true);
              trackUpload("split-screen", "metadata_error", { message: `preview ${slotKey}` });
            }}
            className={layout ? "absolute max-w-none select-none" : "h-full w-full object-cover"}
            style={videoStyle}
          />
          <div className="pointer-events-none absolute left-2 top-2 inline-flex items-center gap-1 rounded bg-black/60 px-2 py-1 text-[11px] font-medium text-white">
            <Move className="size-3" aria-hidden />
            Arraste para ajustar
          </div>
          {previewFailed ? (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/90 p-3 text-center text-xs text-white">
              Este navegador não conseguiu mostrar a prévia (comum com vídeo HEVC do celular). Você ainda pode gerar — o Alilu converte no
              servidor.
            </div>
          ) : null}
        </>
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs text-zinc-500">{label}</div>
      )}
    </div>
  );
}

function readStoredResultDraft(): { resultUrl: string; caption: string } | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(SPLIT_SCREEN_RESULT_DRAFT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { resultUrl?: unknown; caption?: unknown };
    if (typeof parsed.resultUrl !== "string" || !parsed.resultUrl) return null;
    return { resultUrl: parsed.resultUrl, caption: typeof parsed.caption === "string" ? parsed.caption : "" };
  } catch {
    window.sessionStorage.removeItem(SPLIT_SCREEN_RESULT_DRAFT_KEY);
    return null;
  }
}

export function VideoSplitScreenEditor({
  userId,
  instagramConnected = null,
  igUsername = null,
}: {
  userId: string | null;
  instagramConnected?: boolean | null;
  igUsername?: string | null;
}) {
  const router = useRouter();
  const captionId = useId();
  const [storedDraft] = useState(readStoredResultDraft);
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
  const [resultUrl, setResultUrl] = useState<string | null>(storedDraft?.resultUrl ?? null);
  const [caption, setCaption] = useState(storedDraft?.caption ?? "");
  const [publishStage, setPublishStage] = useState<PublishStage>("idle");
  const [publishMessage, setPublishMessage] = useState<string | null>(
    storedDraft ? "Vídeo restaurado. Revise a legenda e publique quando quiser." : null,
  );
  const [gateOpen, setGateOpen] = useState(false);
  const [accountStatus, setAccountStatus] = useState<AccountStatus | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [activeFramingSlot, setActiveFramingSlot] = useState<VideoSlotKey>("primary");
  const [primaryFraming, setPrimaryFraming] = useState<VideoFraming>(DEFAULT_VIDEO_FRAMING);
  const [secondaryFraming, setSecondaryFraming] = useState<VideoFraming>(DEFAULT_VIDEO_FRAMING);

  const [uploadPercent, setUploadPercent] = useState(0);
  const primaryVideoRef = useRef<HTMLVideoElement>(null);
  const secondaryVideoRef = useRef<HTMLVideoElement>(null);

  const busy = stage === "enviando" || stage === "processando";
  const publishBusy =
    publishStage === "baixando" || publishStage === "enviando" || publishStage === "salvando" || publishStage === "publicando";
  const effectiveUserId = accountStatus?.userId ?? userId;
  const isInstagramConnected = accountStatus?.connected ?? instagramConnected;
  const effectiveIgUsername = accountStatus?.username ?? igUsername;

  // Celular com pouca memória: a página recarregou enquanto a galeria estava aberta.
  useEffect(() => {
    if (!checkReloadDuringPicker("split-screen")) return;
    const timer = window.setTimeout(() => {
      setErrorMessage(RELOADED_DURING_PICKER_MESSAGE);
      setStage("erro");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchAccountStatus()
      .then((status) => {
        if (!cancelled) setAccountStatus(status);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

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
    resetFraming: () => void,
  ) {
    setter((previous) => {
      if (previous.objectUrl) URL.revokeObjectURL(previous.objectUrl);
      if (!file) return { ...EMPTY_SLOT };
      return {
        file,
        objectUrl: URL.createObjectURL(file),
        durationSeconds: null,
        videoWidth: null,
        videoHeight: null,
        trimStartText: "00:00",
        trimEndText: "",
      };
    });
    setStage("idle");
    setErrorMessage(null);
    setResultUrl(null);
    setPublishStage("idle");
    setPublishMessage(null);
    resetFraming();
  }

  // Veio de "Importar do Instagram" (?importacao=<id>): já carrega o vídeo importado como vídeo principal.
  useEffect(() => {
    const importId = importIdFromLocation();
    if (!importId) return;
    let cancelled = false;
    loadImportedVideoFile(importId)
      .then((file) => {
        if (!cancelled && file) replaceSlotFile(setPrimary, file, () => setPrimaryFraming(DEFAULT_VIDEO_FRAMING));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []); // roda uma única vez, ao abrir a tela

  function handleLoadedMetadata(
    setter: (updater: (previous: VideoSlotState) => VideoSlotState) => void,
    durationSeconds: number,
    videoWidth: number,
    videoHeight: number,
  ) {
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return;
    setter((previous) => ({
      ...previous,
      durationSeconds,
      videoWidth,
      videoHeight,
      trimEndText: previous.trimEndText === "" || previous.trimEndText === "00:00" ? formatClock(durationSeconds) : previous.trimEndText,
    }));
  }

  function handleSwap() {
    setPrimary(secondary);
    setSecondary(primary);
    setPrimaryFraming(secondaryFraming);
    setSecondaryFraming(primaryFraming);
    setActiveFramingSlot((previous) => (previous === "primary" ? "secondary" : "primary"));
    setStage("idle");
    setErrorMessage(null);
    setResultUrl(null);
    setPublishStage("idle");
    setPublishMessage(null);
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
  const topHeight = Math.round((dimensions.height * topRatio) / 2) * 2;
  const bottomHeight = dimensions.height - topHeight;
  const activeFraming = activeFramingSlot === "primary" ? primaryFraming : secondaryFraming;
  const setActiveFraming = activeFramingSlot === "primary" ? setPrimaryFraming : setSecondaryFraming;

  function resetActiveFraming() {
    setActiveFraming(DEFAULT_VIDEO_FRAMING);
  }

  function updateActiveZoom(zoom: number) {
    setActiveFraming((previous) => ({ ...previous, zoom: clampFramingZoom(zoom) }));
  }

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
    setUploadPercent(0);

    const totalBytes = primary.file.size + secondary.file.size;
    const loaded = { primary: 0, secondary: 0 };
    const reportProgress = (key: "primary" | "secondary", bytes: number) => {
      loaded[key] = bytes;
      setUploadPercent(Math.min(100, Math.round(((loaded.primary + loaded.secondary) / Math.max(totalBytes, 1)) * 100)));
    };
    const uploadOne = async (key: "primary" | "secondary", file: File) => {
      trackUpload("split-screen", "upload_start", { file });
      try {
        const result = await uploadPresigned(buildUploadPathname(file), file, {
          access: "public",
          handleUploadUrl: "/api/videos/upload",
          clientPayload: JSON.stringify({ originalFilename: file.name, fileSizeBytes: file.size, contentType: file.type }),
          onUploadProgress: ({ loaded: bytes }) => reportProgress(key, bytes),
        });
        trackUpload("split-screen", "upload_done", { file });
        return result;
      } catch (error) {
        trackUpload("split-screen", "upload_error", { file, message: error instanceof Error ? error.message : "erro" });
        throw new Error(
          `Não foi possível enviar o vídeo ${key === "primary" ? "principal" : "complementar"}. Confira a conexão (Wi-Fi/4G) e tente de novo.`,
        );
      }
    };

    try {
      const [primaryUpload, secondaryUpload] = await Promise.all([uploadOne("primary", primary.file), uploadOne("secondary", secondary.file)]);

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
          primaryTrim: buildRequestTrim(primary),
          secondaryTrim: buildRequestTrim(secondary),
          primaryFraming,
          secondaryFraming,
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
      setPublishStage("idle");
      setPublishMessage(null);
      window.sessionStorage.removeItem(SPLIT_SCREEN_RESULT_DRAFT_KEY);
    } catch (error) {
      setStage("erro");
      setErrorMessage(error instanceof Error ? error.message : "Erro inesperado ao gerar o vídeo.");
    }
  }

  async function handleDownloadResult() {
    if (!resultUrl) return;
    try {
      const blob = await fetchResultVideoBlob(resultUrl);
      triggerBrowserDownload(blob, buildResultFilename());
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível baixar o vídeo.");
      setStage("erro");
    }
  }

  function requireInstagramConnection(): boolean {
    if (effectiveUserId && isInstagramConnected !== false) return true;
    setGateOpen(true);
    return false;
  }

  function goConnectInstagram() {
    if (resultUrl) {
      window.sessionStorage.setItem(SPLIT_SCREEN_RESULT_DRAFT_KEY, JSON.stringify({ resultUrl, caption }));
    }
    router.push(buildConnectTarget(Boolean(effectiveUserId), "/videos/editor-split-screen?continuar=1"));
  }

  async function handlePublishReel() {
    if (!resultUrl || publishBusy) return;
    if (!requireInstagramConnection()) return;

    try {
      setPublishMessage(null);
      setPublishStage("baixando");
      const blob = await fetchResultVideoBlob(resultUrl);
      setPublishStage("enviando");
      const mediaUrl = await uploadGeneratedVideoToInstagramMedia(effectiveUserId as string, blob);

      setPublishStage("salvando");
      const createResponse = await fetch("/api/instagram/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postType: "reels",
          mediaUrl,
          caption: caption.trim(),
          scheduledAt: null,
          timezone: getBrowserTimeZone(),
        }),
      });
      if (!createResponse.ok) {
        throw new Error(await readErrorMessage(createResponse, "Não foi possível criar o Reel."));
      }
      const { postId } = (await createResponse.json()) as { postId: string };

      setPublishStage("publicando");
      const publishResponse = await fetch(`/api/instagram/posts/${postId}/publish`, { method: "POST" });
      if (!publishResponse.ok) {
        throw new Error(await readErrorMessage(publishResponse, "Não foi possível publicar o Reel."));
      }
      const { status } = (await publishResponse.json()) as { status: PublishOutcome };
      setPublishStage("sucesso");
      setPublishMessage(
        status === "PUBLISHED"
          ? "Reel publicado com sucesso."
          : status === "PROCESSING"
            ? "O Instagram ainda está processando o vídeo. A publicação será concluída automaticamente — acompanhe em Minhas publicações."
            : describePublishOutcome(status),
      );
      window.sessionStorage.removeItem(SPLIT_SCREEN_RESULT_DRAFT_KEY);
    } catch (error) {
      setPublishStage("erro");
      setPublishMessage(error instanceof Error ? error.message : "Erro inesperado ao publicar no Instagram.");
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
          onFileChange={(file) => replaceSlotFile(setPrimary, file, () => setPrimaryFraming(DEFAULT_VIDEO_FRAMING))}
          onTrimStartChange={(text) => setPrimary((previous) => ({ ...previous, trimStartText: text }))}
          onTrimEndChange={(text) => setPrimary((previous) => ({ ...previous, trimEndText: text }))}
          trimError={primaryTrimError}
          disabled={busy}
        />

        <VideoUploadSlot
          label="Vídeo complementar (fica embaixo)"
          testId="secondary"
          slot={secondary}
          onFileChange={(file) => replaceSlotFile(setSecondary, file, () => setSecondaryFraming(DEFAULT_VIDEO_FRAMING))}
          onTrimStartChange={(text) => setSecondary((previous) => ({ ...previous, trimStartText: text }))}
          onTrimEndChange={(text) => setSecondary((previous) => ({ ...previous, trimEndText: text }))}
          trimError={secondaryTrimError}
          disabled={busy}
        />

        <div className="rounded-lg border border-zinc-200 bg-zinc-950 p-3">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-white">Enquadramento</h2>
              <p className="text-xs text-zinc-400">Arraste cada vídeo para escolher a área visível.</p>
            </div>
            <p className="rounded bg-zinc-900 px-2 py-1 text-xs text-zinc-300">
              Editando: {activeFramingSlot === "primary" ? "Vídeo principal" : "Vídeo complementar"}
            </p>
          </div>
          <div
            className="relative mx-auto flex max-h-[70vh] flex-col overflow-hidden bg-black"
            style={{ aspectRatio: `${dimensions.width} / ${dimensions.height}`, width: outputFormat === "horizontal" ? "100%" : "auto" }}
          >
            <div style={{ height: `${topRatio * 100}%` }}>
              <FramingPreviewPane
                slotKey="primary"
                label="Vídeo principal"
                objectUrl={primary.objectUrl}
                videoWidth={primary.videoWidth}
                videoHeight={primary.videoHeight}
                regionWidth={dimensions.width}
                regionHeight={topHeight}
                framing={primaryFraming}
                selected={activeFramingSlot === "primary"}
                onSelect={() => setActiveFramingSlot("primary")}
                onFramingChange={setPrimaryFraming}
                videoRef={primaryVideoRef}
                onLoadedMetadata={(event) =>
                  handleLoadedMetadata(
                    setPrimary,
                    event.currentTarget.duration,
                    event.currentTarget.videoWidth,
                    event.currentTarget.videoHeight,
                  )
                }
              />
            </div>
            <div style={{ height: `${(1 - topRatio) * 100}%` }}>
              <FramingPreviewPane
                slotKey="secondary"
                label="Vídeo complementar"
                objectUrl={secondary.objectUrl}
                videoWidth={secondary.videoWidth}
                videoHeight={secondary.videoHeight}
                regionWidth={dimensions.width}
                regionHeight={bottomHeight}
                framing={secondaryFraming}
                selected={activeFramingSlot === "secondary"}
                onSelect={() => setActiveFramingSlot("secondary")}
                onFramingChange={setSecondaryFraming}
                videoRef={secondaryVideoRef}
                loop
                onLoadedMetadata={(event) =>
                  handleLoadedMetadata(
                    setSecondary,
                    event.currentTarget.duration,
                    event.currentTarget.videoWidth,
                    event.currentTarget.videoHeight,
                  )
                }
              />
            </div>
          </div>
          <div className="mt-3 rounded-md bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-zinc-900">
                Zoom do {activeFramingSlot === "primary" ? "principal" : "complementar"}: {zoomPercent(activeFraming.zoom)}
              </p>
              <Button type="button" variant="secondary" onClick={resetActiveFraming} disabled={busy}>
                <RotateCcw className="size-4" aria-hidden />
                Centralizar
              </Button>
            </div>
            <div className="mt-3 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
              <Button type="button" variant="secondary" onClick={() => updateActiveZoom(activeFraming.zoom - 0.1)} disabled={busy}>
                -
              </Button>
              <input
                aria-label="Zoom do enquadramento"
                type="range"
                min={VIDEO_FRAMING_MIN_ZOOM}
                max={VIDEO_FRAMING_MAX_ZOOM}
                step={0.05}
                value={activeFraming.zoom}
                disabled={busy}
                onChange={(event) => updateActiveZoom(Number(event.target.value))}
                className="w-full"
              />
              <Button type="button" variant="secondary" onClick={() => updateActiveZoom(activeFraming.zoom + 0.1)} disabled={busy}>
                +
              </Button>
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
          {stage === "enviando" ? `Enviando vídeos… ${uploadPercent}%` : stage === "processando" ? processingLabel : "Gerar vídeo"}
        </Button>

        {busy ? (
          <p role="status" className="rounded-md bg-white px-3 py-2 text-sm text-teal-800">
            {stage === "enviando"
              ? `Enviando vídeos… ${uploadPercent}% (no celular pode levar alguns minutos — mantenha esta tela aberta)`
              : `${processingLabel} Isso pode levar até um minuto.`}
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
            <button
              type="button"
              onClick={() => void handleDownloadResult()}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800"
            >
              <Download className="size-4" aria-hidden />
              Baixar vídeo
            </button>
            <div className="space-y-3 border-t border-zinc-200 pt-3">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                  <Send className="size-4" aria-hidden />
                  Publicar no Instagram
                </h3>
                <p className="mt-1 text-xs text-zinc-500">
                  {isInstagramConnected && effectiveIgUsername ? `Conta conectada: @${effectiveIgUsername}` : "Conecte sua conta na hora de publicar."}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  aria-pressed="true"
                  className="min-h-9 rounded-md bg-zinc-900 px-3 text-sm font-medium text-white"
                >
                  Reels
                </button>
                <button
                  type="button"
                  disabled
                  title="Stories com vídeo ainda não estão liberados neste publicador."
                  className="min-h-9 rounded-md bg-zinc-100 px-3 text-sm font-medium text-zinc-400 ring-1 ring-inset ring-zinc-200"
                >
                  Story
                </button>
              </div>

              <label htmlFor={captionId} className="block text-sm font-medium text-zinc-800">
                Legenda do Reel
              </label>
              <textarea
                id={captionId}
                value={caption}
                disabled={publishBusy}
                onChange={(event) => setCaption(event.target.value)}
                rows={4}
                placeholder="Escreva a legenda antes de publicar..."
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />

              <Button type="button" className="w-full" disabled={publishBusy} onClick={() => void handlePublishReel()}>
                {publishStage === "baixando"
                  ? "Preparando vídeo..."
                  : publishStage === "enviando"
                    ? "Enviando vídeo..."
                    : publishStage === "salvando"
                      ? "Salvando Reel..."
                      : publishStage === "publicando"
                        ? "Publicando..."
                        : "Publicar no Reels"}
              </Button>

              <p className="text-xs text-zinc-500">
                Story com vídeo ainda não está disponível neste fluxo; por enquanto, publique o resultado como Reel.
              </p>

              {publishMessage ? (
                <p
                  role={publishStage === "erro" ? "alert" : "status"}
                  className={
                    publishStage === "erro"
                      ? "rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
                      : "rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-800"
                  }
                >
                  {publishMessage}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </aside>
      <ConnectInstagramDialog
        open={gateOpen}
        authenticated={Boolean(effectiveUserId)}
        onClose={() => setGateOpen(false)}
        onConnect={goConnectInstagram}
      />
    </div>
  );
}
