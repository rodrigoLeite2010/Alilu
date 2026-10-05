"use client";

import { useState } from "react";
import { CarouselEndMediaOption } from "@/components/brand-end-media/CarouselEndMediaOption";
import type { CarouselEndMediaChoice } from "@/lib/brand-end-media/end-media-config";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/Button";
import { formatScheduleConfirmation, getBrowserTimeZone } from "@/lib/instagram/schedule-time";
import type { InstagramImportDto } from "@/lib/instagram-import/backend/import-dto";

type Stage = "idle" | "salvando" | "publicando" | "sucesso" | "erro";

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === "string" && body.error ? body.error : fallback;
  } catch {
    return fallback;
  }
}

const MIN_ITEMS = 2;
const MAX_ITEMS = 10;

/**
 * Repostar um carrossel importado: ordem (subir/descer/remover), legenda com
 * crédito opcional ao autor, publicar agora ou agendar. Fotos e vídeos
 * misturados — o Alilu cria um post de carrossel normal (aparece em
 * "Minhas publicações" e segue a mesma publicação/agendamento de sempre).
 */
export function CarouselRepost({
  userId,
  importItem,
  sourceProfile,
  igUsername,
}: {
  userId: string;
  importItem: InstagramImportDto;
  sourceProfile: string | null;
  igUsername: string | null;
}) {
  const [endMedia, setEndMedia] = useState<CarouselEndMediaChoice | undefined>(undefined);
  const [order, setOrder] = useState<number[]>(importItem.importedItems.slice(0, MAX_ITEMS).map((item) => item.index));
  const [caption, setCaption] = useState("");
  const [creditHandle, setCreditHandle] = useState(sourceProfile ?? "");
  const [scheduledAt, setScheduledAt] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const byIndex = new Map(importItem.importedItems.map((item) => [item.index, item]));
  const busy = stage === "salvando" || stage === "publicando";

  function move(position: number, delta: -1 | 1) {
    setOrder((current) => {
      const next = [...current];
      const target = position + delta;
      if (target < 0 || target >= next.length) return current;
      [next[position], next[target]] = [next[target], next[position]];
      return next;
    });
  }

  function remove(position: number) {
    setOrder((current) => (current.length <= MIN_ITEMS ? current : current.filter((_, index) => index !== position)));
  }

  function insertCredit() {
    const handle = creditHandle.trim().replace(/^@/, "");
    if (!handle) return;
    const credit = `Créditos: @${handle}`;
    setCaption((current) => (current.includes(credit) ? current : `${current.trim()}${current.trim() ? "\n\n" : ""}${credit}`));
  }

  async function run(mode: "now" | "schedule") {
    if (busy) return;
    let scheduledAtIso: string | null = null;
    if (mode === "schedule") {
      const parsed = scheduledAt ? new Date(scheduledAt) : null;
      if (!parsed || Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) {
        setStage("erro");
        setMessage("Escolha uma data e horário no futuro para agendar.");
        return;
      }
      scheduledAtIso = parsed.toISOString();
    }
    setMessage(null);
    setStage("salvando");
    try {
      const response = await fetch("/api/instagram/posts/from-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ importId: importItem.id, order, caption, scheduledAt: scheduledAtIso, timezone: getBrowserTimeZone(), ...(endMedia ? { endMedia } : {}) }),
      });
      if (!response.ok) throw new Error(await readErrorMessage(response, "Não foi possível salvar o carrossel."));
      const { postId } = (await response.json()) as { postId: string };

      if (mode === "schedule") {
        setStage("sucesso");
        setMessage(`Carrossel agendado. ${formatScheduleConfirmation(scheduledAtIso ?? "", getBrowserTimeZone())} Ele será publicado automaticamente.`);
        return;
      }
      setStage("publicando");
      const publish = await fetch(`/api/instagram/posts/${postId}/publish`, { method: "POST" });
      if (!publish.ok) throw new Error(await readErrorMessage(publish, "O carrossel foi salvo, mas não foi possível publicar agora."));
      const { status } = (await publish.json()) as { status: "PUBLISHED" | "PROCESSING" | "RETRY_SCHEDULED" };
      setStage("sucesso");
      setMessage(
        status === "PUBLISHED"
          ? "Carrossel publicado no Instagram!"
          : "A Meta ainda está processando os vídeos do carrossel. O Alilu termina a publicação sozinho em alguns minutos — acompanhe em Minhas publicações.",
      );
    } catch (error) {
      setStage("erro");
      setMessage(error instanceof Error ? error.message : "Erro inesperado.");
    }
  }

  const hasVideo = order.some((index) => byIndex.get(index)?.mediaType === "VIDEO");

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-sm font-semibold text-zinc-900">
          Itens ({order.length}/{MAX_ITEMS}) {igUsername ? <span className="font-normal text-zinc-500">· publicar em @{igUsername}</span> : null}
        </h2>
        <ol className="mt-2 space-y-2">
          {order.map((index, position) => {
            const item = byIndex.get(index);
            if (!item) return null;
            return (
              <li key={index} className="flex items-center gap-3 rounded-md border border-zinc-200 bg-white p-2">
                <span className="w-6 text-center text-sm font-semibold text-zinc-500">{position + 1}</span>
                {item.mediaType === "VIDEO" ? (
                  <video src={item.fileUrl} muted playsInline preload="metadata" className="h-20 w-16 rounded bg-black object-cover" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- arquivo importado (Vercel Blob do Alilu).
                  <img src={item.fileUrl} alt="" className="h-20 w-16 rounded object-cover" />
                )}
                <span className="flex-1 text-sm text-zinc-700">
                  {item.mediaType === "VIDEO" ? `Vídeo${item.durationSeconds ? ` · ${Math.round(item.durationSeconds)}s` : ""}` : "Foto"}
                  {item.width && item.height ? <span className="block text-xs text-zinc-500">{item.width}×{item.height}</span> : null}
                </span>
                <div className="flex gap-1">
                  <button type="button" onClick={() => move(position, -1)} disabled={busy || position === 0} aria-label="Subir" className="rounded p-2 hover:bg-zinc-100 disabled:opacity-30">
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(position, 1)}
                    disabled={busy || position === order.length - 1}
                    aria-label="Descer"
                    className="rounded p-2 hover:bg-zinc-100 disabled:opacity-30"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(position)}
                    disabled={busy || order.length <= MIN_ITEMS}
                    aria-label="Remover do carrossel"
                    className="rounded p-2 text-red-700 hover:bg-red-50 disabled:opacity-30"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
        <p className="mt-2 text-xs text-zinc-500">
          O Instagram corta todos os itens no formato do primeiro. Mínimo {MIN_ITEMS}, máximo {MAX_ITEMS} itens.
          {hasVideo ? " Com vídeo, a publicação pode levar alguns minutos (a Meta processa cada vídeo)." : ""}
        </p>
      </section>

      <section className="space-y-2">
        <label htmlFor="repost-caption" className="block text-sm font-semibold text-zinc-900">
          Legenda
        </label>
        <textarea
          id="repost-caption"
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
          rows={5}
          maxLength={2200}
          disabled={busy}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="repost-credit" className="text-xs text-zinc-600">
            Crédito ao autor: @
          </label>
          <input
            id="repost-credit"
            value={creditHandle}
            onChange={(event) => setCreditHandle(event.target.value)}
            placeholder="perfil"
            disabled={busy}
            className="w-40 rounded-md border border-zinc-300 px-2 py-1 text-sm"
          />
          <Button type="button" variant="secondary" onClick={insertCredit} disabled={busy || !creditHandle.trim()}>
            Inserir crédito
          </Button>
        </div>
      </section>

      <section className="space-y-2">
        <label htmlFor="repost-schedule" className="block text-sm font-semibold text-zinc-900">
          Agendar para (opcional)
        </label>
        <input
          id="repost-schedule"
          type="datetime-local"
          value={scheduledAt}
          onChange={(event) => setScheduledAt(event.target.value)}
          disabled={busy}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </section>

      <CarouselEndMediaOption userId={userId} itemCount={order.length} disabled={busy} onChange={setEndMedia} />

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void run("now")} disabled={busy}>
          {stage === "salvando" ? "Preparando o carrossel…" : stage === "publicando" ? "Publicando no Instagram…" : "Publicar agora"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => void run("schedule")} disabled={busy}>
          Agendar
        </Button>
      </div>

      {message ? (
        <div
          role={stage === "erro" ? "alert" : "status"}
          className={`rounded-md px-3 py-2 text-sm ${stage === "erro" ? "bg-red-50 text-red-700" : "bg-teal-50 text-teal-900"}`}
        >
          {message}
          {stage === "sucesso" ? (
            <div className="mt-2">
              <LinkButton href="/instagram/painel/calendario" variant="secondary">
                Minhas publicações
              </LinkButton>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
