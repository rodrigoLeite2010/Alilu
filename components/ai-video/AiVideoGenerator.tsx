"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadPresigned } from "@vercel/blob/client";
import { Button, LinkButton } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Dialog } from "@/components/instagram/Dialog";
import { ConfirmDialog } from "@/components/instagram/ConfirmDialog";
import {
  AI_VIDEO_ASPECT_LABEL,
  AI_VIDEO_ASPECT_RATIOS,
  AI_VIDEO_IMAGE_CONTENT_TYPES,
  AI_VIDEO_IN_PROGRESS_STATUSES,
  AI_VIDEO_ISSUE_LABEL,
  AI_VIDEO_ISSUE_TYPES,
  AI_VIDEO_MAX_IMAGE_BYTES,
  AI_VIDEO_MAX_PROMPT_LENGTH,
  AI_VIDEO_PROMPT_SUGGESTIONS,
  AI_VIDEO_TIERS,
  AI_VIDEO_TIER_BADGE,
  AI_VIDEO_TIER_DESCRIPTION,
  AI_VIDEO_TIER_LABEL,
  type AiVideoAspectRatio,
  type AiVideoGenerationStatus,
  type AiVideoIssueType,
  type AiVideoTier,
} from "@/lib/ai-video/types";
import { buildSimpleOverlays, simpleInputFromOverlays, type AiVideoOverlay, type SimpleOverlayInput } from "@/lib/ai-video/overlays";
import { formatCredits, formatDateTime, newIdempotencyKey, readErrorMessage, slugFileName } from "./client-utils";
import { OverlayEditor } from "./OverlayEditor";

export interface AiVideoOptionDto {
  tier: AiVideoTier;
  durationSeconds: number;
  credits: number;
  retryCredits: number;
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
  progressLabel: string;
  preserveText: boolean;
  overlays: AiVideoOverlay[];
  parentGenerationId: string | null;
  isDiscountedRetry: boolean;
  listCreditCost: number | null;
  liked: boolean;
}

export interface AiVideoDraftDto {
  inputImageUrl: string | null;
  prompt: string;
  tier: string | null;
  durationSeconds: number | null;
  aspectRatio: string | null;
  preserveText: boolean | null;
  overlays: AiVideoOverlay[] | null;
}

const STATUS_LABEL: Record<AiVideoGenerationStatus, string> = {
  CREATED: "Preparando",
  CREDIT_RESERVED: "Na fila",
  SUBMITTED: "Na fila",
  QUEUED: "Na fila",
  PROCESSING: "Gerando vídeo",
  AI_COMPLETED: "Finalizando",
  POST_PROCESSING: "Finalizando",
  COMPLETED: "Pronto",
  FAILED: "Não foi possível gerar",
  REFUNDED: "Não gerado — créditos devolvidos",
  PRICE_GUARD_BLOCKED: "Indisponível",
  EXPIRED: "Expirado",
};

function isInProgress(status: AiVideoGenerationStatus): boolean {
  return AI_VIDEO_IN_PROGRESS_STATUSES.includes(status);
}

const SLOW_GENERATION_MS = 8 * 60 * 1000;
const MAX_GENERATION_WAIT_MS = 30 * 60 * 1000;

