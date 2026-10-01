import "server-only";
import type { AiVideoAspectRatio } from "../../types";

/**
 * Contrato único de um provedor de "imagem → vídeo". A regra de negócio
 * (créditos, preço, status, storage) nunca fala com a Runway — ou com
 * Luma/Kling/Veo/Fal no futuro — diretamente, só com esta interface. Um
 * provedor novo é: implementar a interface + registrar em
 * provider-registry.ts + cadastrar a linha de preço em
 * ai_video_model_pricing. Nada de cron/UI/banco muda.
 */

export interface ImageToVideoRequest {
  /** Modelo do provedor (ex.: "gen4_turbo"), vindo de ai_video_model_pricing. */
  model: string;
  /** URL HTTPS pública da imagem (Vercel Blob). */
  imageUrl: string;
  prompt: string;
  durationSeconds: number;
  aspectRatio: AiVideoAspectRatio;
}

export interface CreateVideoResult {
  externalTaskId: string;
}

export type ProviderTaskState = "QUEUED" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "CANCELLED";

export interface VideoGenerationStatus {
  state: ProviderTaskState;
  /** URLs temporárias do resultado (só em SUCCEEDED) — precisam ser copiadas para o storage do Alilu. */
  outputUrls: string[];
  failureCode: string | null;
  failureMessage: string | null;
  /** Classificação da falha para a política de créditos e de moderação. */
  failureKind: "USER_ERROR" | "MODERATION" | "TECHNICAL" | null;
}

/** Erro de chamada ao provedor, já classificado. */
export class ImageToVideoProviderError extends Error {
  constructor(
    message: string,
    readonly kind: "USER_ERROR" | "MODERATION" | "TECHNICAL",
    /** true = vale tentar de novo (429, 5xx, rede). */
    readonly retryable: boolean,
    readonly httpStatus: number | null,
    readonly code: string | null = null,
  ) {
    super(message);
    this.name = "ImageToVideoProviderError";
  }
}

export interface ImageToVideoProvider {
  readonly providerId: string;
  /** Aceita esta combinação (modelo, duração, proporção)? Validado ANTES de reservar créditos. */
  supports(request: Omit<ImageToVideoRequest, "imageUrl" | "prompt">): boolean;
  create(request: ImageToVideoRequest): Promise<CreateVideoResult>;
  getStatus(externalTaskId: string): Promise<VideoGenerationStatus>;
  /** Tenta cancelar uma tarefa presa (melhor esforço, nunca lança). */
  cancel(externalTaskId: string): Promise<void>;
}
