"use client";

import { useState } from "react";
import { uploadPresigned } from "@vercel/blob/client";
import type { VideoQueueItemDto } from "@/lib/video-queue/backend/queue-dto";
import { buildAiCaptionPrompt } from "@/lib/video-queue/captions";
import { formatInTimeZone } from "@/lib/instagram/schedule-time";
import { UPLOADABLE_STATUSES, VIDEO_QUEUE_ITEM_STATUS_LABEL, VIDEO_QUEUE_SOURCE_LABEL } from "@/lib/video-queue/types";
import { inputClass, readApiError } from "./QueueSettingsFields";

const STATUS_COLOR: Record<string, string> = {
  PENDING: "bg-zinc-100 text-zinc-700",
  VALIDATING: "bg-sky-100 text-sky-800",
  IMPORTING: "bg-sky-100 text-sky-800",
  PROCESSING: "bg-sky-100 text-sky-800",
  READY: "bg-teal-100 text-teal-800",
  WAITING_FILE: "bg-amber-100 text-amber-800",
  ERROR: "bg-red-100 text-red-800",
  CANCELLED: "bg-zinc-100 text-zinc-500",
  SCHEDULED: "bg-indigo-100 text-indigo-800",
  PUBLISHED: "bg-emerald-100 text-emerald-800",
};

const POST_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Rascunho",
  SCHEDULED: "Agendado",
  PROCESSING: "Publicando",
  PUBLISHED: "Publicado",
  FAILED: "Falhou",
  CANCELLED: "Cancelado",
  NEEDS_REVIEW: "Precisa de verificação",
};

interface Props {
  item: VideoQueueItemDto;
  index: number;
  total: number;
  userId: string;
  timezone: string;
  themeName: string;
  categoryName: string;
  onChanged: () => void;
  onMove: (itemId: string, direction: -1 | 1) => void;
  onRetry: (itemId: string) => void;
  setMessage: (message: string | null) => void;
}

