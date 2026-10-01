import "server-only";
import type { AiVideoGenerationRecord } from "./generation-repository";
import { aiVideoProgressLabel } from "../types";
import type { CreditTransactionRecord, WalletRecord } from "./wallet-repository";
import type { CreditPurchaseRecord } from "./credit-purchase-repository";

/**
 * Serialização para o usuário comum — NUNCA expõe provedor, modelo,
 * custo do provedor, task id externo nem margem (isso é só do admin).
 */

export function serializeGenerationForUser(generation: AiVideoGenerationRecord) {
  return {
    progressLabel: aiVideoProgressLabel(generation.status, generation.overlays.length > 0),
    preserveText: generation.preserveText,
    overlays: generation.overlays,
    parentGenerationId: generation.parentGenerationId,
    isDiscountedRetry: generation.pricingKind === "RETRY_DISCOUNT",
    listCreditCost: generation.listCreditCost,
    liked: generation.userFeedback === "LIKED",
    id: generation.id,
    tier: generation.tier,
    prompt: generation.prompt,
    inputImageUrl: generation.inputImageUrl,
    durationSeconds: generation.durationSeconds,
    aspectRatio: generation.aspectRatio,
    creditCost: generation.creditCost,
    status: generation.status,
    videoUrl: generation.storageVideoUrl,
    errorMessage: generation.status === "FAILED" || generation.status === "REFUNDED" ? generation.errorMessage : null,
    expiresAt: generation.expiresAt ? generation.expiresAt.toISOString() : null,
    createdAt: generation.createdAt.toISOString(),
    completedAt: generation.completedAt ? generation.completedAt.toISOString() : null,
  };
}

export type AiVideoGenerationDto = ReturnType<typeof serializeGenerationForUser>;

export function serializeWallet(wallet: WalletRecord | null) {
  return { available: wallet?.available ?? 0, reserved: wallet?.reserved ?? 0 };
}

export function serializeTransaction(transaction: CreditTransactionRecord) {
  return {
    id: transaction.id,
    type: transaction.type,
    amount: transaction.amount,
    reservedDelta: transaction.reservedDelta,
    availableAfter: transaction.availableAfter,
    description: transaction.description,
    createdAt: transaction.createdAt.toISOString(),
  };
}

export function serializePurchase(purchase: CreditPurchaseRecord, refundWindowDays: number, now: Date = new Date()) {
  const refundable =
    purchase.status === "PAID" &&
    purchase.paidAt !== null &&
    now.getTime() - purchase.paidAt.getTime() <= refundWindowDays * 24 * 3600_000;
  return {
    id: purchase.id,
    packageName: purchase.packageName,
    credits: purchase.credits + purchase.bonusCredits,
    priceCents: purchase.priceCents,
    status: purchase.status,
    invoiceUrl: purchase.status === "PENDING" ? purchase.invoiceUrl : null,
    paidAt: purchase.paidAt ? purchase.paidAt.toISOString() : null,
    createdAt: purchase.createdAt.toISOString(),
    refundable,
  };
}