function inProgressMessage(generation: AiVideoGenerationClientDto, nowMs: number): string {
  const elapsedMs = nowMs - new Date(generation.createdAt).getTime();
  if (elapsedMs >= SLOW_GENERATION_MS) {
    if (elapsedMs >= MAX_GENERATION_WAIT_MS) {
      return "A fila do serviço externo passou do tempo esperado. Estamos fazendo a última checagem; se não finalizar, os créditos voltam automaticamente.";
    }
    const remainingMinutes = Math.max(1, Math.ceil((MAX_GENERATION_WAIT_MS - elapsedMs) / 60_000));
    return `A fila do serviço externo está demorando mais que o normal. Pode sair desta tela — continuamos tentando e, se não finalizar em cerca de ${remainingMinutes} min, os créditos voltam automaticamente.`;
  }
  return "Isso costuma levar de 1 a 3 minutos. Pode sair desta tela — o vídeo continua sendo gerado.";
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
  const tiers = useMemo(() => AI_VIDEO_TIERS.filter((value) => options.some((option) => option.tier === value)), [options]);
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
  // Ligado por padrão: textos/logos aplicados pelo Alilu depois da IA.
  const [preserveText, setPreserveText] = useState<boolean>(draft?.preserveText ?? true);
  const [overlayInput, setOverlayInput] = useState<SimpleOverlayInput>(() => simpleInputFromOverlays(draft?.overlays ?? []));
  const [retryOf, setRetryOf] = useState<AiVideoGenerationClientDto | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [issueFor, setIssueFor] = useState<AiVideoGenerationClientDto | null>(null);
  const [deleteFor, setDeleteFor] = useState<AiVideoGenerationClientDto | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  async function confirmDeleteVideo() {
    if (!deleteFor) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/ai-video/generations/${deleteFor.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await readErrorMessage(response, "Não foi possível excluir o vídeo."));
      const removedId = deleteFor.id;
      setGenerations((list) => list.filter((item) => item.id !== removedId));
      setNotice("Vídeo excluído do Alilu.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Não foi possível excluir o vídeo.");
    } finally {
      setDeleting(false);
      setDeleteFor(null);
    }
  }
  const formRef = useRef<HTMLElement | null>(null);

  const selected = options.find((option) => option.tier === tier && option.durationSeconds === duration) ?? null;
  const cost = selected ? (retryOf ? selected.retryCredits : selected.credits) : null;
  const overlays = useMemo(() => (preserveText ? buildSimpleOverlays(overlayInput) : []), [preserveText, overlayInput]);
  const minCreditsByTier = useMemo(() => {
    const map = new Map<AiVideoTier, number>();
    for (const option of options) map.set(option.tier, Math.min(map.get(option.tier) ?? Infinity, option.credits));
    return map;
  }, [options]);

  function selectTier(next: AiVideoTier) {
    setTier(next);
    const durations = options.filter((option) => option.tier === next).map((option) => option.durationSeconds);
    if (!durations.includes(duration) && durations[0]) setDuration(durations[0]);
  }

  // Acompanha as gerações em andamento (a consulta também adianta o processamento no servidor).
  const inProgressIds = generations.filter((generation) => isInProgress(generation.status)).map((generation) => generation.id);
  const inProgressKey = inProgressIds.join(",");
  // Um vídeo por vez: enquanto houver geração em andamento (ou o envio), o botão fica travado.
  const hasGenerationInProgress = inProgressIds.length > 0;
  const generateLocked = submitting || uploading || hasGenerationInProgress;
  const submittingRef = useRef(false);
  const historyRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!inProgressKey) return;
    setNowMs(Date.now());
    const timer = setInterval(async () => {
      setNowMs(Date.now());
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

  async function saveDraftAndBuy() {
    try {
      await fetch("/api/ai-video/draft", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl, prompt, tier, durationSeconds: duration, aspectRatio, preserveText, overlays }),
      });
    } catch {
      // mesmo sem rascunho, segue para a compra
    }
    const required = insufficient?.required ?? cost ?? 0;
    router.push(`/minha-conta/creditos-ia?voltar=${encodeURIComponent("/videos/imagem-para-video")}&custo=${required}`);
  }

  /** Carrega um vídeo anterior no formulário (para "gerar novamente" ou "versão final"). */
  function loadFrom(generation: AiVideoGenerationClientDto, options_: { retry: boolean; tier?: AiVideoTier }) {
    setImageUrl(generation.inputImageUrl);
    setPrompt(generation.prompt);
    const nextTier = options_.tier ?? generation.tier;
    setTier(nextTier);
    const durations = options.filter((option) => option.tier === nextTier).map((option) => option.durationSeconds);
    setDuration(durations.includes(generation.durationSeconds) ? generation.durationSeconds : (durations[0] ?? generation.durationSeconds));
    setAspectRatio(generation.aspectRatio);
    setPreserveText(generation.preserveText);
    setOverlayInput(simpleInputFromOverlays(generation.overlays));
    setRetryOf(options_.retry ? generation : null);
    setError(null);
    idempotencyKeyRef.current = newIdempotencyKey();
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleLike(generation: AiVideoGenerationClientDto) {
    setGenerations((list) => list.map((item) => (item.id === generation.id ? { ...item, liked: true } : item)));
    try {
      await fetch(`/api/ai-video/generations/${generation.id}/feedback`, { method: "POST" });
    } catch {
      // métrica — sem impacto para o usuário
    }
  }

  async function handleGenerate() {
    // Trava síncrona: dois cliques no mesmo instante nunca disparam dois envios.
    if (submittingRef.current || hasGenerationInProgress) return;
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
    submittingRef.current = true;
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
          preserveText,
          overlays,
          retryOfGenerationId: retryOf?.id ?? null,
        }),
      });
      if (response.status === 402) {
        const payload = (await response.json()) as { required?: number; available?: number };
        setAvailable(payload.available ?? available);
        setInsufficient({ required: payload.required ?? cost, available: payload.available ?? available });
        idempotencyKeyRef.current = newIdempotencyKey();
        return;
      }
      if (response.status === 409) {
        // Já existe um vídeo gerando (ex.: outra aba): sincroniza a lista para o botão travar e o progresso aparecer.
        setError(await readErrorMessage(response, "Você já tem um vídeo sendo gerado."));
        try {
          const list = await fetch("/api/ai-video/generations", { cache: "no-store" });
          if (list.ok) {
            const data = (await list.json()) as { generations: AiVideoGenerationClientDto[]; wallet: { available: number } };
            setGenerations(data.generations);
            setAvailable(data.wallet.available);
          }
        } catch {
          // a mensagem já orienta o usuário
        }
        return;
      }
      if (!response.ok) throw new Error(await readErrorMessage(response, "Não foi possível iniciar a geração."));
      const payload = (await response.json()) as { generation: AiVideoGenerationClientDto; wallet: { available: number } };
      setGenerations((list) => [payload.generation, ...list.filter((item) => item.id !== payload.generation.id)]);
      setAvailable(payload.wallet.available);
      setRetryOf(null);
      idempotencyKeyRef.current = newIdempotencyKey();
      historyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível iniciar a geração.");
    } finally {
      submittingRef.current = false;
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

      {notice ? (
        <p role="status" className="rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-900">
          {notice}
        </p>
      ) : null}

      <section ref={formRef} className="scroll-mt-6 space-y-5 rounded-lg border border-zinc-200 p-4 sm:p-6">
        {retryOf ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <span>
              Gerando novamente com desconto a partir do vídeo de {formatDateTime(retryOf.createdAt)}. Ajuste o que quiser antes de gerar
              (a imagem é a mesma).
            </span>
            <button type="button" onClick={() => setRetryOf(null)} className="text-xs font-medium underline">
              Cancelar desconto
            </button>
          </div>
        ) : null}
        <div>
          <p className="mb-2 text-sm font-medium text-zinc-800">Imagem</p>
          <div className="flex flex-wrap items-start gap-4">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- prévia da imagem enviada (Vercel Blob).
              <img src={imageUrl} alt="Imagem enviada" className="h-32 w-auto max-w-[200px] rounded-md border border-zinc-200 object-contain" />
            ) : null}
            <label
              className={`inline-flex min-h-11 cursor-pointer items-center rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 ${retryOf ? "pointer-events-none opacity-50" : ""}`}
            >
              {uploading ? "Enviando…" : imageUrl ? "Trocar imagem" : "Enviar imagem"}
              <input
                type="file"
                accept={AI_VIDEO_IMAGE_CONTENT_TYPES.join(",")}
                className="sr-only"
                disabled={uploading || retryOf !== null}
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
          <div className="grid gap-2 sm:grid-cols-3">
            {tiers.map((value) => (
              <label
                key={value}
                className={`flex cursor-pointer items-start gap-2 rounded-md border p-3 text-sm ${tier === value ? "border-teal-700 bg-teal-50" : "border-zinc-300"}`}
              >
                <input type="radio" name="ai-video-tier" checked={tier === value} onChange={() => selectTier(value)} className="mt-0.5 h-4 w-4" />
                <span>
                  <span className="block font-medium text-zinc-900">{AI_VIDEO_TIER_LABEL[value]}</span>
                  <span className="mt-0.5 block text-[11px] font-medium uppercase tracking-wide text-teal-800">{AI_VIDEO_TIER_BADGE[value]}</span>
                  <span className="mt-1 block text-xs text-zinc-500">{AI_VIDEO_TIER_DESCRIPTION[value]}</span>
                  {minCreditsByTier.has(value) ? (
                    <span className="mt-1 block text-xs font-medium text-zinc-700">a partir de {formatCredits(minCreditsByTier.get(value)!)}</span>
                  ) : null}
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

        <div>
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input type="checkbox" checked={preserveText} onChange={(event) => setPreserveText(event.target.checked)} className="mt-0.5 h-4 w-4" />
            <span>
              <span className="block font-medium text-zinc-900">Preservar textos e logotipos</span>
              <span className="block text-xs text-zinc-500">
                Modelos de IA podem gerar variações inesperadas em letras e logos. Com esta opção, seus textos e seu logo são aplicados
                pela finalização automática do Alilu, depois da IA — saem exatamente como você digitou. Se a sua imagem já tem textos, prefira enviá-la sem eles e digitá-los
                aqui. Deixe os campos vazios para só animar a imagem.
              </span>
            </span>
          </label>
          {preserveText ? (
            <div className="mt-3">
              <OverlayEditor userId={userId} value={overlayInput} onChange={setOverlayInput} imageUrl={imageUrl} aspectRatio={aspectRatio} />
            </div>
          ) : null}
        </div>

        {cost !== null ? (
          <div className="rounded-md border border-teal-200 bg-teal-50/60 p-4 text-sm text-zinc-800">
            <p>
              Esta geração custará: <strong>{formatCredits(cost)}</strong>
              {retryOf && selected && selected.credits > cost ? (
                <span className="ml-1 text-xs text-zinc-500">(preço cheio {formatCredits(selected.credits)})</span>
              ) : null}
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

        <Button
          type="button"
          onClick={handleGenerate}
          disabled={generateLocked}
          aria-busy={submitting || hasGenerationInProgress}
          className="w-full justify-center sm:w-auto"
        >
          {submitting || hasGenerationInProgress ? (
            <span className="inline-flex items-center gap-2">
              <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              {submitting ? "Enviando…" : "Gerando seu vídeo…"}
            </span>
          ) : retryOf ? (
            "Gerar novamente com desconto"
          ) : (
            "Gerar vídeo"
          )}
        </Button>
        {hasGenerationInProgress ? (
          <p role="status" className="text-sm text-zinc-600">
            Seu vídeo já está sendo gerado — não precisa clicar de novo. Assim que ele ficar pronto, o botão é liberado para um novo vídeo.
          </p>
        ) : null}
        <p className="text-xs text-zinc-500">
          A geração utiliza serviços externos de inteligência artificial. Não envie imagens de terceiros sem autorização nem
          conteúdo impróprio — pedidos recusados pela moderação bloqueiam novas gerações por algumas horas. Se o vídeo não
          puder ser gerado, os créditos voltam para o seu saldo.
        </p>
      </section>

      <section ref={historyRef} className="scroll-mt-6">
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
                  <p className="mt-2 text-xs text-zinc-500">
                    <strong className="font-medium text-zinc-700">{generation.progressLabel}</strong> {inProgressMessage(generation, nowMs)}
                  </p>
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
                    <div className="flex flex-wrap gap-2 border-t border-zinc-100 pt-2">
                      <Button type="button" variant="secondary" onClick={() => handleLike(generation)} disabled={generation.liked}>
                        {generation.liked ? "Você gostou ✓" : "Gostei"}
                      </Button>
                      {generation.tier === "ECONOMICO" && tiers.includes("PADRAO") ? (
                        <Button type="button" variant="secondary" onClick={() => loadFrom(generation, { retry: false, tier: "PADRAO" })}>
                          Gostei — gerar versão final no Padrão
                        </Button>
                      ) : null}
                      <Button type="button" variant="ghost" onClick={() => loadFrom(generation, { retry: true })}>
                        Gerar novamente
                        {(() => {
                          const option = options.find((item) => item.tier === generation.tier && item.durationSeconds === generation.durationSeconds);
                          return option ? ` (${formatCredits(option.retryCredits)})` : "";
                        })()}
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => setIssueFor(generation)}>
                        Reportar problema
                      </Button>
                    </div>
                    {generation.expiresAt ? (
                      <p className="text-xs text-zinc-500">Disponível para download até {formatDateTime(generation.expiresAt)}.</p>
                    ) : null}
                  </div>
                ) : null}
                {!isInProgress(generation.status) ? (
                  <div className="mt-2 flex justify-end">
                    <button type="button" onClick={() => setDeleteFor(generation)} className="text-xs font-medium text-zinc-500 underline hover:text-red-700">
                      Excluir vídeo
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={deleteFor !== null}
        title="Excluir este vídeo?"
        description="O arquivo é apagado do Alilu e sai do seu histórico. Se ainda não baixou, baixe antes. Isso não devolve créditos."
        confirmLabel="Excluir vídeo"
        destructive
        busy={deleting}
        onConfirm={confirmDeleteVideo}
        onClose={() => setDeleteFor(null)}
      />

      <IssueDialog
        generation={issueFor}
        onClose={() => setIssueFor(null)}
        onReported={(payload) => {
          setIssueFor(null);
          setGenerations((list) => list.map((item) => (item.id === payload.generation.id ? payload.generation : item)));
          setAvailable(payload.wallet.available);
          setNotice(
            payload.resolution === "REFUNDED"
              ? `Confirmamos o defeito no vídeo e devolvemos ${formatCredits(payload.refundedCredits)}.`
              : payload.resolution === "PENDING_REVIEW"
                ? "Problema registrado. Vamos analisar o arquivo e, se houver defeito, devolvemos os créditos."
                : "Problema registrado, obrigado! O vídeo está tecnicamente válido — use “Gerar novamente” para tentar outra versão com desconto.",
          );
        }}
      />

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

interface IssueResponse {
  resolution: "REFUNDED" | "RETRY_OFFERED" | "PENDING_REVIEW";
  refundedCredits: number;
  generation: AiVideoGenerationClientDto;
  wallet: { available: number };
}

function IssueDialog({
  generation,
  onClose,
  onReported,
}: {
  generation: AiVideoGenerationClientDto | null;
  onClose: () => void;
  onReported: (payload: IssueResponse) => void;
}) {
  const [issueType, setIssueType] = useState<AiVideoIssueType | null>(null);
  const [description, setDescription] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!generation || !issueType) {
      setError("Escolha o tipo de problema.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const response = await fetch(`/api/ai-video/generations/${generation.id}/issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueType, description }),
      });
      if (!response.ok) throw new Error(await readErrorMessage(response, "Não foi possível registrar o problema."));
      onReported((await response.json()) as IssueResponse);
      setIssueType(null);
      setDescription("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível registrar o problema.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog
      open={generation !== null}
      title="Reportar problema"
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={submit} disabled={sending}>
            {sending ? "Enviando…" : "Enviar"}
          </Button>
        </>
      }
    >
      <fieldset className="space-y-2 text-sm">
        <legend className="mb-2 text-zinc-700">O que aconteceu com este vídeo?</legend>
        {AI_VIDEO_ISSUE_TYPES.map((type) => (
          <label key={type} className="flex items-center gap-2">
            <input type="radio" name="ai-video-issue" checked={issueType === type} onChange={() => setIssueType(type)} className="h-4 w-4" />
            {AI_VIDEO_ISSUE_LABEL[type]}
          </label>
        ))}
      </fieldset>
      <label htmlFor="ai-video-issue-description" className="mt-3 block text-sm text-zinc-700">
        Detalhes (opcional)
      </label>
      <textarea
        id="ai-video-issue-description"
        value={description}
        maxLength={1000}
        onChange={(event) => setDescription(event.target.value)}
        rows={3}
        className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
      />
      <p className="mt-2 text-xs text-zinc-500">
        Vídeo corrompido ou erro técnico: verificamos o arquivo e, se houver defeito, os créditos voltam na hora. Se o vídeo estiver
        válido mas não ficou como você queria, use “Gerar novamente” com desconto.
      </p>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </Dialog>
  );
}
