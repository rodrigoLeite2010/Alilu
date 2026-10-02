import "server-only";
import { randomUUID } from "node:crypto";
import { put, del as deleteBlob } from "@vercel/blob";
import {
  AI_VIDEO_ASPECT_RATIOS,
  AI_VIDEO_MAX_PROMPT_LENGTH,
  AI_VIDEO_TIERS,
  type AiPricingConfig,
  type AiVideoAspectRatio,
  type AiVideoModelPricing,
  type AiVideoTier,
} from "../types";
import { economicsForCredits, providerCostUsd, retryCreditCost } from "../pricing";
import { OverlayValidationError, validateOverlays, type AiVideoOverlay } from "../overlays";
import { getActiveModelPricing, getActivePricingConfig, listModelPricing } from "./pricing-repository";
import { applyWalletMovement, consumeDeliveredGeneration, ensureWallet, getWallet, grantWelcomeBonusOnce, type WalletRecord } from "./wallet-repository";
import {
  claimGeneration,
  claimRecoverableGeneration,
  countActiveGenerations,
  countGenerationsSince,
  countRetriesOf,
  findGenerationByIdempotencyKey,
  setGenerationStatusKeepingLock,
  countModerationFailuresSince,
  deleteGeneration,
  getGenerationById,
  getGenerationForUser,
  insertGenerationOnce,
  listDueGenerationIds,
  listExpiredStoredGenerations,
  sumProviderSpendUsdSince,
  updateGeneration,
  userHasPaidPurchase,
  type AiVideoGenerationRecord,
} from "./generation-repository";
import { getImageToVideoProvider } from "./providers/provider-registry";
import { ImageToVideoProviderError } from "./providers/provider";
import { isAiVideoInputPathForUser } from "./ai-video-storage";
import { processAiVideo, VideoOutputInvalidError, VideoPostProcessError } from "./video-overlay-service";

/**
 * Regra de negócio da geração "imagem → vídeo":
 *
 *   validar → recalcular preço NO SERVIDOR (nunca confiar no front) →
 *   trava de preço/limites → criar geração (idempotente) → RESERVAR
 *   créditos (atômico) → enviar ao provedor → acompanhar (cron/tela) →
 *   SUCESSO: copiar MP4 para o Blob + CONSUMIR a reserva
 *   FALHA:   DEVOLVER a reserva (o custo eventual do provedor é do Alilu)
 *
 * Política de créditos em falha: o usuário nunca paga por vídeo que não
 * recebeu — qualquer falha (técnica, imagem inválida, moderação) devolve
 * os créditos. Moderação ainda conta "strike" para o bloqueio temporário
 * (a Runway suspende contas com muitas requisições moderadas).
 */

export class AiVideoError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly httpStatus: number,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "AiVideoError";
  }
}

const SUBMIT_RETRY_DELAYS_MINUTES = [1, 3, 10];
const POLL_INTERVAL_MS = 10_000;
const THROTTLED_POLL_INTERVAL_MS = 30_000;
/** Depois disso sem terminar, vira falha técnica com devolução dos créditos. */
const MAX_PROCESSING_MS = 30 * 60 * 1000;

