/**
 * Tipos e constantes da ferramenta "Imagem para vídeo com IA" — módulo
 * puro (sem "server-only"), usado tanto no servidor quanto na tela.
 *
 * CRÉDITO ALILU ≠ CRÉDITO DO PROVEDOR: o usuário só vê créditos Alilu; o
 * custo do provedor (Runway etc.) é do Alilu e fica só no admin.
 */

export type AiVideoTier = "ECONOMICO" | "PADRAO" | "ALTA";
export type AiVideoAspectRatio = "9:16" | "1:1" | "16:9";

export const AI_VIDEO_TIERS: AiVideoTier[] = ["ECONOMICO", "PADRAO", "ALTA"];
export const AI_VIDEO_ASPECT_RATIOS: AiVideoAspectRatio[] = ["9:16", "1:1", "16:9"];

export const AI_VIDEO_TIER_LABEL: Record<AiVideoTier, string> = {
  ECONOMICO: "Econômica",
  PADRAO: "Padrão",
  ALTA: "Alta qualidade",
};

export const AI_VIDEO_TIER_DESCRIPTION: Record<AiVideoTier, string> = {
  ECONOMICO: "Menor custo, ótima para testes e redes sociais.",
  PADRAO: "Movimento mais natural e detalhado.",
  ALTA: "A melhor qualidade disponível.",
};

export const AI_VIDEO_ASPECT_LABEL: Record<AiVideoAspectRatio, string> = {
  "9:16": "9:16 (Reels, Stories, TikTok)",
  "1:1": "1:1 (feed quadrado)",
  "16:9": "16:9 (YouTube, horizontal)",
};

/** Limite do texto de prompt aceito pela Runway (promptText) — mantido como teto do Alilu. */
export const AI_VIDEO_MAX_PROMPT_LENGTH = 1000;

/** Imagem de entrada: até 16 MB, JPEG/PNG/WebP. */
export const AI_VIDEO_MAX_IMAGE_BYTES = 16 * 1024 * 1024;
export const AI_VIDEO_IMAGE_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const AI_VIDEO_PROMPT_SUGGESTIONS = [
  "Pessoa digitando no computador, movimento natural das mãos",
  "Movimento suave de câmera, aproximando devagar",
  "Zoom cinematográfico lento, luz suave",
  "Produto girando lentamente sobre a mesa",
  "Folhas e cabelo se mexendo com o vento",
  "Câmera passeando da esquerda para a direita",
];

export type AiVideoGenerationStatus =
  | "CREATED"
  | "CREDIT_RESERVED"
  | "SUBMITTED"
  | "QUEUED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "REFUNDED"
  | "PRICE_GUARD_BLOCKED"
  | "EXPIRED";

export const AI_VIDEO_IN_PROGRESS_STATUSES: AiVideoGenerationStatus[] = [
  "CREATED",
  "CREDIT_RESERVED",
  "SUBMITTED",
  "QUEUED",
  "PROCESSING",
];

export type CreditTransactionType =
  | "PURCHASE"
  | "BONUS"
  | "RESERVE"
  | "CONSUME"
  | "REFUND"
  | "ADMIN_ADJUSTMENT"
  | "EXPIRE"
  | "PURCHASE_REFUND"
  | "CHARGEBACK";

export const CREDIT_TRANSACTION_LABEL: Record<CreditTransactionType, string> = {
  PURCHASE: "Compra de créditos",
  BONUS: "Bônus",
  RESERVE: "Reserva para geração",
  CONSUME: "Vídeo gerado",
  REFUND: "Devolução",
  ADMIN_ADJUSTMENT: "Ajuste",
  EXPIRE: "Expiração",
  PURCHASE_REFUND: "Reembolso de compra",
  CHARGEBACK: "Contestação de pagamento",
};

/** Regra comercial ativa (ai_pricing_config). Percentuais em 0..100. */
export interface AiPricingConfig {
  id: string;
  creditValueBrl: number;
  targetGrossMarginPct: number;
  minimumGrossMarginPct: number;
  usdBrlReferenceRate: number;
  providerCostSafetyMultiplier: number;
  paymentFeePct: number;
  taxPct: number;
  infraCostBrlPerGeneration: number;
  welcomeBonusCredits: number;
  maxProviderCostUsd: number;
  dailyProviderSpendLimitUsd: number;
  monthlyProviderSpendLimitUsd: number;
  maxGenerationsPerUserPerHour: number;
  moderationStrikesBeforeBlock: number;
  moderationBlockHours: number;
  retentionDaysFree: number;
  retentionDaysPaid: number;
  purchaseRefundWindowDays: number;
  effectiveFrom: string;
}

/** Linha de ai_video_model_pricing. */
export interface AiVideoModelPricing {
  id: string;
  tier: AiVideoTier;
  provider: string;
  providerModel: string;
  friendlyName: string;
  resolution: string;
  durationSeconds: number;
  providerCreditsPerSecond: number;
  providerFixedCredits: number;
  providerCreditUsd: number;
  aliluCreditCost: number;
  isActive: boolean;
}

export interface AiCreditPackage {
  id: string;
  code: string;
  name: string;
  credits: number;
  bonusCredits: number;
  priceCents: number;
  isActive: boolean;
  displayOrder: number;
}
