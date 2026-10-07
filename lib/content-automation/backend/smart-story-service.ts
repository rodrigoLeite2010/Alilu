import "server-only";
import { generateStoryContent, type StoryAiCaller } from "../smart-story/engine";
import { bucketForTime, normalizeSmartStoryConfig, type SmartStoryConfig } from "../smart-story/config";
import { planStory } from "../smart-story/selection";
import {
  getSmartStoryForSlot,
  insertSmartStoryOnce,
  listRecentSmartStories,
  toHistoryItem,
  type SmartStoryRecord,
} from "./smart-story-repository";

export interface PrepareSmartStoryInput {
  userId: string;
  automationId: string;
  runId: string | null;
  /** Instante UTC agendado deste Story (chave de idempotência junto da automação). */
  scheduledAt: Date;
  /** "HH:mm" no fuso da automação (decide a faixa do dia). */
  time: string;
  /** smart_story_config bruto (jsonb) — normalizado aqui, nunca confiado. */
  rawConfig: unknown;
  basePrompt: string;
  brandContext: string;
  dayOfWeekLabel?: string;
  /** Chamada à IA (Fase 4 injeta provider.rewriteText + recordGenerationUsage). Nunca recebe/expõe chaves. */
  callAi: StoryAiCaller;
  config?: SmartStoryConfig;
}

export interface PreparedSmartStory {
  record: SmartStoryRecord;
  /** false = já existia (retry/duplicata) e NADA foi gerado de novo. */
  created: boolean;
  usages: unknown[];
}

/** Semente estável do horário: o mesmo horário sempre planeja o mesmo Story. */
export function storySeed(automationId: string, scheduledAt: Date): string {
  return `${automationId}|${scheduledAt.toISOString()}`;
}

/**
 * Decide, gera e grava o Story inteligente de UM horário. Idempotente:
 * se já existe registro de (automação, horário), devolve ESSE — um retry
 * (cron duplicado, nova tentativa de render/publicação) republica o MESMO
 * Story, sem nova chamada à IA e sem consumir outro uso do plano.
 */
export async function prepareSmartStory(input: PrepareSmartStoryInput): Promise<PreparedSmartStory> {
  const existing = await getSmartStoryForSlot(input.automationId, input.scheduledAt);
  if (existing) return { record: existing, created: false, usages: [] };

  const config = input.config ?? normalizeSmartStoryConfig(input.rawConfig);
  const historyLimit = Math.max(config.avoidTypeWindow, config.contextWindow, 1);
  // Só Stories ANTERIORES a este horário: reprocessar um horário antigo não "vê o futuro".
  const history = (await listRecentSmartStories(input.automationId, historyLimit, input.scheduledAt)).map(toHistoryItem);
  const seed = storySeed(input.automationId, input.scheduledAt);
  const plan = planStory({ seed, time: input.time, config, history });

  const generated = await generateStoryContent({
    plan,
    seed,
    basePrompt: input.basePrompt,
    brandContext: input.brandContext,
    dayOfWeekLabel: input.dayOfWeekLabel,
    history,
    contextWindow: config.contextWindow,
    callAi: input.callAi,
  });

  const { record, created } = await insertSmartStoryOnce({
    userId: input.userId,
    automationId: input.automationId,
    runId: input.runId,
    scheduledAt: input.scheduledAt,
    content: generated.content,
    theme: plan.theme,
    promptUsed: generated.promptUsed,
    usedMascot: plan.useMascot,
    layout: plan.layout,
    sequenceCount: plan.sequenceCount,
    source: generated.source,
    attempts: generated.attempts,
    generationError: generated.errors.length > 0 ? generated.errors.join(" | ").slice(0, 1000) : null,
  });
  console.info("[smart-story] story planejado", {
    automationId: input.automationId,
    storyType: plan.type,
    theme: plan.theme,
    bucket: bucketForTime(config, input.time).id,
    source: generated.source,
    attempts: generated.attempts,
    created,
  });
  return { record, created, usages: generated.usages };
}
