"use client";

import { useState } from "react";
import { Button, LinkButton } from "@/components/ui/Button";
import type {
  InstagramPostSource,
  InstagramPostStatus,
  InstagramPostType,
} from "@/lib/instagram/backend/instagram-post-repository";
import {
  cancelPublication,
  deletePublication,
  describePublishOutcome,
  publishPublicationNow,
  reschedulePublication,
} from "@/lib/instagram/client/publication-api";
import {
  formatInTimeZone,
  formatScheduleConfirmation,
  getBrowserTimeZone,
  utcToZonedInputs,
} from "@/lib/instagram/schedule-time";
import { ConfirmDialog } from "./ConfirmDialog";
import { Dialog } from "./Dialog";
import { EditPublicationDialog } from "./EditPublicationDialog";
import { ScheduleFields, scheduleValueToIso, type ScheduleValue } from "./ScheduleFields";

export interface CalendarPostCardData {
  id: string;
  postType: InstagramPostType;
  status: InstagramPostStatus;
  caption: string;
  scheduledAtUtc: string | null;
  publishedAt: string | null;
  createdAt: string;
  lastErrorSanitized: string | null;
  igUsername: string | null;
  mediaStorageUrl: string | null;
  itemCount: number;
  timezone?: string;
  source?: InstagramPostSource;
  templateId?: string | null;
  hasTemplateData?: boolean;
  attemptsCount?: number;
  nextAttemptAt?: string | null;
}

