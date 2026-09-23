"use client";

import { useId, useState } from "react";
import { uploadPresigned } from "@vercel/blob/client";
import { Button } from "@/components/ui/Button";
import { buildMediaPathnamePrefix } from "@/lib/instagram/backend/media-service";
import { waitForFonts } from "@/lib/instagram/export";
import { renderSlideToBlob } from "@/lib/instagram/carousel/carousel-export";
import { buildCarouselSlideFileName } from "@/lib/instagram/layout-math";
import { getFormatById } from "@/lib/instagram/formats";
import type { CarouselFormatId, CarouselSlide } from "@/lib/instagram/carousel/carousel-state";

type Stage = "idle" | "gerando" | "enviando" | "criando-post" | "publicando" | "sucesso" | "erro";

/** Mesmos limites de instagram-post-service.ts (2 a 10 imagens por carrossel — o mínimo é uma decisão do ALILU, o máximo é da própria Meta). Validados aqui também para dar um erro amigável antes de gastar tempo gerando/subindo imagens que a criação do post rejeitaria de qualquer forma. */
const MIN_CAROUSEL_ITEMS = 2;
const MAX_CAROUSEL_ITEMS = 10;

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === "string" && body.error ? body.error : fallback;
  } catch {
    return fallback;
  }
}

export interface CarouselPublishPanelProps {
  /** Os slides atuais do carrossel (state.slides do CarouselEditorTool) — nunca redesenhados aqui, só renderizados de novo, fora da tela, um por vez (ver renderSlideToBlob). */
  slides: CarouselSlide[];
  formatId: CarouselFormatId;
  /** session.user.id, obtido no Server Component da página (nunca no cliente) — ver app/instagram/painel/calendario/novo-carrossel/page.tsx. */
  userId: string;
}

/**
 * Painel de publicação real de carrossel no calendário editorial — só
 * existe na área autenticada (app/instagram/painel/calendario/novo-
 * carrossel), passada como `publishPanel` para o CarouselEditorTool
 * público (ver CarouselEditorTool.tsx). A ferramenta pública sem login
 * (/instagram/carrossel) nunca recebe essa prop e continua sem nenhuma
 * ação que publique ou exija conta conectada.
 *
 * Gera cada slide como JPEG (reaproveitando `renderSlideToBlob` do motor
 * de exportação em ZIP, com o mimeType trocado — nunca duplica a lógica
 * de desenho) e sobe um por um pro Vercel Blob, em sequência — nunca em
 * paralelo, mesma cautela já usada na exportação em ZIP: evita travar
 * aparelhos mais fracos com várias renderizações simultâneas e não
 * sobrecarrega o Blob com muitos uploads ao mesmo tempo. Só então cria o
 * post (`mediaUrls`, na ordem dos slides) e, se "Publicar agora" for
 * escolhido, dispara a publicação — mesmo fluxo de SCHEDULED/DRAFT do
 * PublishPanel de imagem única.
 */
export function CarouselPublishPanel({ slides, formatId, userId }: CarouselPublishPanelProps) {
  const captionId = useId();
  const scheduleId = useId();
  const format = getFormatById(formatId);

  const [caption, setCaption] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState<{ completed: number; total: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const busy = stage !== "idle" && stage !== "sucesso" && stage !== "erro";

  async function runFlow(mode: "now" | "schedule"): Promise<void> {
    if (busy) return;
    setMessage(null);
    setProgress(null);

    if (slides.length < MIN_CAROUSEL_ITEMS) {
      setStage("erro");
      setMessage(`Um carrossel para publicar precisa de pelo menos ${MIN_CAROUSEL_ITEMS} slides.`);
      return;
    }
    if (slides.length > MAX_CAROUSEL_ITEMS) {
      setStage("erro");
      setMessage(
        `O Instagram só aceita até ${MAX_CAROUSEL_ITEMS} imagens por carrossel (este tem ${slides.length}). Remova slides antes de publicar.`,
      );
      return;
    }

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
      await waitForFonts();

      const mediaUrls: string[] = [];
      for (let index = 0; index < slides.length; index += 1) {
        setStage("gerando");
        setProgress({ completed: index, total: slides.length });
        const blob = await renderSlideToBlob(slides[index], format, "image/jpeg", 0.92);

        setStage("enviando");
        const fileName = buildCarouselSlideFileName(index, "jpg");
        const pathname = `${buildMediaPathnamePrefix(userId)}${fileName}`;
        const uploaded = await uploadPresigned(pathname, blob, {
          access: "public", // precisa ser pública — a Meta busca a imagem pela URL, não recebe o arquivo
          handleUploadUrl: "/api/instagram/media/upload",
          clientPayload: JSON.stringify({
            originalFilename: fileName,
            fileSizeBytes: blob.size,
            contentType: "image/jpeg",
          }),
        });
        mediaUrls.push(uploaded.url);
      }
      setProgress({ completed: slides.length, total: slides.length });

      setStage("criando-post");
      const createResponse = await fetch("/api/instagram/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaUrls, caption, scheduledAt: scheduledAtIso }),
      });
      if (!createResponse.ok) {
        throw new Error(await readErrorMessage(createResponse, "Não foi possível salvar o carrossel."));
      }
      const { postId } = (await createResponse.json()) as { postId: string };

      if (mode === "schedule") {
        setStage("sucesso");
        setMessage(
          "Carrossel agendado! Ele já aparece no calendário. A publicação automática no horário exato ainda " +
            "depende de uma etapa futura — até lá, você pode publicá-lo manualmente a qualquer momento pelo calendário.",
        );
        setCaption("");
        setScheduledAt("");
        return;
      }

      setStage("publicando");
      const publishResponse = await fetch(`/api/instagram/posts/${postId}/publish`, { method: "POST" });
      if (!publishResponse.ok) {
        throw new Error(await readErrorMessage(publishResponse, "Não foi possível publicar o carrossel no Instagram."));
      }
      const { status } = (await publishResponse.json()) as { status: "PUBLISHED" | "PROCESSING" };

      setStage("sucesso");
      setMessage(
        status === "PUBLISHED"
          ? "Carrossel publicado com sucesso no Instagram!"
          : "A Meta ainda está processando o carrossel — o post já foi criado; acompanhe pelo calendário e " +
              "publique de novo em instantes (não cria um post duplicado).",
      );
      setCaption("");
      setScheduledAt("");
    } catch (error) {
      setStage("erro");
      setMessage(error instanceof Error ? error.message : "Erro inesperado ao publicar o carrossel.");
    } finally {
      setProgress(null);
    }
  }

  const STAGE_LABEL: Partial<Record<Stage, string>> = {
    gerando: progress
      ? `Gerando slide ${Math.min(progress.completed + 1, progress.total)} de ${progress.total}…`
      : "Gerando os slides…",
    enviando: progress
      ? `Enviando slide ${Math.min(progress.completed + 1, progress.total)} de ${progress.total}…`
      : "Enviando os slides…",
    "criando-post": "Salvando o carrossel…",
    publicando: "Publicando no Instagram…",
  };

  return (
    <div className="space-y-3 rounded-lg border border-teal-200 bg-teal-50/60 p-4">
      <div>
        <p className="text-sm font-medium text-teal-900">Publicar carrossel no Instagram</p>
        <p className="mt-1 text-xs text-teal-800">
          Publica de verdade os {slides.length} slides na sua conta conectada, ou agenda para uma data futura (
          {format.width} × {format.height}px cada). O Instagram aceita de {MIN_CAROUSEL_ITEMS} a{" "}
          {MAX_CAROUSEL_ITEMS} imagens por carrossel.
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