function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function startOfUtcMonth(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Garante a carteira e concede o bônus de boas-vindas uma única vez (server-side). */
export async function getWalletWithWelcomeBonus(userId: string): Promise<WalletRecord> {
  const wallet = await ensureWallet(userId);
  if (!wallet.welcomeBonusGrantedAt) {
    const config = await getActivePricingConfig();
    await grantWelcomeBonusOnce(userId, config.welcomeBonusCredits);
    return (await getWallet(userId)) ?? wallet;
  }
  return wallet;
}

export interface CreateGenerationInput {
  idempotencyKey: string;
  imageUrl: string;
  prompt: string;
  tier: string;
  durationSeconds: number;
  aspectRatio: string;
  /** "Preservar textos e logotipos": aplica os overlays DEPOIS da IA. */
  preserveText?: boolean;
  /** Lista de overlays (lib/ai-video/overlays.ts) — validada no servidor. */
  overlays?: unknown;
  /** "Gerar novamente com desconto" a partir desta geração concluída. */
  retryOfGenerationId?: string | null;
}

/** Quantas tentativas de pós-processamento (FFmpeg/cópia) antes de devolver os créditos. */
const MAX_POSTPROCESS_ATTEMPTS = 3;

/**
 * Instrução extra ao modelo quando "preservar textos e logo" está ligado.
 * AJUDA, mas não garante — a garantia é o pós-processamento (overlays).
 */
const PRESERVE_TEXT_PROMPT_SUFFIX =
  " Keep any existing text, letters and logos static and unchanged. Do not add new text. Prefer subtle, stable camera motion.";

export function buildProviderPrompt(prompt: string, preserveText: boolean): string {
  if (!preserveText) return prompt;
  return `${prompt.slice(0, AI_VIDEO_MAX_PROMPT_LENGTH - PRESERVE_TEXT_PROMPT_SUFFIX.length)}${PRESERVE_TEXT_PROMPT_SUFFIX}`;
}

export interface GenerationQuote {
  pricing: AiVideoModelPricing;
  config: AiPricingConfig;
  credits: number;
  providerCostUsd: number;
  estimatedCostBrl: number;
  revenueBrl: number;
  grossMarginPct: number;
}

/** Preço de uma combinação — calculado no servidor a partir da tabela ativa. */
export async function quoteGeneration(tier: AiVideoTier, durationSeconds: number): Promise<GenerationQuote> {
  const pricing = await getActiveModelPricing(tier, durationSeconds);
  if (!pricing) throw new AiVideoError("Esta combinação de qualidade e duração não está disponível.", "UNAVAILABLE_OPTION", 400);
  const config = await getActivePricingConfig();
  const economics = economicsForCredits(config, pricing, pricing.aliluCreditCost);
  return {
    pricing,
    config,
    credits: pricing.aliluCreditCost,
    providerCostUsd: providerCostUsd(pricing),
    estimatedCostBrl: economics.totalCostBrl,
    revenueBrl: economics.revenueBrl,
    grossMarginPct: economics.grossMarginPct,
  };
}

function validateInput(userId: string, input: CreateGenerationInput): {
  tier: AiVideoTier;
  aspectRatio: AiVideoAspectRatio;
  prompt: string;
} {
  if (typeof input.idempotencyKey !== "string" || input.idempotencyKey.length < 8 || input.idempotencyKey.length > 100) {
    throw new AiVideoError("Requisição inválida.", "INVALID_IDEMPOTENCY_KEY", 400);
  }
  if (!AI_VIDEO_TIERS.includes(input.tier as AiVideoTier)) {
    throw new AiVideoError("Qualidade inválida.", "INVALID_TIER", 400);
  }
  if (!AI_VIDEO_ASPECT_RATIOS.includes(input.aspectRatio as AiVideoAspectRatio)) {
    throw new AiVideoError("Formato inválido.", "INVALID_ASPECT_RATIO", 400);
  }
  if (!Number.isInteger(input.durationSeconds)) {
    throw new AiVideoError("Duração inválida.", "INVALID_DURATION", 400);
  }
  const prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
  if (!prompt) throw new AiVideoError("Descreva como a imagem deve se mover.", "EMPTY_PROMPT", 400);
  if (prompt.length > AI_VIDEO_MAX_PROMPT_LENGTH) {
    throw new AiVideoError(`O texto pode ter no máximo ${AI_VIDEO_MAX_PROMPT_LENGTH} caracteres.`, "PROMPT_TOO_LONG", 400);
  }
  if (!isAiVideoInputPathForUser(input.imageUrl, userId)) {
    throw new AiVideoError("Envie a imagem pela própria tela antes de gerar.", "INVALID_IMAGE", 400);
  }
  return { tier: input.tier as AiVideoTier, aspectRatio: input.aspectRatio as AiVideoAspectRatio, prompt };
}

/**
 * "GERAR VÍDEO". Duplo clique / refresh / retry com a mesma
 * idempotencyKey devolvem a MESMA geração, sem reservar de novo.
 */
export async function createGeneration(
  userId: string,
  input: CreateGenerationInput,
  now: Date = new Date(),
): Promise<AiVideoGenerationRecord> {
  const { tier, aspectRatio, prompt } = validateInput(userId, input);

  const preserveText = input.preserveText === true;
  let overlays: AiVideoOverlay[] = [];
  try {
    // Sem "preservar textos e logo": só anima a imagem, nenhum overlay é aplicado.
    overlays = preserveText ? validateOverlays(input.overlays, (url) => isAiVideoInputPathForUser(url, userId)) : [];
  } catch (error) {
    if (error instanceof OverlayValidationError) throw new AiVideoError(error.message, "INVALID_OVERLAYS", 400);
    throw error;
  }

  const quote = await quoteGeneration(tier, input.durationSeconds);
  const { pricing, config } = quote;

  // "Gerar novamente com desconto": só a partir de um vídeo concluído do próprio usuário, com a mesma imagem.
  let parentGenerationId: string | null = null;
  if (input.retryOfGenerationId) {
    const parent = await getGenerationForUser(String(input.retryOfGenerationId), userId);
    if (!parent || (parent.status !== "COMPLETED" && parent.status !== "EXPIRED")) {
      throw new AiVideoError("Só é possível gerar novamente a partir de um vídeo concluído.", "RETRY_NOT_ALLOWED", 400);
    }
    if (parent.inputImageUrl !== input.imageUrl) {
      throw new AiVideoError("Para gerar novamente com desconto, use a mesma imagem.", "RETRY_IMAGE_CHANGED", 400);
    }
    const existing = await findGenerationByIdempotencyKey(userId, input.idempotencyKey);
    if (!existing && (await countRetriesOf(parent.id)) >= config.maxRetriesPerGeneration) {
      throw new AiVideoError("Você já gerou novamente este vídeo o máximo de vezes com desconto.", "RETRY_LIMIT", 429);
    }
    parentGenerationId = parent.id;
    const credits = retryCreditCost(config, pricing);
    const economics = economicsForCredits(config, pricing, credits);
    quote.credits = credits;
    quote.revenueBrl = economics.revenueBrl;
    quote.grossMarginPct = economics.grossMarginPct;
  }

  const provider = getImageToVideoProvider(pricing.provider);
  if (!provider || !provider.supports({ model: pricing.providerModel, durationSeconds: pricing.durationSeconds, aspectRatio })) {
    throw new AiVideoError("Esta combinação de qualidade, duração e formato não está disponível.", "UNSUPPORTED_COMBINATION", 400);
  }

  // Bloqueio temporário por moderação (protege a conta do Alilu no provedor).
  const moderationSince = new Date(now.getTime() - config.moderationBlockHours * 3600_000);
  if ((await countModerationFailuresSince(userId, moderationSince)) >= config.moderationStrikesBeforeBlock) {
    throw new AiVideoError(
      "Várias imagens ou textos seus foram recusados pela moderação. Tente de novo mais tarde, com outro conteúdo.",
      "MODERATION_BLOCKED",
      429,
    );
  }
  // Limite por hora.
  // Um vídeo por vez (padrão): clique duplo / duas abas não gastam créditos em dobro.
  // Repetir a MESMA requisição (mesma chave) continua devolvendo a geração já criada.
  if (
    !(await findGenerationByIdempotencyKey(userId, input.idempotencyKey)) &&
    (await countActiveGenerations(userId)) >= config.maxConcurrentGenerationsPerUser
  ) {
    throw new AiVideoError(
      "Você já tem um vídeo sendo gerado. Aguarde ele ficar pronto para gerar outro.",
      "GENERATION_IN_PROGRESS",
      409,
    );
  }
  if ((await countGenerationsSince(userId, new Date(now.getTime() - 3600_000))) >= config.maxGenerationsPerUserPerHour) {
    throw new AiVideoError("Você atingiu o limite de gerações por hora. Tente novamente em alguns minutos.", "HOURLY_LIMIT", 429);
  }

  const base = {
    userId,
    idempotencyKey: input.idempotencyKey,
    tier,
    provider: pricing.provider,
    providerModel: pricing.providerModel,
    prompt,
    inputImageUrl: input.imageUrl,
    durationSeconds: pricing.durationSeconds,
    aspectRatio,
    resolution: pricing.resolution,
    creditCost: quote.credits,
    providerEstimatedCostUsd: quote.providerCostUsd,
    exchangeRateReference: config.usdBrlReferenceRate,
    estimatedCostBrl: quote.estimatedCostBrl,
    revenueAllocatedBrl: quote.revenueBrl,
    preserveText,
    overlays,
    parentGenerationId,
    pricingKind: parentGenerationId ? ("RETRY_DISCOUNT" as const) : ("FULL" as const),
    listCreditCost: pricing.aliluCreditCost,
  };

  // Trava de preço: protege contra mudança de preço do provedor, modelo
  // errado, duração inesperada ou configuração incorreta.
  const guard = await evaluatePriceGuard(quote, now, { skipMarginCheck: parentGenerationId !== null });
  if (guard) {
    const { generation } = await insertGenerationOnce({ ...base, status: "PRICE_GUARD_BLOCKED", errorCode: guard.code, errorMessage: guard.adminMessage });
    console.error("[ai-video] PRICE_GUARD_BLOCKED", {
      generationId: generation.id,
      userId,
      provider: pricing.provider,
      model: pricing.providerModel,
      reason: guard.code,
      providerCostUsd: quote.providerCostUsd,
    });
    throw new AiVideoError("A geração de vídeo está temporariamente indisponível. Tente novamente mais tarde.", "PRICE_GUARD_BLOCKED", 503);
  }

  const { created, generation } = await insertGenerationOnce({ ...base, status: "CREATED" });
  if (!created) return (await recoverCompletedProviderResult(generation, now)) ?? generation;

  const reserve = await applyWalletMovement({
    userId,
    type: "RESERVE",
    availableDelta: -quote.credits,
    reservedDelta: quote.credits,
    referenceType: "ai_video_generation",
    referenceId: generation.id,
    description: `Reserva — vídeo de ${pricing.durationSeconds}s`,
  });
  if (reserve.status === "insufficient") {
    await deleteGeneration(generation.id);
    const wallet = await getWallet(userId);
    throw new AiVideoError("Créditos insuficientes.", "INSUFFICIENT_CREDITS", 402, {
      required: quote.credits,
      available: wallet?.available ?? 0,
      missing: Math.max(0, quote.credits - (wallet?.available ?? 0)),
    });
  }

  await updateGeneration(generation.id, { status: "CREDIT_RESERVED", nextCheckAt: now }, null);

  // Envia já — se o provedor estiver ocupado, o cron tenta de novo.
  const lockToken = randomUUID();
  const claimed = await claimGeneration(generation.id, lockToken, now);
  if (claimed) await advanceGeneration(claimed, lockToken, now);
  return (await getGenerationById(generation.id))!;
}

async function evaluatePriceGuard(
  quote: GenerationQuote,
  now: Date,
  options: { skipMarginCheck?: boolean } = {},
): Promise<{ code: string; adminMessage: string } | null> {
  const { config } = quote;
  if (quote.providerCostUsd > config.maxProviderCostUsd) {
    return {
      code: "PRICE_LIMIT_EXCEEDED",
      adminMessage: `Custo estimado US$ ${quote.providerCostUsd.toFixed(4)} acima do máximo US$ ${config.maxProviderCostUsd}.`,
    };
  }
  // A regeneração com desconto é subsidiada de propósito (piso = custo, ver retryCreditCost).
  if (!options.skipMarginCheck && quote.grossMarginPct < config.minimumGrossMarginPct) {
    return {
      code: "MARGIN_BELOW_MINIMUM",
      adminMessage: `Margem ${quote.grossMarginPct.toFixed(1)}% abaixo da mínima ${config.minimumGrossMarginPct}%.`,
    };
  }
  const daily = await sumProviderSpendUsdSince(startOfUtcDay(now));
  if (daily + quote.providerCostUsd > config.dailyProviderSpendLimitUsd) {
    return { code: "DAILY_SPEND_LIMIT", adminMessage: `Limite diário de gasto com o provedor (US$ ${config.dailyProviderSpendLimitUsd}) atingido.` };
  }
  const monthly = await sumProviderSpendUsdSince(startOfUtcMonth(now));
  if (monthly + quote.providerCostUsd > config.monthlyProviderSpendLimitUsd) {
    return { code: "MONTHLY_SPEND_LIMIT", adminMessage: `Limite mensal de gasto com o provedor (US$ ${config.monthlyProviderSpendLimitUsd}) atingido.` };
  }
  return null;
}

async function refundGeneration(
  generation: AiVideoGenerationRecord,
  lockToken: string,
  now: Date,
  failure: { kind: "USER_ERROR" | "TECHNICAL_ERROR"; code: string; message: string; providerCharged: boolean },
): Promise<void> {
  // Devolve PRIMEIRO (idempotente pela referência): se o processo cair
  // logo depois, o próximo ciclo marca o status sem devolver duas vezes.
  const result = await applyWalletMovement({
    userId: generation.userId,
    type: "REFUND",
    availableDelta: generation.creditCost,
    reservedDelta: -generation.creditCost,
    referenceType: "ai_video_generation",
    referenceId: generation.id,
    description: "Devolução — o vídeo não pôde ser gerado",
  });
  await updateGeneration(
    generation.id,
    {
      status: result.status === "insufficient" ? "FAILED" : "REFUNDED",
      errorKind: failure.kind,
      errorCode: failure.code,
      errorMessage: failure.message.slice(0, 1000),
      providerCharged: failure.providerCharged,
      providerActualCostUsd: failure.providerCharged ? generation.providerEstimatedCostUsd : 0,
      completedAt: now,
      nextCheckAt: null,
    },
    lockToken,
  );
  console.info("[ai-video] geração falhou e foi reembolsada", {
    generationId: generation.id,
    userId: generation.userId,
    provider: generation.provider,
    model: generation.providerModel,
    credits: generation.creditCost,
    externalTaskId: generation.externalTaskId,
    errorCode: failure.code,
    providerCharged: failure.providerCharged,
  });
}

async function downloadBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) throw new ImageToVideoProviderError("Não foi possível baixar o vídeo gerado.", "TECHNICAL", true, response.status, "DOWNLOAD_FAILED");
  return Buffer.from(await response.arrayBuffer());
}

