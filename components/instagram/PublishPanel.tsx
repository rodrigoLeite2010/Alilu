"use client";

import { useId, useState, type RefObject } from "react";
import { uploadPresigned } from "@vercel/blob/client";
import { Button } from "@/components/ui/Button";
import { buildMediaPathnamePrefix } from "@/lib/instagram/backend/media-service";
import { canvasToBlob, waitForFonts } from "@/lib/instagram/export";
import { buildPostFileName } from "@/lib/instagram/layout-math";
import type { PostFormat } from "@/lib/instagram/formats";

type Stage = "idle" | "gerando" | "enviando" | "criando-post" | "publicando" | "sucesso" | "erro";

const STAGE_LABEL: Partial<Record<Stage, string>> = {
  gerando: "Gerando a imagem…",
  enviando: "Enviando a imagem…",
  "criando-post": "Salvando o post…",
  publicando: "Publicando no Instagram…",
};

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === "string" && body.error ? body.error : fallback;
  } catch {
    return fallback;
  }
}

export interface PublishPanelProps {
  /** Mesmo canvasRef já desenhado pelo PostEditorTool — reaproveitado, nunca redesenhado aqui. */
  canvasRef: RefObject<HTMLCanvasElement | null>;
  format: PostFormat;
  /** session.user.id, obtido no Server Component da página (nunca no cliente) — ver app/instagram/painel/calendario/novo/page.tsx. */
  userId: string;
}

/**
 * Painel de publicação real no calendário editorial — só existe na área
 * autenticada (app/instagram/painel/calendario/novo), passada como
 * `publishPanel` para o PostEditorTool público (ver PostEditorTool.tsx).
 * A ferramenta pública sem login (/instagram/criar-post) nunca recebe
 * essa prop e continua sem nenhuma ação que publique ou exija conta
 * conectada.
 *
 * Exporta o canvas já desenhado como JPEG (a Content Publishing API só
 * aceita esse formato — ver ALLOWED_MEDIA_CONTENT_TYPES em
 * media-service.ts) reaproveitando `canvasToBlob`/`waitForFonts`
 * (lib/instagram/export.ts, já usadas pela exportação local e pelo
 * carrossel — nunca duplicadas aqui), sobe pro Vercel Blob com o mesmo
 * fluxo de URL assinada do formulário de teste (`uploadPresigned`), e cria
 * o post via API: SCHEDULED se uma data futura for escolhida (o
 * agendamento em si só dispara automaticamente quando o scheduler, etapa
 * futura, existir — até lá o post fica esperando no calendário), ou
 * DRAFT seguido de publicação imediata em "Publicar agora".
 */
export function PublishPanel({ canvasRef, format, userId }: PublishPanelProps) {
  const captionId = useId();
  const scheduleId = useId();

  const [caption, setCaption] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const busy = stage !== "idle" && stage !== "sucesso" && stage !== "erro";

  async function runFlow(mode: "now" | "schedule"): Promise<void> {
    if (busy) return;
    setMessage(null);

    let scheduledAtIso: string | null = null;
    if (mode === "schedule") {
      if (!scheduledAt) {
        setStage("erro");
        setMessage("Escolha uma data e horário para agendar, ou use \"Publicar agora\".");
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
      const canvas = canvasRef.current;
      if (!canvas) {
        throw new Error("Não foi possível encontrar a arte para publicar. Tente novamente.");
      }

      setStage("gerando");
      await waitForFonts();
      const blob = await canvasToBlob(canvas, "image/jpeg", 0.92);

      setStage("enviando");
      const fileName = buildPostFileName("jpg");
      const pathname = `${buildMediaPathnamePrefix(userId)}${fileName}`;
      const uploaded = await uploadPresigned(pathname, blob, {
        access: "public", // precisa ser pública — a Meta busca a imagem pela URL, não recebe o arquivo
        handleUploadUrl: "/api/instagram/media/upload",
        clientPayload: JSON.stringify({ originalFilename: fileName, fileSizeBytes: blob.size }),
      });

      setStage("criando-post");
      const createResponse = await fetch("/api/instagram/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaUrl: uploaded.url, caption, scheduledAt: scheduledAtIso }),
      });
      if (!createResponse.ok) {
        throw new Error(await readErrorMessage(createResponse, "Não foi possível salvar o post."));
      }
      const { postId } = (await createResponse.json()) as { postId: string };

      if (mode === "schedule") {
        setStage("sucesso");
        setMessage(
          "Post agendado! Ele já aparece no calendário. A publicação automática no horário exato ainda " +
            "depende de uma etapa futura — até lá, você pode publicá-lo manualmente a qualquer momento pelo calendário.",
        );
        setCaption("");
        setScheduledAt("");
        return;
      }

      setStage("publicando");
      const publishResponse = await fetch(`/api/instagram/posts/${postId}/publish`, { method: "POST" });
      if (!publishResponse.ok) {
        throw new Error(await readErrorMessage(publishResponse, "Não foi possível publicar no Instagram."));
      }
      const { status } = (await publishResponse.json()) as { status: "PUBLISHED" | "PROCESSING" };

      setStage("sucesso");
      setMessage(
        status === "PUBLISHED"
          ? "Publicado com sucesso no Instagram!"
          : "A Meta ainda está processando a imagem — o post já foi criado; acompanhe pelo calendário e " +
              "publique de novo em instantes (não cria um post duplicado).",
      );
      setCaption("");
      setScheduledAt("");
    } catch (error) {
      setStage("erro");
      setMessage(error instanceof Error ? error.message : "Erro inesperado ao publicar.");
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-teal-200 bg-teal-50/60 p-4">
      <div>
        <p className="text-sm font-medium text-teal-900">Publicar no Instagram</p>
        <p className="mt-1 text-xs text-teal-800">
          Publica de verdade na sua conta conectada, ou agenda para uma data futura (
          {format.width} × {format.height}px).
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
          onChange={(event) => setCaption(event.target.value)}
          rows={3}
          className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={scheduleId} className="text-xs font-medium text-zinc-700">
          Agendar para (opcional)
        </label>
        <input
          id={scheduleId}
          type="datetime-local"
          value={scheduledAt}
          disabled={busy}
          onChange={(event) => setScheduledAt(event.target.value)}
          className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => void runFlow("now")}
          disabled={busy}
          className="flex-1 justify-center sm:flex-none"
        >
          {STAGE_LABEL[stage] && stage !== "erro" ? STAGE_LABEL[stage] : "Publicar agora"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void runFlow("schedule")}
          disabled={busy}
          className="flex-1 justify-center sm:flex-none"
        >
          Agendar
        </Button>
      </div>

      {message ? (
        <p
          role={stage === "erro" ? "alert" : "status"}
          className={
            stage === "erro"
              ? "rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
              : "rounded-md bg-white px-3 py-2 text-sm text-teal-800"
          }
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
