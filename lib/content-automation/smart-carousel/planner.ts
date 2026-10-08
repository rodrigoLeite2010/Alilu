/**
 * Planejador do Carrossel Inteligente automático — ETAPA 1 (escolher categoria +
 * tema + estrutura narrativa + convite final). A etapa 2 (gerar o carrossel) só
 * recebe o plano. Funções PURAS e determinísticas: a mesma semente (automação +
 * horário) sempre dá o mesmo plano, então um retry não muda o tema.
 *
 * Anti-repetição (todas configuráveis, com relaxamento progressivo para nunca travar):
 *  - categoria: não repete nas últimas `avoidCategoryWindow` (padrão 3);
 *  - tema: não repete (nem parecido) nos últimos `avoidTopicWindow` (padrão 15);
 *  - estrutura narrativa e convite final: não repetem em sequência (últimos 2).
 */
import { createRng, weightedPick } from "../smart-story/random";
import {
  CAROUSEL_CATEGORIES,
  CLOSING_INVITES,
  NARRATIVE_STRUCTURES,
  getCarouselCategory,
  type CarouselCategoryDef,
  type CarouselCategoryId,
  type ClosingInviteId,
  type NarrativeStructureId,
} from "./categories";
import type { SmartCarouselConfig } from "./config";
import { findRepeat } from "./selection";

/** Histórico recente, do mais novo ao mais antigo. */
export interface PlannerHistory {
  categories: Array<string | null>;
  topics: string[];
  structures: Array<string | null>;
  invites: Array<string | null>;
}

export const EMPTY_PLANNER_HISTORY: PlannerHistory = { categories: [], topics: [], structures: [], invites: [] };

export interface CarouselPlan {
  categoryId: CarouselCategoryId;
  categoryLabel: string;
  topic: string;
  structureId: NarrativeStructureId;
  structureLabel: string;
  inviteId: ClosingInviteId;
  inviteText: string;
  /** Regras de anti-repetição que precisaram ser afrouxadas (vazio = todas respeitadas). */
  relaxed: string[];
  /** Quantas categorias estavam elegíveis na escolha. */
  eligibleCategories: number;
}

const STRUCTURE_WINDOW = 2;
const INVITE_WINDOW = 2;

function freeThemes(category: CarouselCategoryDef, recentTopics: readonly string[]): string[] {
  return category.themes.filter((theme) => !findRepeat(theme, recentTopics));
}

export function planCarousel(input: { config: Pick<SmartCarouselConfig, "enabledCategories" | "categoryWeights" | "avoidCategoryWindow" | "avoidTopicWindow">; history?: PlannerHistory; seed: string }): CarouselPlan {
  const history = input.history ?? EMPTY_PLANNER_HISTORY;
  const rng = createRng(`carousel-plan|${input.seed}`);
  const relaxed: string[] = [];
  const weightOf = (category: CarouselCategoryDef) => input.config.categoryWeights[category.id] ?? category.weight;
  const candidates = CAROUSEL_CATEGORIES.filter((category) => input.config.enabledCategories.includes(category.id) && weightOf(category) > 0);
  if (candidates.length === 0) throw new Error("Ligue ao menos uma categoria com peso maior que zero.");

  const recentTopics = history.topics.slice(0, input.config.avoidTopicWindow);
  const recentCategories = history.categories.filter((id): id is string => Boolean(id));

  // Categoria: tenta a janela cheia e vai afrouxando (3 → 2 → 1 → 0). Só entra quem ainda tem tema livre.
  let pool: CarouselCategoryDef[] = [];
  for (let window = input.config.avoidCategoryWindow; window >= 0; window -= 1) {
    const blocked = new Set(recentCategories.slice(0, window));
    pool = candidates.filter((category) => !blocked.has(category.id) && freeThemes(category, recentTopics).length > 0);
    if (pool.length > 0) {
      if (window < input.config.avoidCategoryWindow) relaxed.push(`janela de categorias reduzida para ${window}`);
      break;
    }
  }

  let category: CarouselCategoryDef;
  let topic: string;
  if (pool.length > 0) {
    category = weightedPick(pool, weightOf, rng);
    const themes = freeThemes(category, recentTopics);
    topic = themes[Math.floor(rng() * themes.length)];
  } else {
    // Todos os temas de todas as categorias ligadas estão dentro da janela: reaproveita o mais antigo.
    relaxed.push("banco de temas esgotado na janela: reaproveitado o tema menos recente");
    const lastCategory = recentCategories[0];
    const preferred = candidates.filter((candidate) => candidate.id !== lastCategory);
    category = weightedPick(preferred.length > 0 ? preferred : candidates, weightOf, rng);
    const age = (theme: string) => {
      const index = history.topics.findIndex((previous) => findRepeat(theme, [previous]));
      return index === -1 ? Number.POSITIVE_INFINITY : index;
    };
    topic = [...category.themes].sort((a, b) => age(b) - age(a))[0];
  }

  const structures = NARRATIVE_STRUCTURES.filter((item) => !history.structures.slice(0, STRUCTURE_WINDOW).includes(item.id));
  const structure = structures[Math.floor(rng() * structures.length)] ?? NARRATIVE_STRUCTURES[0];
  const invites = CLOSING_INVITES.filter((item) => !history.invites.slice(0, INVITE_WINDOW).includes(item.id));
  const invite = invites[Math.floor(rng() * invites.length)] ?? CLOSING_INVITES[0];

  return {
    categoryId: category.id,
    categoryLabel: category.label,
    topic,
    structureId: structure.id,
    structureLabel: structure.label,
    inviteId: invite.id,
    inviteText: invite.text,
    relaxed,
    eligibleCategories: pool.length > 0 ? pool.length : candidates.length,
  };
}

export function categoryOf(plan: Pick<CarouselPlan, "categoryId">): CarouselCategoryDef {
  const found = getCarouselCategory(plan.categoryId);
  if (!found) throw new Error("Categoria desconhecida.");
  return found;
}