/**
 * Finalização (com o lock): baixa o MP4 da IA → valida (ffprobe) → aplica
 * overlays (se houver) → guarda no Blob → CONSOME a reserva → COMPLETED.
 *   - MP4 vazio/corrompido/sem duração → devolução automática.
 *   - falha de download/FFmpeg → tenta de novo (até MAX_POSTPROCESS_ATTEMPTS) e depois devolve.
 * Em qualquer devolução aqui o provedor JÁ cobrou (providerCharged = true).
 */
async function finalizeGeneration(generation: AiVideoGenerationRecord, lockToken: string, now: Date): Promise<void> {
  if (!generation.outputVideoUrl) {
    await refundGeneration(generation, lockToken, now, { kind: "TECHNICAL_ERROR", code: "EMPTY_OUTPUT", message: "O provedor não devolveu o vídeo.", providerCharged: true });
    return;
  }
  const attempt = generation.postprocessAttempts + 1;
  const retryOrRefund = async (code: string, message: string) => {
    if (attempt < MAX_POSTPROCESS_ATTEMPTS) {
      await updateGeneration(
        generation.id,
        { postprocessAttempts: attempt, nextCheckAt: new Date(now.getTime() + THROTTLED_POLL_INTERVAL_MS), errorMessage: message.slice(0, 500) },
        lockToken,
      );
      return;
    }
    await refundGeneration(generation, lockToken, now, {
      kind: "TECHNICAL_ERROR",
      code,
      message: "Não foi possível finalizar o vídeo. Seus créditos foram devolvidos.",
      providerCharged: true,
    });
  };

  if (generation.overlays.length > 0 && generation.status !== "POST_PROCESSING") {
    await setGenerationStatusKeepingLock(generation.id, "POST_PROCESSING", lockToken);
  }

  let finalBuffer: Buffer;
  try {
    const videoBuffer = await downloadBuffer(generation.outputVideoUrl);
    const result = await processAiVideo({
      videoBuffer,
      overlays: generation.overlays,
      loadOverlayImage: async (url) => {
        // Defesa em profundidade: só imagens do próprio usuário (já validado na criação).
        if (!isAiVideoInputPathForUser(url, generation.userId)) throw new VideoPostProcessError("Imagem do overlay não permitida.");
        return downloadBuffer(url);
      },
    });
    finalBuffer = result.buffer;
  } catch (error) {
    if (error instanceof VideoOutputInvalidError) {
      await refundGeneration(generation, lockToken, now, {
        kind: "TECHNICAL_ERROR",
        code: `INVALID_OUTPUT_${error.code}`,
        message: "O vídeo gerado veio vazio ou corrompido. Seus créditos foram devolvidos.",
        providerCharged: true,
      });
      return;
    }
    console.error("[ai-video] falha na finalização", { generationId: generation.id, attempt, message: (error as Error)?.message?.slice(0, 300) });
    await retryOrRefund(error instanceof VideoPostProcessError ? "POSTPROCESS_FAILED" : "DOWNLOAD_FAILED", (error as Error)?.message ?? "falha");
    return;
  }

  let storageUrl: string;
  try {
    const blob = await put(`ai-video/${generation.userId}/generated/${generation.id}.mp4`, finalBuffer, {
      access: "public",
      addRandomSuffix: true,
      contentType: "video/mp4",
    });
    storageUrl = blob.url;
  } catch (error) {
    await retryOrRefund("STORAGE_FAILED", (error as Error)?.message ?? "falha no storage");
    return;
  }

  const config = await getActivePricingConfig();
  const paid = await userHasPaidPurchase(generation.userId);
  const retentionDays = paid ? config.retentionDaysPaid : config.retentionDaysFree;
  const netFactor = 1 - config.paymentFeePct / 100 - config.taxPct / 100;
  // Pós-processamento: custo só registrado internamente (não entra no preço por padrão).
  const postprocessCost = generation.overlays.length > 0 ? config.postprocessCostBrl : 0;
  const grossProfitBrl = generation.revenueAllocatedBrl * netFactor - generation.estimatedCostBrl - postprocessCost;

  // Consome PRIMEIRO (idempotente pela referência) — mesmo raciocínio da devolução.
  const consume = await consumeDeliveredGeneration({
    userId: generation.userId,
    credits: generation.creditCost,
    referenceType: "ai_video_generation",
    referenceId: generation.id,
    description: `Vídeo de ${generation.durationSeconds}s gerado`,
  });
  if (consume.unrecovered > 0) {
    console.warn("[ai-video] recuperação entregou vídeo com créditos já usados", {
      generationId: generation.id,
      userId: generation.userId,
      unrecoveredCredits: consume.unrecovered,
    });
  }
  await updateGeneration(
    generation.id,
    {
      status: "COMPLETED",
      storageVideoUrl: storageUrl,
      completedAt: now,
      nextCheckAt: null,
      providerCharged: true,
      // A API não devolve o custo por tarefa: o custo real = tabela de preço vigente no envio.
      providerActualCostUsd: generation.providerEstimatedCostUsd,
      grossProfitBrl,
      expiresAt: new Date(now.getTime() + retentionDays * 24 * 3600_000),
      errorMessage: null,
      postprocessAttempts: attempt,
    },
    lockToken,
  );
  console.info("[ai-video] geração concluída", {
    generationId: generation.id,
    userId: generation.userId,
    provider: generation.provider,
    model: generation.providerModel,
    tier: generation.tier,
    durationSeconds: generation.durationSeconds,
    credits: generation.creditCost,
    pricingKind: generation.pricingKind,
    overlays: generation.overlays.length,
    providerCostUsd: generation.providerEstimatedCostUsd,
    externalTaskId: generation.externalTaskId,
    latencyMs: now.getTime() - generation.createdAt.getTime(),
  });
}

