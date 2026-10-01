"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadPresigned } from "@vercel/blob/client";
import { Button, LinkButton } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Dialog } from "@/components/instagram/Dialog";
import {
  AI_VIDEO_ASPECT_LABEL,
  AI_VIDEO_ASPECT_RATIOS,
  AI_VIDEO_IMAGE_CONTENT_TYPES,
  AI_VIDEO_IN_PROGRESS_STATUSES,
  AI_VIDEO_MAX_IMAGE_BYTES,
  AI_VIDEO_MAX_PROMPT_LENGTH,
  AI_VIDEO_PROMPT_SUGGESTIONS,
  AI_VIDEO_TIER_DESCRIPTION,
  AI_VIDEO_TIER_LABEL,
  type AiVideoAspectRatio,
  type AiVideoGenerationStatus,
  type AiVideoTier,
} from "@/lib/ai-video/types";
import { formatCredits, formatDateTime, newIdempotencyKey, readErrorMessage, slugFileName } from "./client-utils";

export interface AiVideoOptionDto {
  tier: AiVideoTier;
  durationSeconds: number;
  credits: number;
}

export interface AiVideoGenerationClientDto {
  id: string;
  tier: AiVideoTier;
  prompt: string;
  inputImageUrl: string;
  durationSeconds: number;
  aspectRatio: AiVideoAspectRatio;
  creditCost: number;
  status: AiVideoGenerationStatus;
  videoUrl: string | null;
  errorMessage: string | null;
  expiresAt: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface AiVideoDraftDto {
  inputImageUrl: string | null;
  prompt: string;
  tier: string | null;
  durationSeconds: number | null;
  aspectRatio: string | null;
}

const STATUS_LABEL: Record<AiVideoGenerationStatus, string> = {
  CREATED: "Preparando",
  CREDIT_RESERVED: "Na fila",
  SUBMITTED: "Na fila",
  QUEUED: "Na fila",
  PROCESSING: "Gerando vídeo",
  COMPLETED: "Pronto",
  FAILED: "Não foi possível gerar",
  REFUNDED: "Não gerado — créditos devolvidos",
  PRICE_GUARD_BLOCKED: "Indisponível",
  EXPIRED: "Expirado",
};

function isInProgress(status: AiVideoGenerationStatus): boolean {
  return AI_VIDEO_IN_PROGRESS_STATUSES.includes(status);
}

/**
 * "Vídeos > Imagem para vídeo com IA". O custo mostrado aqui é só
 * informativo — o servidor sempre recalcula. Sem saldo, a requisição
 * nunca é enviada: abre o aviso de créditos insuficientes, guarda o
 * rascunho no servidor e leva para a compra, voltando depois com tudo
 * preenchido.
 */
export function AiVideoGenerator({
  userId,
  initialAvailable,
  options,
  initialGenerations,
  draft,
}: {
  userId: string;
  initialAvailable: number;
  options: AiVideoOptionDto[];
  initialGenerations: AiVideoGenerationClientDto[];
  draft: AiVideoDraftDto | null;
}) {
  const tiers = useMemo(() => Array.from(new Set(options.map((option) => option.tier))), [options]);
  const [available, setAvailable] = useState(initialAvailable);
  const router = useRouter();
  const [imageUrl, setImageUrl] = useState<string | null>(draft?.inputImageUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState(draft?.prompt ?? "");
  const [tier, setTier] = useState<AiVideoTier>(
    draft?.tier && tiers.includes(draft.tier as AiVideoTier) ? (draft.tier as AiVideoTier) : (tiers[0] ?? "ECONOMICO"),
  );
  const durationsForTier = options.filter((option) => option.tier === tier).map((option) => option.durationSeconds);
  const [duration, setDuration] = useState<number>(draft?.durationSeconds ?? durationsForTier[0] ?? 5);
  const [aspectRatio, setAspectRatio] = useState<AiVideoAspectRatio>(
    AI_VIDEO_ASPECT_RATIOS.includes(draft?.aspectRatio as AiVideoAspectRatio) ? (draft!.aspectRatio as AiVideoAspectRatio) : "9:16",
  );
  const [generations, setGenerations] = useState(initialGenerations);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insufficient, setInsufficient] = useState<{ required: number; available: number } | null>(null);
  const idempotencyKeyRef = useRef<string>(newIdempotencyKey());

  const selected = options.find((option) => option.tier === tier && option.durationSeconds === duration) ?? null;
  const cost = selected?.credits ?? null;

  function selectTier(next: AiVideoTier) {
    setTier(next);
    const durations = options.filter((option) => option.tier === next).map((option) => option.durationSeconds);
    if (!durations.includes(duration) && durations[0]) setDuration(durations[0]);
  }

  // Acompanha as gerações em andamento (a consulta também adianta o processamento no servidor).
  const inProgressIds = generations.filter((generation) => isInProgress(generation.status)).map((generation) => generation.id);
  const inProgressKey = inProgressIds.join(",");
  useEffect(() => {
    if (!inProgressKey) return;
    const timer = setInterval(async () => {
      for (const id of inProgressKey.split(",")) {
        try {
          const response = await fetch(`/api/ai-video/generations/${id}`, { cache: "no-store" });
          if (!response.ok) continue;
          const payload = (await response.json()) as { generation: AiVideoGenerationClientDto; wallet: { available: number } };
          setGenerations((list) => list.map((item) => (item.id === id ? payload.generation : item)));
          setAvailable(payload.wallet.available);
        } catch {
          // tenta de novo no próximo ciclo
        }
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [inProgressKey]);

  async function handleFile(file: File | null) {
    if (!file) return;
    setUploadError(null);
    if (!AI_VIDEO_IMAGE_CONTENT_TYPES.includes(file.type)) {
      setUploadError("Use uma imagem JPG, PNG ou WebP.");
      return;
    }
    if (file.size > AI_VIDEO_MAX_IMAGE_BYTES) {
      setUploadError("A imagem pode ter no máximo 16 MB.");
      return;
    }
    setUploading(true);
    try {
      const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const uploaded = await uploadPresigned(`ai-video/${userId}/input/${slugFileName(file.name, extension)}`, file, {
        access: "public",
        handleUploadUrl: "/api/ai-video/upload",
      });
      setImageUrl(uploaded.url);
      idempotencyKeyRef.current = newIdempotencyKey();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Não foi possível enviar a imagem.");
    } finally {
      setUploading(false);
    }
  }

  const saveDraftAndBuy = useCallback(async () => {
    try {
      await fetch("/api/ai-video/draft", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl, prompt, tier, durationSeconds: duration, aspectRatio }),
      });
    } catch {
      // mesmo sem rascunho, segue para a compra
    }
    const required = insufficient?.required ?? cost ?? 0;
    router.push(`/minha-conta/creditos-ia?voltar=${encodeURIComponent("/videos/imagem-para-video")}&custo=${required}`);
  }, [imageUrl, prompt, tier, duration, aspectRatio, insufficient, cost, router]);

  async function handleGenerate() {
    setError(null);
    if (!imageUrl) {
      setError("Envie uma imagem primeiro.");
      return;
    }
    if (!prompt.trim()) {
      setError("Descreva como a imagem deve se mover.");
      return;
    }
    if (cost === null) {
      setError("Escolha uma qualidade e uma duração disponíveis.");
      return;
    }
    if (available < cost) {
      setInsufficient({ required: cost, available });
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/ai-video/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: idempotencyKeyRef.current,
          imageUrl,
          prompt: prompt.trim(),
          tier,
          durationSeconds: duration,
          aspectRatio,
        }),
      });
      if (response.status === 402) {
        const payload = (await response.json()) as { required?: number; available?: number };
        setAvailable(payload.available ?? available);
        setInsufficient({ required: payload.required ?? cost, available: payload.available ?? available });
        idempotencyKeyRef.current = newIdempotencyKey();
        return;
      }
      if (!response.ok) throw new Error(await readErrorMessage(response, "Não foi possível iniciar a geração."));
      const payload = (await response.json()) as { generation: AiVideoGenerationClientDto; wallet: { available: number } };
      setGenerations((list) => [payload.generation, ...list.filter((item) => item.id !== payload.generation.id)]);
      setAvailable(payload.wallet.available);
      idempotencyKeyRef.current = newIdempotencyKey();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível iniciar a geração.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
        <p className="text-sm text-zinc-700">
          Saldo: <strong className="text-zinc-900">{formatCredits(available)}</strong>
        </p>
        <LinkButton href="/minha-conta/creditos-ia" variant="secondary">
          Comprar créditos
        </LinkButton>
      </div>