export function VideoQueueItemRow({ item, index, total, userId, timezone, themeName, categoryName, onChanged, onMove, onRetry, setMessage }: Props) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title ?? "");
  const [caption, setCaption] = useState(item.caption ?? "");
  const [facebookCaption, setFacebookCaption] = useState(item.facebookCaption ?? "");
  const [busy, setBusy] = useState(false);
  const [authorized, setAuthorized] = useState(false);

  const call = async (url: string, init: RequestInit, fallback: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
      if (!response.ok) {
        setMessage(await readApiError(response, fallback));
        return false;
      }
      onChanged();
      return true;
    } catch {
      setMessage(fallback);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    const ok = await call(
      `/api/video-queues/items/${item.id}`,
      { method: "PATCH", body: JSON.stringify({ title: title || null, caption: caption || null, facebookCaption: facebookCaption || null }) },
      "Não foi possível salvar a legenda.",
    );
    if (ok) setEditing(false);
  };

  const publishNow = async () => {
    if (!window.confirm("Publicar este vídeo agora nos destinos da fila?")) return;
    const fallback = "Não foi possível publicar agora. Confira o status do vídeo antes de tentar novamente.";
    setBusy(true);
    setMessage("Preparando o vídeo para publicação…");
    try {
      const prepared = await fetch(`/api/video-queues/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "prepare_publish" }),
      });
      if (!prepared.ok) {
        setMessage(await readApiError(prepared, fallback));
        return;
      }
      const { postId } = (await prepared.json()) as { postId: string };
      const published = await fetch(`/api/instagram/posts/${postId}/publish`, { method: "POST" });
      setMessage(published.ok ? "Solicitação enviada. Acompanhe o status de cada destino no vídeo." : await readApiError(published, fallback));
    } catch {
      setMessage(fallback);
    } finally {
      setBusy(false);
      onChanged();
    }
  };

  const generateWithAi = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/instagram/ai-caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: buildAiCaptionPrompt({ theme: themeName, category: categoryName, title: title || null }) }),
      });
      if (!response.ok) {
        setMessage(await readApiError(response, "Não foi possível gerar a legenda com IA agora."));
        return;
      }
      const data = (await response.json()) as { caption: string };
      setCaption(data.caption);
    } finally {
      setBusy(false);
    }
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (!authorized) {
      setMessage("Confirme que você tem os direitos ou a autorização para publicar este vídeo.");
      return;
    }
    if (!["video/mp4", "video/quicktime"].includes(file.type)) {
      setMessage("Envie um vídeo MP4 ou MOV.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const extension = file.type === "video/quicktime" ? "mov" : "mp4";
      const uploaded = await uploadPresigned(`video-queue/${userId}/uploads/${item.id}.${extension}`, file, {
        access: "public",
        handleUploadUrl: "/api/video-queues/upload",
      });
      const response = await fetch(`/api/video-queues/items/${item.id}/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blobUrl: uploaded.url, authorized: true }),
      });
      if (!response.ok) {
        setMessage(await readApiError(response, "Não foi possível usar este arquivo."));
        return;
      }
      setMessage("Arquivo enviado. Ele será validado na próxima rodada da fila (ou use “Processar agora”).");
      onChanged();
    } catch {
      setMessage("Não foi possível enviar o arquivo. Confira a conexão e tente de novo.");
    } finally {
      setBusy(false);
    }
  };

  const canEdit = !["SCHEDULED", "PUBLISHED", "CANCELLED"].includes(item.status);
  const canUpload = (UPLOADABLE_STATUSES as string[]).includes(item.status);
  const canCancel = ["PENDING", "READY", "WAITING_FILE", "ERROR", "SCHEDULED"].includes(item.status);
  const canRemove = item.status !== "PUBLISHED" && !["VALIDATING", "IMPORTING", "PROCESSING"].includes(item.status);
  const instagramFailed = item.post && item.post.publishToInstagram && ["FAILED", "NEEDS_REVIEW"].includes(item.post.status);
  const canPublishNow = item.status === "PENDING" || item.status === "READY" ||
    (item.status === "SCHEDULED" && item.post?.status === "SCHEDULED" && item.destinations.every((destination) => destination.status === "SCHEDULED"));
  const publishedAt = item.publishedAt ?? item.post?.publishedAt;

  return (
    <li className="rounded-lg border border-zinc-200 bg-white p-3">
      <div className="flex gap-3">
        <div className="h-24 w-14 shrink-0 overflow-hidden rounded bg-zinc-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover" /> : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-zinc-500">#{index + 1}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[item.status] ?? ""}`}>{VIDEO_QUEUE_ITEM_STATUS_LABEL[item.status]}</span>
            <span className="text-xs text-zinc-500">{VIDEO_QUEUE_SOURCE_LABEL[item.sourceKind]}</span>
            {item.durationSeconds ? <span className="text-xs text-zinc-500">{Math.round(item.durationSeconds)} s</span> : null}
          </div>
          <p className="mt-1 truncate text-sm font-medium text-zinc-900">{item.title || item.sourceUrl}</p>
          {item.title ? <p className="truncate text-xs text-zinc-500">{item.sourceUrl}</p> : null}
          {item.statusMessage ? <p className={`mt-1 text-xs ${item.status === "ERROR" ? "text-red-700" : "text-zinc-600"}`}>{item.statusMessage}</p> : null}
          {publishedAt ? (
            <p className="mt-1 text-xs text-zinc-700">Publicado em {formatInTimeZone(publishedAt, timezone)}</p>
          ) : item.scheduledAt ? (
            <p className="mt-1 text-xs text-zinc-700">Horário: {formatInTimeZone(item.scheduledAt, timezone)}</p>
          ) : null}
          {item.facebookNote ? <p className="mt-1 text-xs text-amber-700">{item.facebookNote}</p> : null}
          {item.post ? (
            <div className="mt-1 flex flex-wrap gap-2 text-xs">
              {item.post.publishToInstagram ? (
                <span>
                  Instagram: <strong>{POST_STATUS_LABEL[item.post.status] ?? item.post.status}</strong>
                  {item.post.error ? <span className="text-red-700"> — {item.post.error}</span> : null}
                </span>
              ) : null}
              {item.destinations.map((destination) => (
                <span key={destination.id}>
                  Facebook ({destination.accountName ?? "Página"}): <strong>{POST_STATUS_LABEL[destination.status] ?? destination.status}</strong>
                  {destination.error ? <span className="text-red-700"> — {destination.error}</span> : null}
                  {destination.externalUrl ? (
                    <a className="ml-1 text-teal-700 underline" href={destination.externalUrl} target="_blank" rel="noreferrer">
                      ver
                    </a>
                  ) : null}
                  {["FAILED", "NEEDS_REVIEW"].includes(destination.status) ? (
                    <button
                      type="button"
                      disabled={busy}
                      className="ml-1 text-teal-700 underline"
                      onClick={() => call(`/api/social/destinations/${destination.id}/retry`, { method: "POST" }, "Não foi possível tentar de novo no Facebook.")}
                    >
                      tentar de novo só no Facebook
                    </button>
                  ) : null}
                </span>
              ))}
              {instagramFailed ? (
                <button
                  type="button"
                  disabled={busy}
                  className="text-teal-700 underline"
                  onClick={() => call(`/api/instagram/posts/${item.post!.id}/publish?platform=instagram`, { method: "POST" }, "Não foi possível tentar de novo no Instagram.")}
                >
                  tentar de novo só no Instagram
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {canPublishNow ? (
              <button type="button" disabled={busy} className="min-h-11 rounded-md bg-zinc-900 px-3 py-2 font-semibold text-white disabled:opacity-50" onClick={publishNow}>
                Publicar agora
              </button>
            ) : null}
            <button type="button" disabled={busy || index === 0} className="rounded px-2 py-1 ring-1 ring-zinc-300 disabled:opacity-40" onClick={() => onMove(item.id, -1)} aria-label="Subir">
              ↑
            </button>
            <button type="button" disabled={busy || index === total - 1} className="rounded px-2 py-1 ring-1 ring-zinc-300 disabled:opacity-40" onClick={() => onMove(item.id, 1)} aria-label="Descer">
              ↓
            </button>
            {canEdit ? (
              <button type="button" className="rounded px-2 py-1 ring-1 ring-zinc-300" onClick={() => setEditing((value) => !value)}>
                {editing ? "Fechar" : "Título e legenda"}
              </button>
            ) : null}
            {item.status === "ERROR" ? (
              <button type="button" disabled={busy} className="rounded px-2 py-1 ring-1 ring-zinc-300" onClick={() => onRetry(item.id)}>
                Reprocessar
              </button>
            ) : null}
            {canCancel ? (
              <button
                type="button"
                disabled={busy}
                className="rounded px-2 py-1 ring-1 ring-zinc-300"
                onClick={() => call(`/api/video-queues/items/${item.id}`, { method: "PATCH", body: JSON.stringify({ action: "cancel" }) }, "Não foi possível cancelar.")}
              >
                Cancelar
              </button>
            ) : null}
            {canRemove ? (
              <button
                type="button"
                disabled={busy}
                className="rounded px-2 py-1 text-red-700 ring-1 ring-red-200"
                onClick={() => call(`/api/video-queues/items/${item.id}`, { method: "DELETE" }, "Não foi possível remover.")}
              >
                Remover link
              </button>
            ) : null}
            {item.videoUrl ? (
              <a className="rounded px-2 py-1 ring-1 ring-zinc-300" href={item.videoUrl} target="_blank" rel="noreferrer">
                Ver vídeo
              </a>
            ) : null}
          </div>

          {canUpload ? (
            <div className="mt-2 rounded-md bg-amber-50 p-2 text-xs">
              <label className="flex items-start gap-2">
                <input type="checkbox" className="mt-0.5" checked={authorized} onChange={(event) => setAuthorized(event.target.checked)} />
                Tenho os direitos ou a autorização para publicar este vídeo.
              </label>
              <label className="mt-2 inline-flex cursor-pointer items-center gap-2 font-medium text-teal-800">
                Enviar arquivo autorizado (MP4/MOV)
                <input type="file" accept="video/mp4,video/quicktime" className="text-xs" disabled={busy} onChange={(event) => upload(event.target.files?.[0])} />
              </label>
            </div>
          ) : null}

          {editing ? (
            <div className="mt-3 space-y-2">
              <label className="block text-xs font-medium text-zinc-700">
                Título / descrição real do vídeo (usado em {"{titulo}"})
                <input className={inputClass} value={title} maxLength={300} onChange={(event) => setTitle(event.target.value)} />
              </label>
              <label className="block text-xs font-medium text-zinc-700">
                Legenda própria (vazia = usa o template da fila)
                <textarea className={`${inputClass} h-24`} value={caption} maxLength={2200} onChange={(event) => setCaption(event.target.value)} />
              </label>
              <label className="block text-xs font-medium text-zinc-700">
                Legenda do Facebook (opcional)
                <textarea className={`${inputClass} h-16`} value={facebookCaption} onChange={(event) => setFacebookCaption(event.target.value)} />
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={busy} className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white" onClick={save}>
                  Salvar
                </button>
                <button type="button" disabled={busy} className="rounded-md px-3 py-1.5 text-xs font-semibold ring-1 ring-zinc-300" onClick={generateWithAi}>
                  Gerar legenda com IA (revise antes de salvar)
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}