export const STATUS_LABEL: Record<InstagramPostStatus, string> = {
  DRAFT: "Rascunho",
  SCHEDULED: "Agendado",
  PROCESSING: "Publicando",
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

const TYPE_LABEL: Record<InstagramPostType, string> = {
  image: "Post",
  carousel: "Carrossel",
  reels: "Reel",
};

type DialogKind = "schedule" | "edit" | "cancel" | "delete" | "error" | null;

const SMALL = "min-h-9 px-3 py-1.5 text-xs";

/**
 * Uma publicação em "Minhas publicações", com as ações que fazem sentido
 * para o status atual:
 *   Rascunho  → Editar, Agendar, Publicar agora, Excluir
 *   Agendado  → Editar, Alterar horário, Publicar agora, Cancelar agendamento, Excluir
 *   Publicando→ (nenhuma — aguardando a Meta)
 *   Publicado → Visualizar, Excluir do Alilu
 *   Falhou    → Ver erro, Editar, Tentar novamente, Excluir
 *   Cancelado → Excluir
 */
export function CalendarPostCard({
  post,
  userId,
  onChange,
  onRemove,
}: {
  post: CalendarPostCardData;
  userId?: string;
  onChange?: (post: CalendarPostCardData) => void;
  onRemove?: (postId: string) => void;
}) {
  const [current, setCurrent] = useState(post);
  const [removed, setRemoved] = useState(false);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<ScheduleValue>({ date: "", time: "" });

  const timeZone = current.timezone ?? "America/Sao_Paulo";
  const status = current.status;

  function apply(patch: Partial<CalendarPostCardData>) {
    const next = { ...current, ...patch };
    setCurrent(next);
    onChange?.(next);
  }

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo deu errado. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  function openSchedule() {
    const zone = getBrowserTimeZone();
    const base = current.scheduledAtUtc ?? new Date(Date.now() + 60 * 60_000).toISOString();
    setSchedule(utcToZonedInputs(base, zone));
    setError(null);
    setDialog("schedule");
  }

  const handleSchedule = () =>
    run(async () => {
      const zone = getBrowserTimeZone();
      const parsed = scheduleValueToIso(schedule, zone);
      if ("error" in parsed) throw new Error(parsed.error);
      await reschedulePublication(current.id, parsed.iso, zone);
      apply({ status: "SCHEDULED", scheduledAtUtc: parsed.iso, timezone: zone, lastErrorSanitized: null });
      setDialog(null);
      setNotice(`Publicação agendada com sucesso. ${formatScheduleConfirmation(parsed.iso, zone)}`);
    });

  const handlePublishNow = () =>
    run(async () => {
      const outcome = await publishPublicationNow(current.id);
      apply({
        status: outcome === "PUBLISHED" ? "PUBLISHED" : outcome === "PROCESSING" ? "PROCESSING" : "SCHEDULED",
        publishedAt: outcome === "PUBLISHED" ? new Date().toISOString() : current.publishedAt,
        lastErrorSanitized: null,
      });
      setNotice(describePublishOutcome(outcome));
    });

  const handleCancel = () =>
    run(async () => {
      await cancelPublication(current.id);
      apply({ status: "CANCELLED" });
      setDialog(null);
      setNotice("Agendamento cancelado.");
    });

  const handleDelete = () =>
    run(async () => {
      // Agendamento pendente: cancela antes de excluir (garante que nunca
      // será publicado, mesmo que a exclusão falhe no meio).
      if (status === "SCHEDULED") await cancelPublication(current.id);
      await deletePublication(current.id);
      setDialog(null);
      setRemoved(true);
      onRemove?.(current.id);
    });

  if (removed) return null;

  const scheduledLabel = formatInTimeZone(current.scheduledAtUtc, timeZone);
  const publishedLabel = formatInTimeZone(current.publishedAt, timeZone);
  const retryLabel =
    status === "SCHEDULED" && current.nextAttemptAt && (current.attemptsCount ?? 0) > 0
      ? formatInTimeZone(current.nextAttemptAt, timeZone)
      : null;
  const typeLabel =
    current.postType === "carousel" ? `${TYPE_LABEL.carousel} · ${current.itemCount} fotos` : TYPE_LABEL[current.postType];
  const canEditArt = Boolean(current.hasTemplateData) && ["DRAFT", "SCHEDULED", "FAILED"].includes(status);

  const deleteCopy =
    status === "PUBLISHED"
      ? {
          title: "Excluir esta publicação do histórico do Alilu?",
          description: "A publicação continuará disponível no Instagram.",
          confirm: "Excluir do Alilu",
        }
      : status === "SCHEDULED"
        ? {
            title: "Cancelar este agendamento e excluir a publicação?",
            description: "Ela não será publicada no Instagram.",
            confirm: "Cancelar e excluir",
          }
        : {
            title: "Excluir esta publicação do Alilu?",
            description: "Esta ação não pode ser desfeita.",
            confirm: "Excluir",
          };

  return (
    <article className="flex gap-3 rounded-lg border border-zinc-200 bg-white p-3" aria-label={`${typeLabel} — ${STATUS_LABEL[status]}`}>
      {current.mediaStorageUrl ? (
        current.postType === "reels" ? (
          <video
            src={current.mediaStorageUrl}
            muted
            playsInline
            preload="metadata"
            className="h-20 w-16 flex-shrink-0 rounded-md bg-zinc-900 object-cover"
            aria-hidden
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- miniatura hospedada no Vercel Blob (domínio dinâmico)
          <img
            src={current.mediaStorageUrl}
            alt=""
            loading="lazy"
            className="h-20 w-16 flex-shrink-0 rounded-md bg-zinc-100 object-cover sm:w-20"
          />
        )
      ) : (
        <div className="h-20 w-16 flex-shrink-0 rounded-md bg-zinc-100 sm:w-20" aria-hidden />
      )}

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[status]}`}>
            {STATUS_LABEL[status]}
            {status === "PROCESSING" ? "…" : ""}
          </span>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">{typeLabel}</span>
          {current.source === "VIRAL_POST" ? (
            <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">Post viral</span>
          ) : null}
          {current.igUsername ? <span className="text-xs text-zinc-500">@{current.igUsername}</span> : null}
        </div>

        <p className="text-xs text-zinc-600">
          {status === "PUBLISHED" && publishedLabel
            ? `Publicado em ${publishedLabel}`
            : scheduledLabel && status !== "DRAFT"
              ? `${status === "CANCELLED" ? "Estava agendado para" : "Agendado para"} ${scheduledLabel}`
              : `Criado em ${formatInTimeZone(current.createdAt, timeZone)}`}
        </p>
        {retryLabel ? (
          <p className="text-xs text-amber-700">Nova tentativa automática em {retryLabel}.</p>
        ) : null}

        <p className="line-clamp-2 break-words text-sm text-zinc-800">
          {current.caption || <em className="text-zinc-400">Sem legenda</em>}
        </p>

        {notice ? (
          <p role="status" className="text-xs text-teal-700">
            {notice}
          </p>
        ) : null}
        {error && !dialog ? (
          <p role="alert" className="text-xs text-red-600">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-1.5 pt-1">
          {status === "PUBLISHED" && current.mediaStorageUrl ? (
            <LinkButton href={current.mediaStorageUrl} target="_blank" rel="noopener noreferrer" variant="secondary" className={SMALL}>
              Visualizar
            </LinkButton>
          ) : null}
          {status === "FAILED" ? (
            <Button type="button" variant="secondary" className={SMALL} onClick={() => setDialog("error")}>
              Ver erro
            </Button>
          ) : null}
          {canEditArt ? (
            <LinkButton href={`/instagram/posts-virais?editar=${current.id}`} variant="secondary" className={SMALL}>
              Editar arte
            </LinkButton>
          ) : null}
          {["DRAFT", "SCHEDULED", "FAILED"].includes(status) && userId ? (
            <Button type="button" variant="secondary" className={SMALL} onClick={() => setDialog("edit")} disabled={busy}>
              Editar
            </Button>
          ) : null}
          {status === "DRAFT" ? (
            <Button type="button" variant="secondary" className={SMALL} onClick={openSchedule} disabled={busy}>
              Agendar
            </Button>
          ) : null}
          {status === "SCHEDULED" ? (
            <Button type="button" variant="secondary" className={SMALL} onClick={openSchedule} disabled={busy}>
              Alterar horário
            </Button>
          ) : null}
          {status === "DRAFT" || status === "SCHEDULED" ? (
            <Button type="button" variant="secondary" className={SMALL} onClick={() => void handlePublishNow()} disabled={busy}>
              {busy ? "Aguarde…" : "Publicar agora"}
            </Button>
          ) : null}
          {status === "FAILED" ? (
            <Button type="button" variant="secondary" className={SMALL} onClick={() => void handlePublishNow()} disabled={busy}>
              {busy ? "Tentando…" : "Tentar novamente"}
            </Button>
          ) : null}
          {status === "SCHEDULED" ? (
            <Button type="button" variant="ghost" className={SMALL} onClick={() => setDialog("cancel")} disabled={busy}>
              Cancelar agendamento
            </Button>
          ) : null}
          {status !== "PROCESSING" ? (
            <Button type="button" variant="ghost" className={`${SMALL} text-red-700`} onClick={() => setDialog("delete")} disabled={busy}>
              {status === "PUBLISHED" ? "Excluir do Alilu" : "Excluir"}
            </Button>
          ) : null}
        </div>
      </div>

      <Dialog
        open={dialog === "schedule"}
        title={status === "SCHEDULED" ? "Alterar horário" : "Agendar publicação"}
        onClose={() => setDialog(null)}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setDialog(null)} disabled={busy}>
              Voltar
            </Button>
            <Button type="button" onClick={() => void handleSchedule()} disabled={busy}>
              {busy ? "Salvando…" : "Confirmar"}
            </Button>
          </>
        }
      >
        <ScheduleFields value={schedule} onChange={setSchedule} timeZone={dialog === "schedule" ? getBrowserTimeZone() : timeZone} disabled={busy} />
        {error ? (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        ) : null}
      </Dialog>

      <Dialog open={dialog === "error"} title="Por que a publicação falhou" onClose={() => setDialog(null)}>
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {current.lastErrorSanitized ?? "Não foi possível publicar no Instagram."}
        </p>
        <p className="text-sm text-zinc-600">
          Você pode editar a publicação e tentar novamente. Se a mensagem pedir para renovar a conexão, reconecte a conta no{" "}
          <a href="/instagram/painel" className="font-medium text-teal-700 underline">
            painel do Instagram
          </a>
          .
        </p>
      </Dialog>

      <ConfirmDialog
        open={dialog === "cancel"}
        title="Cancelar este agendamento?"
        description="A publicação não será enviada ao Instagram. Ela continua no Alilu como cancelada."
        confirmLabel="Cancelar agendamento"
        cancelLabel="Voltar"
        busy={busy}
        onConfirm={() => void handleCancel()}
        onClose={() => setDialog(null)}
      />

      <ConfirmDialog
        open={dialog === "delete"}
        title={deleteCopy.title}
        description={error ? `${deleteCopy.description} (${error})` : deleteCopy.description}
        confirmLabel={deleteCopy.confirm}
        destructive
        busy={busy}
        onConfirm={() => void handleDelete()}
        onClose={() => setDialog(null)}
      />

      {dialog === "edit" && userId ? (
        <EditPublicationDialog
          post={current}
          userId={userId}
          onClose={() => setDialog(null)}
          onSaved={(patch, message) => {
            apply(patch);
            setDialog(null);
            setNotice(message);
          }}
        />
      ) : null}
    </article>
  );
}
