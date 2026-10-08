import "server-only";
import { getDb } from "@/lib/db/client";
import {
  AI_VIDEO_ISSUE_TYPES,
  AI_VIDEO_ISSUE_TYPES_REVALIDATED,
  type AiVideoIssueType,
} from "../types";
import { getActivePricingConfig } from "./pricing-repository";
import { applyWalletMovement } from "./wallet-repository";
import { getGenerationForUser, updateGeneration, type AiVideoGenerationRecord } from "./generation-repository";
import { processAiVideo, VideoOutputInvalidError } from "./video-overlay-service";
import { AiVideoError } from "./generation-service";

/**
 * "Reportar problema" de um vídeo CONCLUÍDO. Política:
 *   - vídeo corrompido / erro técnico → o servidor baixa e revalida o MP4
 *     (ffprobe); defeito confirmado = devolução automática dos créditos;
 *   - demais casos (movimento, resultado diferente, texto/logo…) → o vídeo
 *     é tecnicamente válido: oferece "gerar novamente com desconto";
 *   - um reporte por vídeo; muitos reportes em 30 dias marcam o usuário
 *     para revisão no admin (sem bloqueio automático nesta versão).
 * Falhas detectáveis automaticamente (FAILED, arquivo vazio, sem duração,
 * erro do provedor) já são devolvidas sem depender de reporte.
 */

export type IssueResolution = "REFUNDED" | "RETRY_OFFERED" | "PENDING_REVIEW";

export interface ReportIssueResult {
  resolution: IssueResolution;
  refundedCredits: number;
  flaggedForReview: boolean;
  generation: AiVideoGenerationRecord;
}

async function revalidateStoredVideo(generation: AiVideoGenerationRecord): Promise<"INVALID" | "VALID" | "UNKNOWN"> {
  if (!generation.storageVideoUrl) return "UNKNOWN";
  let buffer: Buffer;
  try {
    const response = await fetch(generation.storageVideoUrl);
    if (response.status === 404) return "INVALID";
    if (!response.ok) return "UNKNOWN";
    buffer = Buffer.from(await response.arrayBuffer());
  } catch {
    return "UNKNOWN";
  }
  try {
    await processAiVideo({ videoBuffer: buffer, overlays: [], loadOverlayImage: async () => Buffer.alloc(0) });
    return "VALID";
  } catch (error) {
    return error instanceof VideoOutputInvalidError ? "INVALID" : "UNKNOWN";
  }
}

export async function reportGenerationIssue(
  userId: string,
  generationId: string,
  input: { issueType: unknown; description?: unknown },
  now: Date = new Date(),
): Promise<ReportIssueResult> {
  const issueType = String(input.issueType ?? "") as AiVideoIssueType;
  if (!AI_VIDEO_ISSUE_TYPES.includes(issueType)) throw new AiVideoError("Escolha o tipo de problema.", "INVALID_ISSUE_TYPE", 400);
  const description = typeof input.description === "string" ? input.description.trim().slice(0, 1000) : "";

  const generation = await getGenerationForUser(generationId, userId);
  if (!generation || (generation.status !== "COMPLETED" && generation.status !== "EXPIRED")) {
    throw new AiVideoError("Só é possível reportar um vídeo concluído.", "ISSUE_NOT_ALLOWED", 400);
  }

  const db = getDb();
  const inserted = await db`
    insert into ai_video_generation_issues (generation_id, user_id, issue_type, description)
    values (${generation.id}, ${userId}, ${issueType}, ${description})
    on conflict (generation_id, user_id) do nothing
    returning id
  `;
  if (!inserted[0]) throw new AiVideoError("Você já reportou um problema neste vídeo.", "ISSUE_ALREADY_REPORTED", 409);
  const issueId = inserted[0].id as string;

  let resolution: IssueResolution = "RETRY_OFFERED";
  let refundedCredits = 0;
  if (AI_VIDEO_ISSUE_TYPES_REVALIDATED.includes(issueType)) {
    const check = await revalidateStoredVideo(generation);
    if (check === "INVALID") {
      // Créditos já consumidos voltam ao disponível (idempotente pela referência). Admin isento: nada foi cobrado.
      const refund = generation.creditBypass
        ? ({ status: "duplicate" } as const)
        : await applyWalletMovement({
        userId,
        type: "REFUND",
        availableDelta: generation.creditCost,
        reservedDelta: 0,
        referenceType: "ai_video_generation",
        referenceId: generation.id,
        description: "Devolução — vídeo com defeito confirmado",
      });
      if (refund.status === "applied") refundedCredits = generation.creditCost;
      await updateGeneration(
        generation.id,
        { status: "REFUNDED", errorKind: "TECHNICAL_ERROR", errorCode: "REPORTED_INVALID", errorMessage: "O vídeo estava com defeito. Seus créditos foram devolvidos." },
        null,
      );
      resolution = "REFUNDED";
    } else if (check === "UNKNOWN") {
      resolution = "PENDING_REVIEW";
    }
  }
  await db`update ai_video_generation_issues set resolution = ${resolution} where id = ${issueId}`;

  const config = await getActivePricingConfig();
  const since = new Date(now.getTime() - 30 * 24 * 3600_000);
  const [count] = await db`
    select count(*)::int as total from ai_video_generation_issues where user_id = ${userId} and created_at >= ${since.toISOString()}
  `;
  const flaggedForReview = Number(count?.total ?? 0) >= config.issueReviewThreshold;
  console.info("[ai-video] problema reportado", {
    generationId: generation.id,
    userId,
    issueType,
    resolution,
    refundedCredits,
    flaggedForReview,
  });
  if (flaggedForReview) console.warn("[ai-video] usuário marcado para revisão (muitos reportes)", { userId, reports30d: Number(count?.total ?? 0) });

  return { resolution, refundedCredits, flaggedForReview, generation: (await getGenerationForUser(generation.id, userId))! };
}