      <section className="space-y-5 rounded-lg border border-zinc-200 p-4 sm:p-6">
        <div>
          <p className="mb-2 text-sm font-medium text-zinc-800">Imagem</p>
          <div className="flex flex-wrap items-start gap-4">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- prévia da imagem enviada (Vercel Blob).
              <img src={imageUrl} alt="Imagem enviada" className="h-32 w-auto max-w-[200px] rounded-md border border-zinc-200 object-contain" />
            ) : null}
            <label className="inline-flex min-h-11 cursor-pointer items-center rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50">
              {uploading ? "Enviando…" : imageUrl ? "Trocar imagem" : "Enviar imagem"}
              <input
                type="file"
                accept={AI_VIDEO_IMAGE_CONTENT_TYPES.join(",")}
                className="sr-only"
                disabled={uploading}
                onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          <p className="mt-1 text-xs text-zinc-500">JPG, PNG ou WebP, até 16 MB.</p>
          {uploadError ? <p className="mt-1 text-sm text-red-600">{uploadError}</p> : null}
        </div>

        <div>
          <label htmlFor="ai-video-prompt" className="mb-1 block text-sm font-medium text-zinc-800">
            Como a imagem deve se mover
          </label>
          <textarea
            id="ai-video-prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={3}
            maxLength={AI_VIDEO_MAX_PROMPT_LENGTH}
            placeholder="Ex.: a pessoa digita no computador, câmera aproxima devagar"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm leading-relaxed"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {AI_VIDEO_PROMPT_SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => setPrompt(suggestion)}
                className="rounded-full border border-zinc-300 px-3 py-1 text-xs text-zinc-700 hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-zinc-800">Qualidade</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {tiers.map((value) => (
              <label
                key={value}
                className={`flex cursor-pointer items-start gap-2 rounded-md border p-3 text-sm ${tier === value ? "border-teal-700 bg-teal-50" : "border-zinc-300"}`}
              >
                <input type="radio" name="ai-video-tier" checked={tier === value} onChange={() => selectTier(value)} className="mt-0.5 h-4 w-4" />
                <span>
                  <span className="block font-medium text-zinc-900">{AI_VIDEO_TIER_LABEL[value]}</span>
                  <span className="block text-xs text-zinc-500">{AI_VIDEO_TIER_DESCRIPTION[value]}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-5 sm:grid-cols-2">
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-zinc-800">Duração</legend>
            <div className="flex flex-wrap gap-3 text-sm">
              {durationsForTier.map((value) => (
                <label key={value} className="inline-flex items-center gap-1.5">
                  <input type="radio" name="ai-video-duration" checked={duration === value} onChange={() => setDuration(value)} className="h-4 w-4" />
                  {value} segundos
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-zinc-800">Formato</legend>
            <div className="flex flex-col gap-1.5 text-sm">
              {AI_VIDEO_ASPECT_RATIOS.map((value) => (
                <label key={value} className="inline-flex items-center gap-1.5">
                  <input type="radio" name="ai-video-aspect" checked={aspectRatio === value} onChange={() => setAspectRatio(value)} className="h-4 w-4" />
                  {AI_VIDEO_ASPECT_LABEL[value]}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        {cost !== null ? (
          <div className="rounded-md border border-teal-200 bg-teal-50/60 p-4 text-sm text-zinc-800">
            <p>
              Esta geração consumirá: <strong>{formatCredits(cost)}</strong>
            </p>
            <p>Seu saldo: {formatCredits(available)}</p>
            <p>
              Saldo após geração: {available >= cost ? formatCredits(available - cost) : <span className="text-red-700">saldo insuficiente</span>}
            </p>
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <Button type="button" onClick={handleGenerate} disabled={submitting || uploading} className="w-full justify-center sm:w-auto">
          {submitting ? "Enviando…" : "Gerar vídeo"}
        </Button>
        <p className="text-xs text-zinc-500">
          A geração utiliza serviços externos de inteligência artificial. Não envie imagens de terceiros sem autorização nem
          conteúdo impróprio — pedidos recusados pela moderação bloqueiam novas gerações por algumas horas. Se o vídeo não
          puder ser gerado, os créditos voltam para o seu saldo.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-zinc-900">Seus vídeos</h2>
        {generations.length === 0 ? (
          <p className="mt-3 rounded-md border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-600">Nenhum vídeo gerado ainda.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {generations.map((generation) => (
              <li key={generation.id} className="rounded-lg border border-zinc-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm text-zinc-600">
                    {formatDateTime(generation.createdAt)} · {generation.durationSeconds}s · {generation.aspectRatio} ·{" "}
                    {AI_VIDEO_TIER_LABEL[generation.tier]} · {formatCredits(generation.creditCost)}
                  </span>
                  <Badge tone={generation.status === "COMPLETED" ? "brand" : isInProgress(generation.status) ? "neutral" : "warning"}>
                    {STATUS_LABEL[generation.status]}
                  </Badge>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-zinc-800">{generation.prompt}</p>
                {isInProgress(generation.status) ? (
                  <p className="mt-2 text-xs text-zinc-500">Isso costuma levar de 1 a 3 minutos. Pode sair desta tela — o vídeo continua sendo gerado.</p>
                ) : null}
                {generation.errorMessage ? <p className="mt-2 text-sm text-red-700">{generation.errorMessage}</p> : null}
                {generation.status === "COMPLETED" && generation.videoUrl ? (
                  <div className="mt-3 space-y-2">
                    <video src={generation.videoUrl} controls playsInline className="max-h-[420px] w-full max-w-sm rounded-md border border-zinc-200 bg-black" />
                    <div className="flex flex-wrap gap-2">
                      <LinkButton href={`${generation.videoUrl}?download=1`} variant="secondary">
                        Baixar MP4
                      </LinkButton>
                      <LinkButton href="/instagram/reels" variant="ghost">
                        Publicar como Reel
                      </LinkButton>
                    </div>
                    {generation.expiresAt ? (
                      <p className="text-xs text-zinc-500">Disponível para download até {formatDateTime(generation.expiresAt)}.</p>
                    ) : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog
        open={insufficient !== null}
        title="Créditos insuficientes"
        onClose={() => setInsufficient(null)}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setInsufficient(null)}>
              Agora não
            </Button>
            <Button type="button" onClick={saveDraftAndBuy}>
              Comprar créditos
            </Button>
          </>
        }
      >
        {insufficient ? (
          <div className="space-y-1 text-sm text-zinc-700">
            <p>
              Esta geração custa: <strong>{formatCredits(insufficient.required)}</strong>
            </p>
            <p>Seu saldo: {formatCredits(insufficient.available)}</p>
            <p>
              Você precisa de mais: <strong>{formatCredits(Math.max(0, insufficient.required - insufficient.available))}</strong>
            </p>
            <p className="pt-2 text-xs text-zinc-500">Sua imagem, o texto e as configurações ficam salvos — depois da compra você volta direto para cá.</p>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
