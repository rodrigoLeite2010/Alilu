"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { InstagramPostStatus } from "@/lib/instagram/backend/instagram-post-repository";

export interface CalendarPostCardData {
  id: string;
  status: InstagramPostStatus;
  caption: string;
  scheduledAtUtc: string | null;
  publishedAt: string | null;
  createdAt: string;
  lastErrorSanitized: string | null;
  igUsername: string | null;
  mediaStorageUrl: string | null;
}

const STATUS_LABEL: Record<InstagramPostStatus, string> = {
  DRAFT: "Rascunho",
  SCHEDULED: "Agendado",
  PROCESSING: "Publicando…",
  PUBLISHED: "Publicado",
  FAILED: "Falhou",
  CANCELLED: "Cancelado",
  NEEDS_REVIEW: "Precisa de revisão",
};

const STATUS_BADGE_CLASS: Record<InstagramPostStatus, string> = {
  DRAFT: "bg-zinc-100 text-zinc-700",
  SCHEDULED: "bg-blue-50 text-blue-700",
  PROCESSING: "bg-amber-50 text-amber-800",
  PUBLISHED: "bg-teal-50 text-teal-800",
  FAILED: "bg-red-50 text-red-700",
  CANCELLED: "bg-zinc-100 text-zinc-500",
  NEEDS_REVIEW: "bg-orange-50 text-orange-800",
};

const CANCELLABLE_STATUSES: InstagramPostStatus[] = ["DRAFT", "SCHEDULED", "NEEDS_REVIEW", "FAILED"];
const PUBLISHABLE_NOW_STATUSES: InstagramPostStatus[] = ["DRAFT", "SCHEDULED", "PROCESSING"];

function formatDateTime(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === "string" && body.error ? body.error : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Um post na lista do calendário editorial, com as ações que fazem
 * sentido pro status atual: cancelar (DRAFT/SCHEDULED/NEEDS_REVIEW/FAILED)
 * e publicar agora (qualquer um desses + PROCESSING, para retomar um
 * polling que não terminou a tempo — ver instagram-publish-service.ts).
 * Sem "editar legenda"/"reagendar" nesta etapa — a API já suporta
 * (PATCH .../[id] com action "reschedule"), mas a tela ainda não expõe
 * isso; fica para um refino futuro se o usuário sentir falta.
 */
export function CalendarPostCard({ post }: { post: CalendarPostCardData }) {
  const [busy, setBusy] = useState<"cancel" | "publish" | null>(null);
  const [localStatus, setLocalStatus] = useState<InstagramPostStatus>(post.status);
  const [error, setError] = useState<string | null>(null);

  const canCancel = CANCELLABLE_STATUSES.includes(localStatus);
  const canPublishNow = PUBLISHABLE_NOW_STATUSES.includes(localStatus);

  async function handleCancel() {
    if (busy) return;
    const confirmed = window.confirm("Cancelar este post? Ele não poderá mais ser publicado depois.");
    if (!confirmed) return;

    setBusy("cancel");
    setError(null);
    try {
      const response = await fetch(`/api/instagram/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Não foi possível cancelar este post."));
      }
      setLocalStatus("CANCELLED");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado ao cancelar.");
    } finally {
      setBusy(null);
    }
  }

  async function handlePublishNow() {
    if (busy) return;
    setBusy("publish");
    setError(null);
    try {
      const response = await fetch(`/api/instagram/posts/${post.id}/publish`, { method: "POST" });
      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Não foi possível publicar este post."));
      }
      const { status } = (await response.json()) as { status: "PUBLISHED" | "PROCESSING" };
      setLocalStatus(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado ao publicar.");
    } finally {
      setBusy(null);
    }
  }

  const scheduledLabel = formatDateTime(post.scheduledAtUtc);
  const publishedLabel = formatDateTime(post.publishedAt);

  return (
    <div className="flex gap-3 rounded-lg border border-zinc-200 p-3">
      {post.mediaStorageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- miniatura de mídia já hospedada no Vercel Blob, sem next/image configurado pra esse domínio externo dinâmico
        <img
          src={post.mediaStorageUrl}
          alt=""
          className="h-16 w-16 flex-shrink-0 rounded-md object-cover"
        />
      ) : (
        <div className="h-16 w-16 flex-shrink-0 rounded-md bg-zinc-100" aria-hidden />
      )}

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[localStatus]}`}>
            {STATUS_LABEL[localStatus]}
          </span>
          {scheduledLabel ? (
            <span className="text-xs text-zinc-500">Agendado para {scheduledLabel}</span>
          ) : null}
          {publishedLabel ? <span className="text-xs text-zinc-500">Publicado em {publishedLabel}</span> : null}
        </div>

        <p className="truncate text-sm text-zinc-800">{post.caption || <em className="text-zinc-400">Sem legenda</em>}</p>

        {localStatus === "FAILED" && post.lastErrorSanitized ? (
          <p className="text-xs text-red-600">{post.lastErrorSanitized}</p>
        ) : null}

        {error ? (
          <p role="alert" className="text-xs text-red-600">
            {error}
          </p>
        ) : null}

        <div className="flex gap-2 pt-1">
          {canPublishNow ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => void handlePublishNow()}
              disabled={busy !== null}
              className="h-8 px-3 text-xs"
            >
              {busy === "publish" ? "Publicando…" : "Publicar agora"}
            </Button>
          ) : null}
          {canCancel ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => void handleCancel()}
              disabled={busy !== null}
              className="h-8 px-3 text-xs"
            >
              {busy === "cancel" ? "Cancelando…" : "Cancelar"}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
