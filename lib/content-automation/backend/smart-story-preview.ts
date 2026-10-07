import "server-only";
import { generateStoryContent, type StoryAiCaller } from "../smart-story/engine";
import { normalizeSmartStoryConfig } from "../smart-story/config";
import { planStory } from "../smart-story/selection";
import { composeStoryRenderInput } from "../smart-story/compose";
import { renderSmartStoryBuffer } from "../smart-story/render/render-service";
import { isStoryType, type StoryContent, type StoryHistoryItem, type StoryType } from "../smart-story/types";

export interface SmartStoryPreviewInput {
  /** Configuração em edição (bruta — normalizada aqui, nunca confiada). */
  rawConfig: unknown;
  basePrompt: string;
  brandContext: string;
  /** "HH:mm" que decide a faixa do dia. */
  time: string;
  /** Muda a cada "Gerar outro" — só alimenta a semente (a prévia é descartável). */
  nonce: string;
  /** Tipos já mostrados nesta sessão de prévia (evita repetir no "Gerar outro"). */
  previousTypes?: unknown;
  userId: string;
  callAi: StoryAiCaller;
}

export interface SmartStoryPreviewResult {
  dataUrl: string;
  content: StoryContent;
  plan: { type: StoryType; theme: string; useMascot: boolean; timeBucket: string };
  source: "AI" | "FALLBACK";
  mascotDrawn: boolean;
  warnings: string[];
}

/**
 * "Gerar exemplo": roda o MESMO caminho da geração real (plano → IA →
 * validação/fallback → arte) mas NÃO grava nada — sem Blob, sem
 * smart_story_generations, sem instagram_posts, sem uso do plano. A
 * semente é da prévia (não do horário), então "Gerar outro" varia.
 */
export async function buildSmartStoryPreview(input: SmartStoryPreviewInput): Promise<SmartStoryPreviewResult> {
  const config = normalizeSmartStoryConfig(input.rawConfig);
  const seed = `preview|${input.userId}|${input.nonce}`;
  const previous = (Array.isArray(input.previousTypes) ? input.previousTypes : []).filter(isStoryType).slice(0, 10);
  // Histórico sintético: só o tipo importa para a antirrepetição da prévia.
  const history: StoryHistoryItem[] = previous.map((storyType) => ({
    storyType,
    headline: "",
    topic: "",
    cta: "",
    usedMascot: false,
    generatedAt: new Date(),
  }));
  const plan = planStory({ seed, time: input.time, config, history });
  const generated = await generateStoryContent({
    plan,
    seed,
    basePrompt: input.basePrompt,
    brandContext: input.brandContext,
    history,
    contextWindow: 0,
    callAi: input.callAi,
  });
  const rendered = await renderSmartStoryBuffer(
    composeStoryRenderInput({ content: generated.content, plan, config, seed }),
  );
  return {
    dataUrl: `data:${rendered.contentType};base64,${rendered.buffer.toString("base64")}`,
    content: generated.content,
    plan: { type: plan.type, theme: plan.theme, useMascot: plan.useMascot, timeBucket: plan.timeBucket },
    source: generated.source,
    mascotDrawn: rendered.mascotDrawn,
    warnings: rendered.warnings,
  };
}
