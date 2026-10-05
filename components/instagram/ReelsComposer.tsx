"use client";

import { useEffect, useId, useMemo, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { clearPickerMark, markPickerOpen, trackUpload } from "@/lib/client/upload-telemetry";
import { FileNotReadableError, readFailureReason, createStallGuard, ensureReadableFile } from "@/lib/client/file-readability";
import { classifyUploadError, describeUploadError, uploadPresignedResilient } from "@/lib/client/blob-upload";
import { VideoEndMediaToggle } from "@/components/brand-end-media/VideoEndMediaToggle";
import { applyEndMediaToReel } from "@/lib/brand-end-media/end-media-client";
import { Button } from "@/components/ui/Button";
import { getBrowserTimeZone } from "@/lib/instagram/schedule-time";
import { loadLocalValue, saveLocalValue } from "@/lib/instagram/draft-store";
import {
  describePublishOutcome,
  fetchAccountStatus,
  type PublishOutcome,
  type PostMusicSelectionBody,
} from "@/lib/instagram/client/publication-api";
import { ConnectInstagramDialog, buildConnectTarget } from "./ConnectInstagramDialog";
import { buildMediaPathnamePrefix, MAX_VIDEO_UPLOAD_BYTES, VIDEO_MEDIA_CONTENT_TYPES } from "@/lib/instagram/backend/media-service";
import type { MusicMode } from "@/lib/instagram/backend/music-support";
import { MusicSelector, type MusicSelectorAccountDefault } from "./MusicSelector";
import { importIdFromLocation, loadImportedVideoFile } from "@/components/instagram-import/imported-media-client";

type Stage = "idle" | "validando" | "enviando" | "encerramento" | "salvando" | "publicando" | "sucesso" | "erro";
type ActionMode = "draft" | "now" | "schedule";

const DRAFT_KEY = "alilu.instagram.reelsDraft.v1";
const MAX_REEL_DURATION_SECONDS = 15 * 60;
const MIN_REEL_DURATION_SECONDS = 3;
const EMPTY_DRAFT = { caption: "", hashtags: "", scheduledAt: "" };

function readStoredReelsDraft(): typeof EMPTY_DRAFT {
  if (typeof window === "undefined") return EMPTY_DRAFT;
  const saved = window.sessionStorage.getItem(DRAFT_KEY);
  if (!saved) return EMPTY_DRAFT;
  try {
    const draft = JSON.parse(saved) as { caption?: unknown; hashtags?: unknown; scheduledAt?: unknown };
    return {
      caption: typeof draft.caption === "string" ? draft.caption : "",
      hashtags: typeof draft.hashtags === "string" ? draft.hashtags : "",
      scheduledAt: typeof draft.scheduledAt === "string" ? draft.scheduledAt : "",
    };
  } catch {
    window.sessionStorage.removeItem(DRAFT_KEY);
    return EMPTY_DRAFT;
  }
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === "string" && body.error ? body.error : fallback;
  } catch {
    return fallback;
  }
}

function slugFileName(name: string): string {
  const extension = name.toLowerCase().endsWith(".mov") ? "mov" : "mp4";
  const base = name
    .replace(/\.[^.]+$/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 60);
  return `${base || "reel"}-${Date.now()}.${extension}`;
}

