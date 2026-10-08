/**
 * Diretiva estruturada enviada à IA em TODAS as etapas (pesquisa, ganchos,
 * roteiro e legenda): prompt base COMPLETO + categoria + tema + estrutura +
 * convite + histórico recente + regras. Puro. É o que impede o prompt de
 * estilo de virar "o tema" e o texto de derivar para criação de conteúdo.
 */
import { getCarouselCategory, type CarouselCategoryId } from "./categories";
import type { CarouselPlan } from "./planner";

export const BASE_PROMPT_MAX = 2500;

export interface PhotoGuidance {
  min: number;
  max: number;
  /** Alvo dentro da faixa (pela densidade da categoria). */
  target: number;
}

export function buildGenerationDirective(input: { basePrompt: string | null; plan: CarouselPlan; recentTopics: readonly string[]; recentCategories: readonly string[]; photos: PhotoGuidance | null }): string {
  const category = getCarouselCategory(input.plan.categoryId);
  const isContentCategory = input.plan.categoryId === ("CRIACAO_CONTEUDO" satisfies CarouselCategoryId);
  const base = input.basePrompt?.replace(/\r/g, "").trim().slice(0, BASE_PROMPT_MAX) || null;
  const lines: string[] = [];
  lines.push("PROMPT BASE (orientação de estilo, tom e qualidade; NÃO é o tema):");
  lines.push(base ?? "(sem prompt base: use o estilo editorial da Alilu — títulos fortes, frases curtas e memoráveis, suspense gradual, reflexão no final)");
  lines.push(`CATEGORIA ESCOLHIDA: ${input.plan.categoryLabel}${category ? ` — tom: ${category.tone}` : ""}`);
  lines.push(`TEMA DESTE CARROSSEL: ${input.plan.topic}`);
  lines.push(`ESTRUTURA NARRATIVA: ${input.plan.structureLabel}`);
  lines.push(`ÚLTIMO SLIDE: termine com uma reflexão impactante e, no campo cta, um convite elegante para acompanhar a Alilu, no espírito de: "${input.plan.inviteText}" (reescreva com suas palavras, sem pedir seguidores de forma desesperada).`);
  if (input.recentTopics.length) lines.push(`ÚLTIMOS TEMAS (não repetir nem parafrasear): ${input.recentTopics.slice(0, 15).join(" | ")}`);
  if (input.recentCategories.length) lines.push(`ÚLTIMAS CATEGORIAS: ${input.recentCategories.slice(0, 5).join(", ")}`);
  const rules = [
    "Escreva sobre o TEMA acima, para uma pessoa comum — não para criadores de conteúdo.",
    "Não reutilizar temas, ganchos ou títulos recentes.",
    "Manter o estilo visual e narrativo atual da Alilu: títulos fortes e intrigantes, frases curtas e memoráveis, revelação gradual com suspense e identificação.",
    "Nada de tom de iniciante, exageros, falsas promessas ou pedidos de seguidores.",
  ];
  if (!isContentCategory) {
    rules.unshift("NÃO falar sobre criação de conteúdo, criadores, Instagram, redes sociais, algoritmo, engajamento, seguidores, roteiros ou produtividade de criador neste carrossel (o convite final para seguir a Alilu é a única referência permitida).");
  }
  lines.push(`REGRAS:\n${rules.map((rule) => `- ${rule}`).join("\n")}`);
  if (input.photos && input.photos.max > 0) {
    const scenes = category ? category.scenes.slice(0, 4).join("; ") : "";
    lines.push(
      `IMAGENS: marque como PHOTO de ${input.photos.min} a ${input.photos.max} slides (nunca o último); os demais são tipografia (GRAPHIC). Em cada PHOTO, imageQuery é uma cena concreta, em inglês, de 3 a 5 palavras, ligada ao que aquele slide diz (não ao título) e diferente das outras.${scenes ? ` Cenas coerentes com a categoria: ${scenes}.` : ""}`,
    );
  }
  return lines.join("\n");
}
