"use client";

import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { Button } from "@/components/ui/Button";
import { canvasToBlob, waitForFonts } from "@/lib/instagram/export";
import { serializeEditorState, type PostEditorState } from "@/lib/instagram/editor-state";
import type { PostFormat } from "@/lib/instagram/formats";
import {
  createPublication,
  describePublishOutcome,
  ensureJpeg,
  fetchAccountStatus,
  publishPublicationNow,
  updatePublication,
  uploadInstagramMedia,
  type AccountStatus,
} from "@/lib/instagram/client/publication-api";
import {
  formatScheduleConfirmation,
  getBrowserTimeZone,
  utcToZonedInputs,
} from "@/lib/instagram/schedule-time";
import { Dialog } from "./Dialog";
import { ConnectInstagramDialog, buildConnectTarget } from "./ConnectInstagramDialog";
import { ScheduleFields, scheduleValueToIso, type ScheduleValue } from "./ScheduleFields";

const MAX_CAPTION = 2200;
/** A foto original é guardada no storage para reabrir a arte depois — reduzida se for enorme. */
const ORIGINAL_MAX_DIMENSION = 2560;
const ORIGINAL_MAX_BYTES = 14 * 1024 * 1024;

type Stage = "idle" | "gerando" | "enviando" | "salvando" | "publicando";
type Mode = "now" | "schedule";

const STAGE_LABEL: Record<Exclude<Stage, "idle">, string> = {
  gerando: "Gerando a arte em alta resolução…",
  enviando: "Enviando imagens…",
  salvando: "Salvando a publicação…",
  publicando: "Publicando no Instagram…",
};

export interface ComposerInitialValues {
  caption?: string;
  mode?: Mode;
  schedule?: ScheduleValue;
}

export interface ComposerLocalDraft {
  caption: string;
  mode: Mode;
  schedule: ScheduleValue;
}

export interface PublicationComposerPanelProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  format: PostFormat;
  state: PostEditorState;
  source: "MANUAL" | "VIRAL_POST";
  /** Publicação existente sendo editada (salva por cima, em vez de criar outra). */
  editingPostId?: string | null;
  initialValues?: ComposerInitialValues;
  /** Caminho para voltar depois do login/conexão com o Instagram. */
  returnPath: string;
  /** Guarda o rascunho local antes de sair da página (login/conexão). */
  onPersistLocalDraft?: (draft: ComposerLocalDraft) => Promise<void>;
  /** Chamado depois de salvar/publicar com sucesso (ex.: limpar o rascunho local). */
  onCompleted?: (postId: string) => void;
}