function isRecoverableLocalError(generation: AiVideoGenerationRecord): boolean {
  return (
    (generation.status === "FAILED" || generation.status === "REFUNDED") &&
    generation.externalTaskId !== null &&
    generation.storageVideoUrl === null
  );
}

/**
 * Recuperação de resultado: se a geração falhou/reembolsou localmente, mas
 * ainda há externalTaskId, consulta o provedor. Se ele concluiu, não cria
 * nova geração: baixa o resultado já pago, salva output_video_url e entrega.
 */
async function recoverCompletedProviderResult(generation: AiVideoGenerationRecord, now: Date): Promise<AiVideoGenerationRecord | null> {
  if (!isRecoverableLocalError(generation)) return null;
  const provider = getImageToVideoProvider(generation.provider);
  if (!provider || !generation.externalTaskId) return null;

  let status;
  try {
    status = await provider.getStatus(generation.externalTaskId);
  } catch (error) {
    console.warn("[ai-video] recuperação não conseguiu consultar provedor", {
      generationId: generation.id,
      provider: generation.provider,
      message: (error as Error)?.message,
    });
    return null;
  }
  if (status.state !== "SUCCEEDED") return null;

  const outputUrl = status.outputUrls[0];
  if (!outputUrl) return null;

  const lockToken = randomUUID();
  const claimed = await claimRecoverableGeneration(generation.id, lockToken, now);
  if (!claimed) return getGenerationById(generation.id);
  await updateGeneration(
    generation.id,
    {
      status: "AI_COMPLETED",
      outputVideoUrl: outputUrl,
      nextCheckAt: now,
      errorKind: null,
      errorCode: null,
      errorMessage: null,
      providerCharged: true,
      providerActualCostUsd: generation.providerEstimatedCostUsd,
    },
    lockToken,
  );

  const reclaimed = await claimGeneration(generation.id, lockToken, now);
  if (reclaimed) await finalizeGeneration(reclaimed, lockToken, now);

  const recovered = await getGenerationById(generation.id);
  console.info("[ai-video] resultado recuperado do provedor", {
    generationId: generation.id,
    userId: generation.userId,
    provider: generation.provider,
    externalTaskId: generation.externalTaskId,
    status: recovered?.status,
  });
  return recovered;
}