export function ReelsComposer({
  userId,
  instagramConnected = null,
  igUsername = null,
}: {
  userId: string | null;
  /** null = não sabemos (sem login ou banco indisponível). */
  instagramConnected?: boolean | null;
  igUsername?: string | null;
}) {
  const router = useRouter();
  const videoId = useId();
  const captionId = useId();
  const hashtagsId = useId();
  const scheduleId = useId();

  const [initialDraft] = useState(readStoredReelsDraft);

  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [caption, setCaption] = useState(initialDraft.caption);
  const [hashtags, setHashtags] = useState(initialDraft.hashtags);
  const [scheduledAt, setScheduledAt] = useState(initialDraft.scheduledAt);
  const [stage, setStage] = useState<Stage>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [gateOpen, setGateOpen] = useState(false);
  const [accountDefaultMusic, setAccountDefaultMusic] = useState<MusicSelectorAccountDefault | undefined>(undefined);
  const [musicMode, setMusicMode] = useState<MusicMode>("ACCOUNT_DEFAULT");
  const [musicSelection, setMusicSelection] = useState<PostMusicSelectionBody | null>(null);
  const [endMediaWanted, setEndMediaWanted] = useState<boolean | undefined>(undefined);
  /** Encerramento falhou: guarda o vídeo já enviado para "Publicar sem encerramento" / "Tentar novamente". */
  const [endMediaFailure, setEndMediaFailure] = useState<{ mode: "draft" | "now" | "schedule"; scheduledAtIso: string | null; mediaUrl: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAccountStatus()
      .then((status) => {
        if (!cancelled && status.defaultMusic) setAccountDefaultMusic(status.defaultMusic);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // Volta do login/conexão: restaura o vídeo guardado no navegador (a legenda
  // já volta pelo rascunho da aba).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("continuar") !== "1") return;
    let cancelled = false;
    loadLocalValue<{ video: Blob | null; name: string | null }>("reel").then((stored) => {
      if (cancelled || !stored?.video) return;
      setFile(new File([stored.video], stored.name ?? "reel.mp4", { type: stored.video.type || "video/mp4" }));
      setStage("sucesso");
      setMessage(
        params.get("status") === "conectado"
          ? "Instagram conectado! Seu vídeo e sua legenda foram restaurados — agora é só publicar ou agendar."
          : "Seu vídeo e sua legenda foram restaurados.",
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Veio de "Importar do Instagram" (?importacao=<id>): já carrega o vídeo importado.
  useEffect(() => {
    const importId = importIdFromLocation();
    if (!importId) return;
    let cancelled = false;
    loadImportedVideoFile(importId)
      .then((imported) => {
        if (cancelled || !imported) return;
        setFile(imported);
        setMessage("Vídeo importado carregado. Escreva a legenda e publique ou agende.");
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const [uploadPercent, setUploadPercent] = useState(0);
  const busy = stage === "validando" || stage === "enviando" || stage === "encerramento" || stage === "salvando" || stage === "publicando";
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function persistDraftForRedirect() {
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ caption, hashtags, scheduledAt }));
  }

  /** Login e Instagram conectado só são exigidos aqui, ao salvar/publicar/agendar. */
  function requireLogin(): boolean {
    if (userId && instagramConnected !== false) return true;
    setGateOpen(true);
    return false;
  }

  async function goConnect() {
    persistDraftForRedirect();
    try {
      await saveLocalValue("reel", { video: file, name: file?.name ?? null });
    } catch {
      // sem espaço no navegador: a legenda continua salva; o vídeo é escolhido de novo
    }
    router.push(buildConnectTarget(Boolean(userId), "/instagram/reels?continuar=1"));
  }

  function handleVideoChange(event: ChangeEvent<HTMLInputElement>) {
    clearPickerMark();
    const picked = event.target.files?.[0] ?? null;
    // Celular: galeria às vezes manda o vídeo sem tipo — deduz pela extensão.
    const lower = picked?.name.toLowerCase() ?? "";
    const inferred = lower.endsWith(".mov") ? "video/quicktime" : lower.endsWith(".mp4") ? "video/mp4" : null;
    const nextFile = picked && !picked.type && inferred ? new File([picked], picked.name, { type: inferred, lastModified: picked.lastModified }) : picked;
    trackUpload("reels", nextFile ? "file_selected" : "no_file", { file: nextFile });
    setFile(nextFile);
    if (nextFile) {
      // Celular: confirma que o vídeo pode ser lido (e copia para a memória quando cabe).
      ensureReadableFile(nextFile)
        .then((readable) => setFile((current) => (current === nextFile ? readable : current)))
        .catch((error: unknown) => {
          trackUpload("reels", "validation_error", { file: nextFile, message: `arquivo ilegível: ${readFailureReason(error)}` });
          setFile(null);
          setStage("erro");
          setMessage(error instanceof FileNotReadableError ? error.message : "Não foi possível abrir esse vídeo. Tente outro arquivo.");
        });
    }
    setDuration(null);
    setMessage(null);
    setStage("idle");
  }

  async function validateVideo(): Promise<void> {
    if (!file) throw new Error("Escolha um vídeo para criar o Reel.");
    if (!VIDEO_MEDIA_CONTENT_TYPES.includes(file.type)) {
      trackUpload("reels", "validation_error", { file, message: "formato" });
      throw new Error(`Use um vídeo MP4 ou MOV${file.type ? ` (este é ${file.type})` : ""}. Recomendação: vertical 9:16, com áudio AAC quando houver som.`);
    }
    if (file.size > MAX_VIDEO_UPLOAD_BYTES) {
      trackUpload("reels", "validation_error", { file, message: "tamanho" });
      throw new Error(`O vídeo tem ${(file.size / 1024 / 1024).toFixed(0)} MB; o limite é 250 MB. Grave em 1080p ou corte o vídeo.`);
    }
    if (duration !== null && (duration < MIN_REEL_DURATION_SECONDS || duration > MAX_REEL_DURATION_SECONDS)) {
      throw new Error("O vídeo precisa ter entre 3 segundos e 15 minutos para Reels.");
    }
  }

  async function runFlow(mode: ActionMode) {
    if (busy) return;
    if (!requireLogin()) return;

    let scheduledAtIso: string | null = null;
    if (mode === "schedule") {
      if (!scheduledAt) {
        setStage("erro");
        setMessage("Escolha uma data e horário para agendar.");
        return;
      }
      const parsed = new Date(scheduledAt);
      if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) {
        setStage("erro");
        setMessage("A data de agendamento precisa ser no futuro.");
        return;
      }
      scheduledAtIso = parsed.toISOString();
    }

    try {
      setStage("validando");
      await validateVideo();

      const selectedFile = file as File;
      setStage("enviando");
      setUploadPercent(0);
      const fileName = slugFileName(selectedFile.name);
      trackUpload("reels", "upload_start", { file: selectedFile });
      const guard = createStallGuard(60_000);
      const uploaded = await uploadPresignedResilient(`${buildMediaPathnamePrefix(userId as string)}${fileName}`, selectedFile, {
        abortSignal: guard.signal,
        access: "public",
        handleUploadUrl: "/api/instagram/media/upload",
        clientPayload: JSON.stringify({
          originalFilename: fileName,
          fileSizeBytes: selectedFile.size,
          contentType: selectedFile.type,
        }),
        onUploadProgress: ({ percentage }) => {
          guard.touch();
          setUploadPercent(Math.round(percentage));
        },
      }, {
        onFallback: (firstError) => {
          guard.done();
          trackUpload("reels", "upload_fallback", { file: selectedFile, message: firstError });
        },
      })
        .then((outcome) => outcome.result)
        .catch((error: unknown) => {
          const code = classifyUploadError(error);
          trackUpload("reels", "upload_error", { file: selectedFile, message: guard.stalled() ? "parado sem progresso (60s)" : `${code}: ${error instanceof Error ? error.message : "erro"}` });
          throw new Error(
            guard.stalled()
              ? "O envio do vídeo parou. Escolha o vídeo de novo (de preferência salvo no aparelho) e tente outra vez."
              : describeUploadError(code, "vídeo"),
          );
        })
        .finally(() => guard.done());
      trackUpload("reels", "upload_done", { file: selectedFile });
      await finishWithEndMedia(mode, scheduledAtIso, uploaded.url, endMediaWanted === true);
    } catch (error) {
      setStage("erro");
      setMessage(error instanceof Error ? error.message : "Erro inesperado ao preparar o Reel.");
    }
  }

  /** Encerramento (opcional) + criação do post. O vídeo já está no Blob. */
  async function finishWithEndMedia(mode: "draft" | "now" | "schedule", scheduledAtIso: string | null, mediaUrl: string, applyEnd: boolean): Promise<void> {
    setEndMediaFailure(null);
    let finalUrl = mediaUrl;
    let endMediaRenderId: string | null = null;
    if (applyEnd) {
      setStage("encerramento");
      try {
        const applied = await applyEndMediaToReel(mediaUrl);
        finalUrl = applied.mediaUrl;
        endMediaRenderId = applied.renderId;
      } catch (error) {
        setStage("erro");
        setMessage(error instanceof Error ? error.message : "Não foi possível adicionar o encerramento padrão.");
        setEndMediaFailure({ mode, scheduledAtIso, mediaUrl });
        return;
      }
    }
    try {
      const fullCaption = [caption.trim(), hashtags.trim()].filter(Boolean).join("\n\n");
      setStage("salvando");
      const createResponse = await fetch("/api/instagram/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postType: "reels",
          mediaUrl: finalUrl,
          ...(endMediaRenderId ? { endMediaRenderId } : {}),
          caption: fullCaption,
          scheduledAt: scheduledAtIso,
          timezone: getBrowserTimeZone(),
          musicMode,
          musicSelection,
        }),
      });
      if (!createResponse.ok) {
        throw new Error(await readErrorMessage(createResponse, "Não foi possível salvar o Reel."));
      }
      const { postId } = (await createResponse.json()) as { postId: string };

      if (mode === "draft" || mode === "schedule") {
        setStage("sucesso");
        setMessage(mode === "draft" ? "Rascunho salvo em Minhas publicações." : "Reel agendado em Minhas publicações.");
        window.sessionStorage.removeItem(DRAFT_KEY);
        return;
      }

      setStage("publicando");
      const publishResponse = await fetch(`/api/instagram/posts/${postId}/publish`, { method: "POST" });
      if (!publishResponse.ok) {
        throw new Error(await readErrorMessage(publishResponse, "Não foi possível publicar o Reel."));
      }
      const { status } = (await publishResponse.json()) as { status: PublishOutcome };
      setStage("sucesso");
      setMessage(
        status === "PUBLISHED"
          ? "Reel publicado com sucesso."
          : status === "PROCESSING"
            ? "O Instagram ainda está processando o vídeo. A publicação será concluída automaticamente — acompanhe em Minhas publicações."
            : describePublishOutcome(status),
      );
      window.sessionStorage.removeItem(DRAFT_KEY);
    } catch (error) {
      setStage("erro");
      setMessage(error instanceof Error ? error.message : "Erro inesperado ao preparar o Reel.");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section className="space-y-4">
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <label htmlFor={videoId} className="text-sm font-medium text-zinc-800">
            Vídeo do Reel
          </label>
          <input
            id={videoId}
            type="file"
            accept="video/*,video/mp4,video/quicktime,.mp4,.mov"
            disabled={busy}
            onClick={() => markPickerOpen("reels")}
            onChange={handleVideoChange}
            className="mt-2 block w-full text-sm text-zinc-700 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-900 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
          />
          <p className="mt-2 text-xs text-zinc-500">
            Recomendado: MP4 vertical 9:16, entre 3 segundos e 15 minutos, até 250 MB.
          </p>
        </div>

        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-zinc-950">
          {previewUrl ? (
            <video
              src={previewUrl}
              controls
              playsInline
              onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
              onError={() => trackUpload("reels", "metadata_error", { file, message: "preview" })}
              className="mx-auto aspect-[9/16] max-h-[70vh] w-full max-w-sm bg-black object-contain"
            />
          ) : (
            <div className="flex aspect-[9/16] max-h-[70vh] items-center justify-center text-sm text-zinc-400">
              Prévia do vídeo
            </div>
          )}
        </div>
      </section>

      <aside className="space-y-4 rounded-lg border border-teal-200 bg-teal-50/50 p-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Publicar no Instagram</h2>
          <p className="mt-1 text-sm text-zinc-600">
            {instagramConnected && igUsername ? (
              <>
                Publicar em: <strong>@{igUsername}</strong>
              </>
            ) : (
              "Prepare o Reel sem login. Você só conecta sua conta na hora de salvar, publicar ou agendar."
            )}
          </p>
        </div>

        <label htmlFor={captionId} className="block text-sm font-medium text-zinc-800">
          Legenda
        </label>
        <textarea
          id={captionId}
          value={caption}
          disabled={busy}
          onChange={(event) => setCaption(event.target.value)}
          rows={5}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />

        <label htmlFor={hashtagsId} className="block text-sm font-medium text-zinc-800">
          Hashtags
        </label>
        <input
          id={hashtagsId}
          value={hashtags}
          disabled={busy}
          onChange={(event) => setHashtags(event.target.value)}
          placeholder="#alilu #instagram"
          className="h-11 w-full rounded-md border border-zinc-300 px-3 text-sm"
        />

        <label htmlFor={scheduleId} className="block text-sm font-medium text-zinc-800">
          Agendar publicação
        </label>
        <input
          id={scheduleId}
          type="datetime-local"
          value={scheduledAt}
          disabled={busy}
          onChange={(event) => setScheduledAt(event.target.value)}
          className="h-11 w-full rounded-md border border-zinc-300 px-3 text-sm"
        />

        <MusicSelector
          accountDefaultMusic={accountDefaultMusic}
          musicMode={musicMode}
          onMusicModeChange={setMusicMode}
          musicSelection={musicSelection}
          onMusicSelectionChange={setMusicSelection}
          disabled={busy}
        />

        <VideoEndMediaToggle context="REEL" disabled={busy} onChange={setEndMediaWanted} />

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
          <Button type="button" variant="secondary" disabled={busy} onClick={() => void runFlow("draft")}>
            Salvar rascunho
          </Button>
          <Button type="button" disabled={busy} onClick={() => void runFlow("now")}>
            {stage === "publicando" ? "Publicando..." : "Publicar agora"}
          </Button>
          <Button type="button" variant="secondary" disabled={busy} onClick={() => void runFlow("schedule")}>
            Agendar publicação
          </Button>
        </div>

        {stage !== "idle" && stage !== "sucesso" && stage !== "erro" ? (
          <p role="status" className="rounded-md bg-white px-3 py-2 text-sm text-teal-800">
            {stage === "validando"
              ? "Validando vídeo..."
              : stage === "enviando"
                ? `Enviando vídeo… ${uploadPercent}%`
                : stage === "encerramento"
                  ? "Adicionando o encerramento padrão… (pode levar até 1 minuto)"
                  : "Salvando..."}
          </p>
        ) : null}

        {message ? (
          <p
            role={stage === "erro" ? "alert" : "status"}
            className={stage === "erro" ? "rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" : "rounded-md bg-white px-3 py-2 text-sm text-teal-800"}
          >
            {message}
          </p>
        ) : null}

        {endMediaFailure && stage === "erro" ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => void finishWithEndMedia(endMediaFailure.mode, endMediaFailure.scheduledAtIso, endMediaFailure.mediaUrl, false)}>
              Publicar sem encerramento
            </Button>
            <Button type="button" onClick={() => void finishWithEndMedia(endMediaFailure.mode, endMediaFailure.scheduledAtIso, endMediaFailure.mediaUrl, true)}>
              Tentar novamente
            </Button>
          </div>
        ) : null}
      </aside>

      <ConnectInstagramDialog
        open={gateOpen}
        authenticated={Boolean(userId)}
        onClose={() => setGateOpen(false)}
        onConnect={() => void goConnect()}
      />
    </div>
  );
}