async function prepareOriginalForStorage(blob: Blob): Promise<Blob> {
  if (blob.type === "image/jpeg" && blob.size <= ORIGINAL_MAX_BYTES) return blob;
  const url = URL.createObjectURL(blob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Não foi possível ler a imagem."));
      element.src = url;
    });
    const scale = Math.min(1, ORIGINAL_MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
    if (scale === 1) return ensureJpeg(blob, 0.9);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return ensureJpeg(blob, 0.9);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await canvasToBlob(canvas, "image/jpeg", 0.9);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Painel de publicação do editor de artes (Posts Virais e "Novo post"):
 * legenda, conta de destino, salvar rascunho, e a PRÉVIA da publicação com
 * a escolha "Agora / Agendar" (data e hora no fuso do usuário).
 *
 * Fluxo de mídia: a arte final é renderizada na resolução real do formato
 * (ex.: 1080 × 1350) e enviada ao storage persistente; a foto original do
 * usuário também é guardada, para a arte poder ser reaberta e editada
 * enquanto a publicação estiver agendada. Nada fica em blob:/base64 à
 * espera do horário — o scheduler publica a partir das URLs salvas.
 *
 * Login e conexão: dá para criar tudo sem conta. Ao salvar/publicar sem
 * login, o rascunho local é guardado e o usuário vai para /entrar; sem
 * Instagram conectado, mostra "Conecte seu Instagram para publicar." e
 * volta para cá depois da conexão, com tudo restaurado.
 */
export function PublicationComposerPanel({
  canvasRef,
  format,
  state,
  source,
  editingPostId = null,
  initialValues,
  returnPath,
  onPersistLocalDraft,
  onCompleted,
}: PublicationComposerPanelProps) {
  const captionId = useId();
  const [account, setAccount] = useState<AccountStatus | null>(null);
  const [caption, setCaption] = useState(initialValues?.caption ?? "");
  const [mode, setMode] = useState<Mode>(initialValues?.mode ?? "now");
  const [schedule, setSchedule] = useState<ScheduleValue>(initialValues?.schedule ?? { date: "", time: "" });
  const [previewOpen, setPreviewOpen] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [savedPostId, setSavedPostId] = useState<string | null>(editingPostId);
  const originalUploadRef = useRef<{ localUrl: string; storageUrl: string } | null>(null);

  const busy = stage !== "idle";

  useEffect(() => {
    let cancelled = false;
    fetchAccountStatus()
      .then((status) => {
        if (!cancelled) setAccount(status);
      })
      .catch(() => {
        if (!cancelled) setAccount({ authenticated: false, connected: false, username: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function leaveForAuth(target: string) {
    try {
      await onPersistLocalDraft?.({ caption, mode, schedule });
    } finally {
      window.location.href = target;
    }
  }

  /**
   * Garante login + Instagram conectado. Quando falta algo, abre a etapa
   * "Conecte seu Instagram para continuar" (nada é pedido antes disso).
   * Retorna o userId quando pode seguir.
   */
  function ensureReady(): string | null {
    if (!account) {
      setError("Verificando sua conta… tente novamente em instantes.");
      return null;
    }
    if (!account.authenticated || !account.connected || !account.userId) {
      setGateOpen(true);
      return null;
    }
    return account.userId;
  }

  /** Sem login: entra no Alilu e segue direto para a conexão oficial da Meta; depois volta para cá. */
  function connectTarget(): string {
    return buildConnectTarget(Boolean(account?.authenticated), returnPath);
  }

  async function openPreview(nextMode: Mode = mode) {
    setError(null);
    setSuccess(null);
    setMode(nextMode);
    if (!ensureReady()) return;
    if (caption.length > MAX_CAPTION) {
      setError(`A legenda pode ter no máximo ${MAX_CAPTION} caracteres.`);
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      await waitForFonts();
      const blob = await canvasToBlob(canvas, "image/jpeg", 0.85);
      setPreviewUrl(URL.createObjectURL(blob));
    } catch {
      setPreviewUrl(null);
    }
    if (!schedule.date) {
      setSchedule(utcToZonedInputs(new Date(Date.now() + 60 * 60_000), getBrowserTimeZone()));
    }
    setPreviewOpen(true);
  }

  async function uploadAssets(userId: string): Promise<{ artUrl: string; templateData: unknown }> {
    const canvas = canvasRef.current;
    if (!canvas) throw new Error("Não foi possível encontrar a arte. Tente novamente.");

    setStage("gerando");
    await waitForFonts();
    const art = await canvasToBlob(canvas, "image/jpeg", 0.92);

    setStage("enviando");
    const artUrl = await uploadInstagramMedia(userId, art, "image");

    let storageUrl = state.backgroundImage.storageUrl ?? null;
    const localUrl = state.backgroundImage.url;
    if (localUrl && localUrl.startsWith("blob:")) {
      if (originalUploadRef.current?.localUrl === localUrl) {
        storageUrl = originalUploadRef.current.storageUrl;
      } else if (!storageUrl) {
        const original = await (await fetch(localUrl)).blob();
        storageUrl = await uploadInstagramMedia(userId, await prepareOriginalForStorage(original), "image", state.backgroundImage.fileName ?? undefined);
        originalUploadRef.current = { localUrl, storageUrl };
      }
    }
    const templateData = serializeEditorState({
      ...state,
      backgroundImage: { ...state.backgroundImage, storageUrl: localUrl ? storageUrl : null },
    });
    return { artUrl, templateData };
  }

  async function save(action: "draft" | "now" | "schedule") {
    if (busy) return;
    setError(null);
    setSuccess(null);
    const userId = ensureReady();
    if (!userId) return;

    const timezone = getBrowserTimeZone();
    let scheduledAt: string | null = null;
    if (action === "schedule") {
      const parsed = scheduleValueToIso(schedule, timezone);
      if ("error" in parsed) {
        setError(parsed.error);
        return;
      }
      scheduledAt = parsed.iso;
    }

    try {
      const { artUrl, templateData } = await uploadAssets(userId);
      setStage("salvando");
      let postId = savedPostId;
      if (postId) {
        await updatePublication(postId, {
          caption,
          scheduledAt,
          timezone,
          mediaUrls: [artUrl],
          templateId: state.templateId,
          templateData,
        });
      } else {
        postId = await createPublication({
          postType: "image",
          mediaUrl: artUrl,
          caption,
          scheduledAt,
          timezone,
          source,
          templateId: state.templateId,
          templateData,
        });
        setSavedPostId(postId);
      }

      if (action === "now") {
        setStage("publicando");
        const outcome = await publishPublicationNow(postId);
        setSuccess(describePublishOutcome(outcome));
      } else if (action === "schedule" && scheduledAt) {
        setSuccess(`Publicação agendada com sucesso. ${formatScheduleConfirmation(scheduledAt, timezone)}`);
      } else {
        setSuccess("Rascunho salvo em Minhas publicações.");
      }
      setPreviewOpen(false);
      onCompleted?.(postId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível publicar no Instagram.");
    } finally {
      setStage("idle");
    }
  }

  const accountLabel = account?.connected ? (account.username ? `@${account.username}` : "sua conta conectada") : null;
  const timeZone = previewOpen ? getBrowserTimeZone() : "America/Sao_Paulo";

  return (
    <div className="space-y-3 rounded-lg border border-teal-200 bg-teal-50/60 p-4">
      <div>
        <p className="text-sm font-semibold text-teal-900">Publicar no Instagram</p>
        <p className="mt-1 text-xs text-teal-800">
          {accountLabel ? (
            <>
              Publicar em: <strong>{accountLabel}</strong> · {format.width} × {format.height}px
            </>
          ) : account?.needsReconnect ? (
            "Sua conexão com o Instagram precisa ser renovada."
          ) : (
            "Publique agora ou agende. Você só conecta sua conta na hora de publicar — criar e baixar continua grátis e sem login."
          )}
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={captionId} className="text-xs font-medium text-zinc-700">
          Legenda
        </label>
        <textarea
          id={captionId}
          value={caption}
          disabled={busy}
          maxLength={MAX_CAPTION}
          onChange={(event) => setCaption(event.target.value)}
          rows={4}
          className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900"
        />
        <span className="self-end text-xs text-zinc-500">
          {caption.length}/{MAX_CAPTION}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void openPreview("now")} disabled={busy} className="flex-1 justify-center">
          Publicar no Instagram
        </Button>
        <Button type="button" variant="secondary" onClick={() => void openPreview("schedule")} disabled={busy} className="flex-1 justify-center">
          Agendar publicação
        </Button>
      </div>
      <Button type="button" variant="ghost" onClick={() => void save("draft")} disabled={busy} className="min-h-9 w-full justify-center py-1.5 text-xs">
        {busy && !previewOpen ? STAGE_LABEL[stage as Exclude<Stage, "idle">] : "Salvar rascunho em Minhas publicações"}
      </Button>

      {error && !previewOpen ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {success ? (
        <p role="status" className="rounded-md bg-white px-3 py-2 text-sm text-teal-800">
          {success}{" "}
          {savedPostId ? (
            <a href="/instagram/painel/calendario" className="font-medium underline">
              Ver em Minhas publicações
            </a>
          ) : null}
        </p>
      ) : null}

      <ConnectInstagramDialog
        open={gateOpen}
        authenticated={Boolean(account?.authenticated)}
        needsReconnect={Boolean(account?.needsReconnect)}
        onClose={() => setGateOpen(false)}
        onConnect={() => void leaveForAuth(connectTarget())}
      />

      <Dialog
        open={previewOpen}
        title="Prévia da publicação"
        onClose={busy ? () => undefined : () => setPreviewOpen(false)}
        size="lg"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setPreviewOpen(false)} disabled={busy}>
              Voltar
            </Button>
            <Button type="button" onClick={() => void save(mode === "now" ? "now" : "schedule")} disabled={busy}>
              {busy ? STAGE_LABEL[stage as Exclude<Stage, "idle">] : "Confirmar"}
            </Button>
          </>
        }
      >
        <div className="overflow-hidden rounded-lg border border-zinc-200">
          <div className="flex items-center gap-2 border-b border-zinc-100 px-3 py-2">
            <span className="h-7 w-7 rounded-full bg-gradient-to-br from-amber-400 via-pink-500 to-violet-600" aria-hidden />
            <span className="text-sm font-semibold text-zinc-900">{accountLabel ?? "sua conta"}</span>
          </div>
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- prévia local (blob:) da arte recém-renderizada
            <img src={previewUrl} alt="Prévia da arte que será publicada" className="mx-auto block max-h-[45vh] w-auto" />
          ) : null}
          <p className="whitespace-pre-wrap break-words px-3 py-2 text-sm text-zinc-800">
            {accountLabel ? <strong className="mr-1">{accountLabel}</strong> : null}
            {caption || <em className="text-zinc-400">Sem legenda</em>}
          </p>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-zinc-800">Publicar:</legend>
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input type="radio" name="publish-mode" checked={mode === "now"} onChange={() => setMode("now")} disabled={busy} className="h-4 w-4 accent-teal-700" />
            Agora
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input type="radio" name="publish-mode" checked={mode === "schedule"} onChange={() => setMode("schedule")} disabled={busy} className="h-4 w-4 accent-teal-700" />
            Agendar
          </label>
        </fieldset>

        {mode === "schedule" ? (
          <ScheduleFields value={schedule} onChange={setSchedule} timeZone={timeZone} disabled={busy} />
        ) : null}

        {error ? (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
      </Dialog>
    </div>
  );
}
