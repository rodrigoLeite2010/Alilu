import "server-only";
import { getContentAIProvider } from "./provider-factory";
import { recordGenerationUsage } from "./generation-usage-repository";
import { listRecentGenerationsForAutomation } from "./automation-run-repository";
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
}

export interface GeneratedReelForPublication {
  caption: string;
  title: string;
  hashtags: string[];
  coverText: string;
  hook: string;
  script: string;
}

/**
 * A legenda gravada em instagram_posts.caption é UM texto só (como em
 * todo o resto do projeto — ver captions/generate.ts): corpo + CTA (se
 * ainda não estiver embutido) + hashtags ao final, mesmo formato que o
 * Gerador de Legendas já produz.
 */
function composeCaption(bodyCaption: string, cta: string, hashtags: string[]): string {
  const parts = [bodyCaption.trim()];
  if (cta && !bodyCaption.toLowerCase().includes(cta.toLowerCase())) {
    parts.push(cta.trim());
  }
  if (hashtags.length > 0) {
    parts.push(hashtags.join(" "));
  }
  return parts.filter(Boolean).join("\n\n");
}

export async function generatePostContentForRun(
  automation: AutomationRecord,
  day: AutomationDayRecord,
  runId: string,
): Promise<GeneratedPostForPublication> {
  const provider = getContentAIProvider();
  const recent = await listRecentGenerationsForAutomation(automation.id, 7);
  const avoidTopics = recent.map((item) => item.caption).filter(Boolean);

  const { content, usage } = await provider.generatePost({
    brandContext: automation.brandContext,
    dayPrompt: day.prompt,
    avoidTopics,
  });
  await recordGenerationUsage(automation.id, runId, usage);

  return {
    title: content.title,
    hashtags: content.hashtags,
    visualDescription: content.visualDescription,
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