/** Um passo da máquina de estados — chamado com o lock da geração já obtido. */
export async function advanceGeneration(generation: AiVideoGenerationRecord, lockToken: string, now: Date = new Date()): Promise<void> {
  const provider = getImageToVideoProvider(generation.provider);
  if (!provider) {
    await refundGeneration(generation, lockToken, now, { kind: "TECHNICAL_ERROR", code: "PROVIDER_NOT_FOUND", message: "Provedor indisponível.", providerCharged: false });
    return;
  }

  // 0) A IA já terminou → validar, aplicar overlays, guardar e consumir.
  if (generation.status === "AI_COMPLETED" || generation.status === "POST_PROCESSING") {
    await finalizeGeneration(generation, lockToken, now);
    return;
  }

  // 1) Reservado, ainda não enviado → enviar (com retry para 429/5xx/rede).
  if (generation.status === "CREDIT_RESERVED") {
    try {
      const { externalTaskId } = await provider.create({
        model: generation.providerModel,
        imageUrl: generation.inputImageUrl,
        prompt: buildProviderPrompt(generation.prompt, generation.preserveText),
        durationSeconds: generation.durationSeconds,
        aspectRatio: generation.aspectRatio,
      });
      await updateGeneration(
        generation.id,
        { status: "SUBMITTED", externalTaskId, submittedAt: now, nextCheckAt: new Date(now.getTime() + POLL_INTERVAL_MS), attempts: generation.attempts + 1 },
        lockToken,
      );
      console.info("[ai-video] tarefa criada no provedor", {
        generationId: generation.id,
        userId: generation.userId,
        provider: generation.provider,
        model: generation.providerModel,
        durationSeconds: generation.durationSeconds,
        credits: generation.creditCost,
        providerCostUsd: generation.providerEstimatedCostUsd,
        externalTaskId,
      });
    } catch (error) {
      const providerError = error instanceof ImageToVideoProviderError ? error : null;
      const attempt = generation.attempts + 1;
      if (providerError?.retryable && attempt <= SUBMIT_RETRY_DELAYS_MINUTES.length) {
        await updateGeneration(
          generation.id,
          { attempts: attempt, nextCheckAt: new Date(now.getTime() + SUBMIT_RETRY_DELAYS_MINUTES[attempt - 1] * 60_000), errorMessage: providerError.message },
          lockToken,
        );
        return;
      }
      await refundGeneration(generation, lockToken, now, {
        kind: providerError?.kind === "TECHNICAL" || !providerError ? "TECHNICAL_ERROR" : "USER_ERROR",
        code: providerError?.kind === "MODERATION" ? "MODERATION" : providerError?.code ?? "SUBMIT_FAILED",
        message: providerError?.message ?? "Não foi possível iniciar a geração.",
        // Recusado antes de gerar: o provedor não cobra.
        providerCharged: false,
      });
    }
    return;
  }

  // 2) Enviado → consultar status.
  if (!generation.externalTaskId) {
    await refundGeneration(generation, lockToken, now, { kind: "TECHNICAL_ERROR", code: "MISSING_TASK", message: "Tarefa não encontrada.", providerCharged: false });
    return;
  }

  const submittedAt = generation.submittedAt ?? generation.createdAt;
  if (now.getTime() - submittedAt.getTime() > MAX_PROCESSING_MS) {
    await provider.cancel(generation.externalTaskId);
    await refundGeneration(generation, lockToken, now, {
      kind: "TECHNICAL_ERROR",
      code: "TIMEOUT",
      message: "O vídeo demorou demais para ficar pronto.",
      // Se o provedor já tinha devolvido o vídeo (só a cópia falhou), ele cobrou.
      providerCharged: Boolean(generation.outputVideoUrl),
    });
    return;
  }

  let status;
  try {
    status = await provider.getStatus(generation.externalTaskId);
  } catch {
    await updateGeneration(generation.id, { nextCheckAt: new Date(now.getTime() + THROTTLED_POLL_INTERVAL_MS) }, lockToken);
    return;
  }

  if (status.state === "QUEUED" || status.state === "PROCESSING") {
    await updateGeneration(
      generation.id,
      {
        status: status.state,
        startedAt: status.state === "PROCESSING" ? generation.startedAt ?? now : generation.startedAt,
        nextCheckAt: new Date(now.getTime() + (status.state === "QUEUED" ? THROTTLED_POLL_INTERVAL_MS : POLL_INTERVAL_MS)),
      },
      lockToken,
    );
    return;
  }

  if (status.state === "SUCCEEDED") {
    const outputUrl = status.outputUrls[0];
    if (!outputUrl) {
      await refundGeneration(generation, lockToken, now, { kind: "TECHNICAL_ERROR", code: "EMPTY_OUTPUT", message: "O provedor não devolveu o vídeo.", providerCharged: true });
      return;
    }
    // A IA terminou: guarda a URL temporária e segue para a finalização
    // (validar o MP4 + overlays). Se o processo cair aqui, o próximo ciclo
    // continua de AI_COMPLETED sem consultar o provedor de novo.
    await updateGeneration(generation.id, { status: "AI_COMPLETED", outputVideoUrl: outputUrl, nextCheckAt: now }, lockToken);
    const reclaimed = await claimGeneration(generation.id, lockToken, now);
    if (reclaimed) await finalizeGeneration(reclaimed, lockToken, now);
    return;
  }

  // FAILED / CANCELLED
  await refundGeneration(generation, lockToken, now, {
    kind: status.failureKind === "TECHNICAL" ? "TECHNICAL_ERROR" : "USER_ERROR",
    code: status.failureKind === "MODERATION" ? "MODERATION" : status.failureCode ?? "PROVIDER_FAILED",
    message:
      status.failureKind === "MODERATION"
        ? "A imagem ou o texto foi recusado pela moderação de conteúdo. Seus créditos foram devolvidos."
        : status.failureKind === "USER_ERROR"
          ? "A imagem não pôde ser usada. Tente outra imagem — seus créditos foram devolvidos."
          : "O serviço de vídeo falhou ao gerar. Seus créditos foram devolvidos.",
    // Política: o usuário recebe os créditos de volta; se o provedor
    // tiver cobrado mesmo assim, o custo fica registrado como prejuízo
    // operacional do Alilu (admin > custos). Por padrão, considera que
    // tarefa com falha não é cobrada — ajustável conforme a fatura real.
    providerCharged: false,
  });
}

