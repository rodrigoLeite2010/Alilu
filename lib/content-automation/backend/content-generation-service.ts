import "server-only";
import { getContentAIProvider } from "./provider-factory";
import { recordGenerationUsage } from "./generation-usage-repository";
import { listRecentGenerationsForAutomation } from "./automation-run-repository";
import { composeCaption } from "./compose-caption";
import type { AutomationDayRecord, AutomationRecord } from "./automation-types";

/**
 * Combina contexto geral da marca + prompt do dia + tipo de conteúdo +
 * histórico recente (seção 8/13/21 do briefing) e chama o provedor de IA
 * configurado. Nunca fala com a Meta nem cria a publicação — isso é
 * orquestrado por content-automation-cron.ts, que usa o resultado daqui
 * junto com o pipeline de publicação já existente (createDraftImagePost /
 * createDraftReelPost).
 */

export interface GeneratedPostForPublication {
  caption: string;
  title: string;
  hashtags: string[];
  visualDescription: string;
  /** Presente só quando chamado com includeVisualText=true (dia em modo AUTO_TEMPLATE). */
  visualText?: string;
}

export interface GeneratedReelForPublication {
  caption: string;
  title: string;
  hashtags: string[];
  coverText: string;
  hook: string;
  script: string;
}

export async function generatePostContentForRun(
  automation: AutomationRecord,
  day: AutomationDayRecord,
  runId: string,
  options: { includeVisualText?: boolean } = {},
): Promise<GeneratedPostForPublication> {
  const provider = getContentAIProvider();
  const recent = await listRecentGenerationsForAutomation(automation.id, 7);
  const avoidTopics = recent.map((item) => item.caption).filter(Boolean);

  const { content, usage } = await provider.generatePost({
    brandContext: automation.brandContext,
    dayPrompt: day.prompt,
    avoidTopics,
    includeVisualText: options.includeVisualText,
  });
  await recordGenerationUsage(automation.id, runId, usage);

  return {
    title: content.title,
    hashtags: content.hashtags,
    visualDescription: content.visualDescription,
    visualText: content.visualText,
    caption: composeCaption(content.caption, content.cta, content.hashtags),
  };
}

export async function generateReelContentForRun(
  automation: AutomationRecord,
  day: AutomationDayRecord,
  runId: string,
): Promise<GeneratedReelForPublication> {
  const provider = getContentAIProvider();
  const recent = await listRecentGenerationsForAutomation(automation.id, 7);
  const avoidTopics = recent.map((item) => item.caption).filter(Boolean);

  const { content, usage } = await provider.generateReel({
    brandContext: automation.brandContext,
    dayPrompt: day.prompt,
    avoidTopics,
  });
  await recordGenerationUsage(automation.id, runId, usage);

  return {
    title: content.title,
    hook: content.hook,
    script: content.script,
    coverText: content.coverText,
    hashtags: content.hashtags,
    caption: composeCaption(content.caption, "", content.hashtags),
  };
}
