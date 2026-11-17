import "server-only";
import { canUseAiAutomation } from "@/lib/billing/backend/automation-access-service";
import { recordUserAiUsage } from "@/lib/billing/backend/ai-usage-repository";
import { AIProviderConfigError } from "@/lib/content-automation/backend/ai-provider";
import { getContentAIProvider } from "@/lib/content-automation/backend/provider-factory";
import {
  buildBriefPrompt,
  buildCaptionPrompt,
  buildClassificationPrompt,
  sanitizeBrief,
  sanitizeCaption,
  sanitizeClassification,
  type CandidateForAi,
  type Classification,
  type ContentBrief,
  type GeneratedCaption,
  type TrustedHeadline,
} from "@/lib/viral-radar/ai-prompts";
import type { CaptionStyle } from "@/lib/viral-radar/types";
import { countRadarEventsSince, insertRadarEvent } from "./radar-repository";

/**
 * IA do Radar Viral — o MESMO provedor do Piloto Automático
 * (getContentAIProvider().rewriteText), mesmo controle de plano
 * (canUseAiAutomation) e registro de custo em generation_usage
 * (feature "viral_radar"). Cada radar tem teto diário próprio
 * (ai_daily_cap). Nenhum provedor/dependência paga nova.
 *
 * A IA é opcional: sem chave/plano/teto, o radar segue com regras simples
 * (relevância por palavras-chave, legenda pelo modelo da fila).
 */

export const AI_EVENTS = ["ai_classify", "ai_caption", "ai_brief"];

export class RadarAiUnavailable extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "RadarAiUnavailable";
  }
}

function dayStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

async function assertAiAllowed(userId: string, radarId: string, dailyCap: number, now: Date): Promise<void> {
  if (dailyCap <= 0) throw new RadarAiUnavailable("IA desativada neste radar (limite diário 0).", "AI_DISABLED");
  const used = await countRadarEventsSince(radarId, AI_EVENTS, dayStart(now));
  if (used >= dailyCap) throw new RadarAiUnavailable(`Limite diário de IA deste radar atingido (${dailyCap}).`, "AI_DAILY_CAP");
  const access = await canUseAiAutomation(userId, now);
  if (!access.allowed) throw new RadarAiUnavailable(access.reason ?? "Seu plano não inclui IA.", access.code ?? "AI_PLAN_REQUIRED");
}

async function callProvider(userId: string, prompt: string, maxOutputTokens: number): Promise<Record<string, unknown>> {
  let provider;
  try {
    provider = getContentAIProvider();
  } catch (error) {
    if (error instanceof AIProviderConfigError) throw new RadarAiUnavailable("IA não configurada (CONTENT_AI_API_KEY/CONTENT_AI_MODEL).", "AI_NOT_CONFIGURED");
    throw error;
  }
  if (!provider.rewriteText) throw new RadarAiUnavailable("O provedor de IA configurado não suporta esta operação.", "AI_UNSUPPORTED");
  const { content, usage } = await provider.rewriteText({ prompt, maxOutputTokens });
  await recordUserAiUsage({
    userId,
    feature: "viral_radar",
    provider: usage.provider,
    model: usage.model,
    tokensInput: usage.tokensInput,
    tokensOutput: usage.tokensOutput,
  });
  return content;
}

interface AiCallContext {
  userId: string;
  radarId: string;
  candidateId: string | null;
  dailyCap: number;
  now: Date;
}

export async function classifyWithAi(ctx: AiCallContext, candidate: CandidateForAi, theme: string): Promise<Classification> {
  await assertAiAllowed(ctx.userId, ctx.radarId, ctx.dailyCap, ctx.now);
  await insertRadarEvent(ctx.radarId, ctx.candidateId, "ai_classify", null);
  return sanitizeClassification(await callProvider(ctx.userId, buildClassificationPrompt(candidate, theme), 500));
}

export async function captionWithAi(
  ctx: AiCallContext,
  input: { candidate: CandidateForAi; theme: string; style: CaptionStyle; hashtags: string[]; ownContent: boolean },
): Promise<GeneratedCaption> {
  await assertAiAllowed(ctx.userId, ctx.radarId, ctx.dailyCap, ctx.now);
  await insertRadarEvent(ctx.radarId, ctx.candidateId, "ai_caption", null);
  const result = sanitizeCaption(await callProvider(ctx.userId, buildCaptionPrompt(input), 900), false);
  if (!result) throw new RadarAiUnavailable("A IA devolveu uma legenda inválida.", "AI_BAD_OUTPUT");
  return result;
}

export async function briefWithAi(
  ctx: AiCallContext,
  input: { candidate: CandidateForAi; theme: string; style: CaptionStyle; headlines: TrustedHeadline[]; referenceUrl: string },
): Promise<ContentBrief> {
  await assertAiAllowed(ctx.userId, ctx.radarId, ctx.dailyCap, ctx.now);
  await insertRadarEvent(ctx.radarId, ctx.candidateId, "ai_brief", null);
  return sanitizeBrief(await callProvider(ctx.userId, buildBriefPrompt(input), 1500), input.headlines, input.referenceUrl);
}
