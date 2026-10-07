import "server-only";
import { createDraftStoryPost } from "@/lib/instagram/backend/instagram-post-repository";
import { DAY_OF_WEEK_LABEL, type AutomationDayRecord, type AutomationRecord } from "./automation-types";
import { getContentAIProvider } from "./provider-factory";
import { recordGenerationUsage } from "./generation-usage-repository";
import type { AIGenerationUsage } from "./ai-provider";
import type { StoryAiCaller } from "../smart-story/engine";
import { composeStoryRenderInput } from "../smart-story/compose";
import { renderAndStoreSmartStory } from "../smart-story/render/render-service";
import {
  findPostIdByMedia,
  listRecentSmartStories,
  updateSmartStoryProgress,
  type SmartStoryRecord,
} from "./smart-story-repository";
import { resolveStoryBrand } from "./smart-story-brand-service";
import { prepareSmartStory, storySeed } from "./smart-story-service";

/**
 * IA do Story inteligente: o MESMO provedor/modelo/chave do Piloto
 * Automático (getContentAIProvider → CONTENT_AI_*), pelo método de JSON
 * livre que ele já tem (rewriteText). Provedor sem esse método, sem chave
 * ou fora do ar = erro aqui → o motor cai no fallback (nunca aborta).
 */
export const callStoryAi: StoryAiCaller = async (prompt) => {
  const provider = getContentAIProvider();
  if (!provider.rewriteText) throw new Error("O provedor de IA configurado não gera conteúdo estruturado de Story.");
  const { content, usage } = await provider.rewriteText({ prompt, maxOutputTokens: 700 });
  return { content, usage };
};

export interface CreateSmartStoryPublicationInput {
  automation: AutomationRecord;
  /** Dia/horário da execução, com as variáveis {{…}} do prompt já resolvidas. */
  day: AutomationDayRecord;
  runId: string;
  /** Instante UTC do horário agendado (chave de idempotência junto da automação). */
  publishAtUtc: Date;
  /** Quando a publicação é agendada para publicar sozinha; null = fica aguardando aprovação. */
  scheduledAtUtc: Date | null;
  callAi?: StoryAiCaller;
}

export interface SmartStoryPublication {
  publicationId: string;
  record: SmartStoryRecord;
  /** false = o Story já existia (retry/duplicata): nada foi gerado/renderizado de novo. */
  reused: boolean;
}

function message(error: unknown): string {
  return (error instanceof Error ? error.message : "Falha desconhecida.").slice(0, 500);
}

/**
 * Gera (ou REAPROVEITA) o Story inteligente de um horário e cria a
 * publicação no fluxo normal (instagram_posts, source AUTOMATION). É chamado
 * pelo ramo STORY do cron — nenhum scheduler novo.
 *
 * Idempotência e retry, na ordem:
 *   1. Story do horário (automação + horário) já existe → mesmo conteúdo,
 *      sem nova IA (prepareSmartStory);
 *   2. já tem post vinculado → devolve ESSE post (republicar = o mesmo Story);
 *   3. já tem arte (image_media_id) → não renderiza de novo; antes de criar
 *      o post, procura um post dessa arte (queda entre criar e vincular);
 *   4. só então renderiza → cria o post → vincula.
 * Falha de render marca o Story como FAILED e propaga o erro: o cron marca a
 * execução FAILED e tenta de novo com o backoff de sempre (e cai no passo 3/4).
 */
export async function createSmartStoryPublication(input: CreateSmartStoryPublicationInput): Promise<SmartStoryPublication> {
  const { automation, day, runId, publishAtUtc } = input;
  const config = automation.smartStory.config;
  // Identidade do DONO da automação: o Alilu só aparece para a conta do Alilu.
  const brand = await resolveStoryBrand(automation.userId);

  const prepared = await prepareSmartStory({
    userId: automation.userId,
    automationId: automation.id,
    runId,
    scheduledAt: publishAtUtc,
    time: day.publishTime,
    rawConfig: config,
    config,
    basePrompt: day.prompt,
    brandContext: automation.brandContext,
    dayOfWeekLabel: DAY_OF_WEEK_LABEL[day.dayOfWeek],
    callAi: input.callAi ?? callStoryAi,
    brand,
  });
  for (const usage of prepared.usages) {
    await recordGenerationUsage(automation.id, runId, usage as AIGenerationUsage, automation.userId);
  }
  const record = prepared.record;

  if (record.instagramPostId) return { publicationId: record.instagramPostId, record, reused: true };

  let mediaId = record.imageMediaId;
  if (mediaId) {
    const existingPost = await findPostIdByMedia(mediaId);
    if (existingPost) {
      await updateSmartStoryProgress(record.id, { status: "READY", instagramPostId: existingPost, runId });
      return { publicationId: existingPost, record: { ...record, instagramPostId: existingPost }, reused: true };
    }
  } else {
    await updateSmartStoryProgress(record.id, { status: "RENDERING", runId });
    const recent = await listRecentSmartStories(automation.id, 3, publishAtUtc);
    const renderInput = composeStoryRenderInput({
      content: record.content,
      plan: { useMascot: record.usedMascot },
      config,
      brand,
      seed: storySeed(automation.id, publishAtUtc),
      recentBackgroundIds: recent.map((item) => item.backgroundId).filter((id): id is string => Boolean(id)),
    });
    try {
      const stored = await renderAndStoreSmartStory({
        userId: automation.userId,
        automationRunId: runId,
        ...renderInput,
      });
      mediaId = stored.mediaId;
      await updateSmartStoryProgress(record.id, {
        status: "READY",
        imageMediaId: stored.mediaId,
        imageUrl: stored.imageUrl,
        templateId: stored.templateId,
        backgroundId: stored.backgroundId,
        usedMascot: stored.mascotDrawn,
      });
    } catch (error) {
      await updateSmartStoryProgress(record.id, { status: "FAILED", error: `render: ${message(error)}` });
      throw error;
    }
  }

  const publicationId = await createDraftStoryPost({
    userId: automation.userId,
    instagramAccountId: automation.instagramAccountId,
    mediaId,
    caption: "",
    scheduledAtUtc: input.scheduledAtUtc,
    timezone: automation.timezone,
    source: "AUTOMATION",
  });
  await updateSmartStoryProgress(record.id, { status: "READY", instagramPostId: publicationId });
  return { publicationId, record: { ...record, instagramPostId: publicationId }, reused: false };
}
