"use client";

import { useEffect, useId, useMemo, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { uploadPresigned } from "@vercel/blob/client";
import { Button } from "@/components/ui/Button";
import { buildMediaPathnamePrefix, MAX_VIDEO_UPLOAD_BYTES, VIDEO_MEDIA_CONTENT_TYPES } from "@/lib/instagram/backend/media-service";

type Stage = "idle" | "validando" | "enviando" | "salvando" | "publicando" | "sucesso" | "erro";
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

export function ReelsComposer({ userId }: { userId: string | null }) {
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

  const busy = stage === "validando" || stage === "enviando" || stage === "salvando" || stage === "publicando";
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function persistDraftForRedirect() {
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ caption, hashtags, scheduledAt }));
  }

  function requireLogin(): boolean {
    if (userId) return true;
    persistDraftForRedirect();
    setStage("erro");
    setMessage("Entre no ALILU para salvar, publicar ou agendar. Sua legenda fica preservada nesta aba.");
    router.push("/entrar?callbackUrl=/instagram/reels");
    return false;
  }

  function handleVideoChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    setFile(nextFile);
    setDuration(null);
    setMessage(null);
    setStage("idle");
  }

  async function validateVideo(): Promise<void> {
    if (!file) throw new Error("Escolha um vídeo para criar o Reel.");
    if (!VIDEO_MEDIA_CONTENT_TYPES.includes(file.type)) {
      throw new Error("Use um vídeo MP4 ou MOV. Recomendação: vertical 9:16, com áudio AAC quando houver som.");
    }
    if (file.size > MAX_VIDEO_UPLOAD_BYTES) {
      throw new Error("O vídeo está grande demais para este fluxo. Use um arquivo de até 250 MB.");
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
      const fileName = slugFileName(selectedFile.name);
      const uploaded = await uploadPresigned(`${buildMediaPathnamePrefix(userId as string)}${fileName}`, selectedFile, {
        access: "public",
        handleUploadUrl: "/api/instagram/media/upload",
        clientPayload: JSON.stringify({
          originalFilename: fileName,
          fileSizeBytes: selectedFile.size,
          contentType: selectedFile.type,
        }),
      });

      const fullCaption = [caption.trim(), hashtags.trim()].filter(Boolean).join("\n\n");
      setStage("salvando");
      const createResponse = await fetch("/api/instagram/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postType: "reels",
          mediaUrl: uploaded.url,
          caption: fullCaption,
          scheduledAt: scheduledAtIso,
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
      const { status } = (await publishResponse.json()) as { status: "PUBLISHED" | "PROCESSING" };
      setStage("sucesso");
      setMessage(
        status === "PUBLISHED"
          ? "Reel publicado com sucesso."
          : "A Meta ainda está processando o vídeo. Acompanhe em Minhas publicações para concluir a reconciliação.",
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
            accept="video/mp4,video/quicktime"
            disabled={busy}
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
          <h2 className="text-base font-semibold text-zinc-900">Criar Reels</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Prepare o conteúdo sem login. Para salvar, publicar ou agendar, conecte sua conta.
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
            {stage === "validando" ? "Validando vídeo..." : stage === "enviando" ? "Enviando vídeo..." : "Salvando..."}
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
      </aside>
    </div>
  );
}