/** Consulta da tela: avança a geração se estiver na hora (com lock), e devolve o estado atual. */
export async function refreshGenerationForUser(id: string, userId: string, now: Date = new Date()): Promise<AiVideoGenerationRecord | null> {
  const generation = await getGenerationForUser(id, userId);
  if (!generation) return null;
  const lockToken = randomUUID();
  const claimed = await claimGeneration(id, lockToken, now);
  if (claimed) await advanceGeneration(claimed, lockToken, now);
  const latest = await getGenerationForUser(id, userId);
  if (!latest) return null;
  return (await recoverCompletedProviderResult(latest, now)) ?? latest;
}

export interface AiVideoCronResult {
  processed: number;
  expired: number;
}

/** Cron: avança as gerações em andamento e aplica a retenção dos vídeos guardados. */
export async function runAiVideoCron(options: { now?: () => Date; limit?: number; timeBudgetMs?: number } = {}): Promise<AiVideoCronResult> {
  const now = options.now ?? (() => new Date());
  const limit = Math.max(1, Math.min(options.limit ?? 20, 100));
  const budget = options.timeBudgetMs ?? 45_000;
  const startedAt = Date.now();
  let processed = 0;

  for (const id of await listDueGenerationIds(now(), limit)) {
    if (Date.now() - startedAt > budget) break;
    const lockToken = randomUUID();
    const claimed = await claimGeneration(id, lockToken, now());
    if (!claimed) continue;
    try {
      await advanceGeneration(claimed, lockToken, now());
      processed += 1;
    } catch (error) {
      console.error("[ai-video] falha ao avançar geração", { generationId: id, message: (error as Error)?.message });
      await updateGeneration(id, { nextCheckAt: new Date(now().getTime() + THROTTLED_POLL_INTERVAL_MS) }, lockToken);
    }
  }

  let expired = 0;
  for (const generation of await listExpiredStoredGenerations(now(), 50)) {
    if (Date.now() - startedAt > budget) break;
    try {
      if (generation.storageVideoUrl) await deleteBlob(generation.storageVideoUrl);
      await updateGeneration(generation.id, { status: "EXPIRED", storageVideoUrl: null }, null);
      expired += 1;
    } catch (error) {
      console.error("[ai-video] falha ao apagar vídeo vencido", { generationId: generation.id, message: (error as Error)?.message });
    }
  }

  return { processed, expired };
}

export interface AiVideoOption {
  tier: AiVideoTier;
  durationSeconds: number;
  credits: number;
  /** Preço de "gerar novamente com desconto" nesta combinação. */
  retryCredits: number;
}

/** Combinações que a tela pode oferecer (só linhas ativas cujo provedor aceita a duração). Sem custo/provedor — só créditos. */
export async function listGenerationOptions(): Promise<AiVideoOption[]> {
  const [rows, config] = await Promise.all([listModelPricing(), getActivePricingConfig()]);
  return rows
    .filter((row) => row.isActive)
    .filter((row) => {
      const provider = getImageToVideoProvider(row.provider);
      return provider?.supports({ model: row.providerModel, durationSeconds: row.durationSeconds, aspectRatio: "9:16" }) ?? false;
    })
    .map((row) => ({ tier: row.tier, durationSeconds: row.durationSeconds, credits: row.aliluCreditCost, retryCredits: retryCreditCost(config, row) }));
}
