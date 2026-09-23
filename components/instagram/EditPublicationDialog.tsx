"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  ensureJpeg,
  updatePublication,
  uploadInstagramMedia,
} from "@/lib/instagram/client/publication-api";
import { formatScheduleConfirmation, getBrowserTimeZone, utcToZonedInputs } from "@/lib/instagram/schedule-time";
import { ACCEPTED_IMAGE_MIME_TYPES, MAX_IMAGE_FILE_SIZE_BYTES } from "@/lib/instagram/image-utils";
import { MAX_VIDEO_UPLOAD_BYTES, VIDEO_MEDIA_CONTENT_TYPES } from "@/lib/instagram/backend/media-service";
import type { CalendarPostCardData } from "./CalendarPostCard";
import { Dialog } from "./Dialog";
import { ScheduleFields, scheduleValueToIso, type ScheduleValue } from "./ScheduleFields";

const MAX_CAPTION = 2200;

/**
 * Edita uma publicação ainda não enviada: legenda, data/horário e troca
 * da mídia (imagem, vídeo do Reel ou todas as imagens do carrossel). A
 * mídia nova vai para o storage persistente antes de salvar — o
 * scheduler sempre publica a versão salva por último.
 */
export function EditPublicationDialog({
  post,
  userId,
  onClose,
  onSaved,
}: {
  post: CalendarPostCardData;
  userId: string;
  onClose: () => void;
  onSaved: (patch: Partial<CalendarPostCardData>, message: string) => void;
}) {
  const captionId = useId();
  const mediaId = useId();
  const scheduleToggleId = useId();
  const timeZone = getBrowserTimeZone();

  const [caption, setCaption] = useState(post.caption);
  const [scheduled, setScheduled] = useState(Boolean(post.scheduledAtUtc) && post.status === "SCHEDULED");
  const [schedule, setSchedule] = useState<ScheduleValue>(() =>
    utcToZonedInputs(post.scheduledAtUtc ?? new Date(Date.now() + 3_600_000).toISOString(), timeZone),
  );
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isVideo = post.postType === "reels";
  const isCarousel = post.postType === "carousel";

  function validateFiles(list: File[]): string | null {
    if (isCarousel && list.length > 0 && (list.length < 2 || list.length > 10)) {
      return "Escolha de 2 a 10 imagens para o carrossel.";
    }
    for (const file of list) {
      if (isVideo) {
        if (!VIDEO_MEDIA_CONTENT_TYPES.includes(file.type)) return "Envie um vídeo MP4 ou MOV.";
        if (file.size > MAX_VIDEO_UPLOAD_BYTES) return "O vídeo é muito grande (máximo 250 MB).";
      } else {
        if (!ACCEPTED_IMAGE_MIME_TYPES.includes(file.type)) return "Envie imagens JPG, PNG ou WEBP.";
        if (file.size > MAX_IMAGE_FILE_SIZE_BYTES) return "Cada imagem pode ter no máximo 15 MB.";
      }
    }
    return null;
  }

  async function handleSave() {
    if (busy) return;
    setError(null);
    if (caption.length > MAX_CAPTION) {
      setError(`A legenda pode ter no máximo ${MAX_CAPTION} caracteres.`);
      return;
    }
    let scheduledAt: string | null = null;
    if (scheduled) {
      const parsed = scheduleValueToIso(schedule, timeZone);
      if ("error" in parsed) {
        setError(parsed.error);
        return;
      }
      scheduledAt = parsed.iso;
    }
    const fileError = validateFiles(files);
    if (fileError) {
      setError(fileError);
      return;
    }

    setBusy(true);
    try {
      let mediaUrls: string[] | undefined;
      if (files.length > 0) {
        mediaUrls = [];
        for (const file of files) {
          const blob = isVideo ? file : await ensureJpeg(file);
          mediaUrls.push(await uploadInstagramMedia(userId, blob, isVideo ? "video" : "image", file.name));
        }
      }
      const result = await updatePublication(post.id, { caption, scheduledAt, timezone: timeZone, mediaUrls });
      const status = result.status === "SCHEDULED" ? "SCHEDULED" : "DRAFT";
      onSaved(
        {
          caption,
          status,
          scheduledAtUtc: status === "SCHEDULED" ? scheduledAt : null,
          timezone: timeZone,
          lastErrorSanitized: null,
          ...(mediaUrls ? { mediaStorageUrl: mediaUrls[0], itemCount: mediaUrls.length } : {}),
        },
        status === "SCHEDULED" && scheduledAt
          ? `Alterações salvas. ${formatScheduleConfirmation(scheduledAt, timeZone)}`
          : "Alterações salvas como rascunho.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar as alterações.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      title="Editar publicação"
      onClose={busy ? () => undefined : onClose}
      size="lg"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Voltar
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={busy}>
            {busy ? "Salvando…" : "Salvar alterações"}
          </Button>
        </>
      }
    >
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
          rows={5}
          className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900"
        />
        <span className="self-end text-xs text-zinc-500">
          {caption.length}/{MAX_CAPTION}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={mediaId} className="text-xs font-medium text-zinc-700">
          {isVideo ? "Trocar vídeo (opcional)" : isCarousel ? "Trocar todas as imagens (opcional, 2 a 10)" : "Trocar imagem (opcional)"}
        </label>
        <input
          id={mediaId}
          type="file"
          disabled={busy}
          multiple={isCarousel}
          accept={isVideo ? "video/mp4,video/quicktime,.mp4,.mov" : "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"}
          onChange={(event) => {
            const list = Array.from(event.target.files ?? []);
            setFiles(list);
            setError(validateFiles(list));
          }}
          className="text-sm text-zinc-700 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-medium"
        />
        {post.hasTemplateData ? (
          <p className="text-xs text-zinc-500">Para mudar a arte do template, use &quot;Editar arte&quot;.</p>
        ) : null}
      </div>

      <div className="space-y-3 rounded-lg border border-zinc-200 p-3">
        <label htmlFor={scheduleToggleId} className="flex items-center gap-2 text-sm font-medium text-zinc-800">
          <input
            id={scheduleToggleId}
            type="checkbox"
            checked={scheduled}
            disabled={busy}
            onChange={(event) => setScheduled(event.target.checked)}
            className="h-4 w-4 accent-teal-700"
          />
          Agendar publicação
        </label>
        {scheduled ? (
          <ScheduleFields value={schedule} onChange={setSchedule} timeZone={timeZone} disabled={busy} />
        ) : (
          <p className="text-xs text-zinc-500">Sem agendamento, a publicação fica salva como rascunho.</p>
        )}
      </div>

      {error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </Dialog>
  );
}
