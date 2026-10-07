import type { SmartStoryConfig } from "./config";
import { pickBackground } from "./render/backgrounds";
import type { RenderSmartStoryInput } from "./render/render-service";
import type { StoryContent, StoryPlan } from "./types";

export interface ComposeStoryRenderInput {
  content: StoryContent;
  plan: Pick<StoryPlan, "useMascot">;
  config: Pick<SmartStoryConfig, "showBrandHandle">;
  /** Semente do Story (produção: automação|horário; prévia: semente da prévia). */
  seed: string;
  /** Fundos usados nos últimos Stories (mais recente primeiro). */
  recentBackgroundIds?: string[];
}

/**
 * Decisão visual do Story inteligente — A MESMA para a prévia e para a
 * execução automática: fundo (da biblioteca embutida, pelo clima do
 * conteúdo), marca e mascote. NUNCA recebe imagem de fundo do usuário: o
 * modo inteligente não usa foto fixa, biblioteca nem imagem por dia.
 * O template é derivado do tipo do conteúdo dentro do renderer.
 */
export function composeStoryRenderInput(input: ComposeStoryRenderInput): RenderSmartStoryInput {
  return {
    content: input.content,
    background: pickBackground({
      mood: input.content.visualMood,
      seed: input.seed,
      recentBackgroundIds: input.recentBackgroundIds,
    }),
    showBrand: input.config.showBrandHandle,
    useMascot: input.plan.useMascot,
  };
}
