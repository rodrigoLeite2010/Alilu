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

export function buildGenerationDirective(input: {
  basePrompt: string | null;
  plan: CarouselPlan;
  recentTopics: readonly string[];
  recentCategories: readonly string[];
  photos: PhotoGuidance | null;
  /** true = o TEMA saiu da lista de assuntos do próprio prompt (briefing da empresa do usuário). */
  topicFromPrompt?: boolean;
}): string {
  const category = getCarouselCategory(input.plan.categoryId);
  const isContentCategory = input.plan.categoryId === ("CRIACAO_CONTEUDO" satisfies CarouselCategoryId);
  const base = input.basePrompt?.replace(/\r/g, "").trim().slice(0, BASE_PROMPT_MAX) || null;
  const fromPrompt = Boolean(base && input.topicFromPrompt);
  const lines: string[] = [];
  if (base) {
    // O prompt do usuário MANDA: marca, assunto, público, restrições e chamada final.
    // Ele só não é "o tema" quando é genérico (aí o Alilu sorteia o tema abaixo).
    lines.push(
      fromPrompt
        ? "PROMPT DO USUÁRIO (OBRIGATÓRIO — siga à risca a marca/empresa, o assunto, o público, as restrições e a chamada final que ele pedir; tudo o que vier abaixo é complemento):"
        : "PROMPT DO USUÁRIO (OBRIGATÓRIO quanto à marca/empresa, público, restrições e chamada final; ele NÃO é o tema — o tema vem abaixo, adaptado ao universo da marca do prompt):",
    );
    lines.push(base);
  } else {
    lines.push("PROMPT BASE (orientação de estilo, tom e qualidade; NÃO é o tema):");
    lines.push("(sem prompt base: use o estilo editorial da Alilu — títulos fortes, frases curtas e memoráveis, suspense gradual, reflexão no final)");
  }
  if (!fromPrompt) lines.push(`CATEGORIA ESCOLHIDA: ${input.plan.categoryLabel}${category ? ` — tom: ${category.tone}` : ""}`);
  lines.push(fromPrompt ? `TEMA DESTE CARROSSEL (um dos assuntos pedidos no prompt): ${input.plan.topic}` : `TEMA DESTE CARROSSEL: ${input.plan.topic}`);
  lines.push(`ESTRUTURA NARRATIVA: ${input.plan.structureLabel}`);
  if (base) {
    lines.push(
      `ÚLTIMO SLIDE: termine com uma reflexão impactante e, no campo cta, a chamada final pedida no PROMPT DO USUÁRIO, com a marca/perfil DELE (nunca outra marca). Se ele não pedir chamada, faça um convite elegante para acompanhar o perfil, sem pedir seguidores de forma desesperada.`,
    );
  } else {
    lines.push(`ÚLTIMO SLIDE: termine com uma reflexão impactante e, no campo cta, um convite elegante para acompanhar a Alilu, no espírito de: "${input.plan.inviteText}" (reescreva com suas palavras, sem pedir seguidores de forma desesperada).`);
  }
  if (input.recentTopics.length) lines.push(`ÚLTIMOS TEMAS (não repetir nem parafrasear): ${input.recentTopics.slice(0, 15).join(" | ")}`);
  if (input.recentCategories.length && !fromPrompt) lines.push(`ÚLTIMAS CATEGORIAS: ${input.recentCategories.slice(0, 5).join(", ")}`);
  const rules = [
    base
      ? "Escreva sobre o TEMA acima, ligado à marca/empresa e ao público do PROMPT DO USUÁRIO — não para criadores de conteúdo."
      : "Escreva sobre o TEMA acima, para uma pessoa comum — não para criadores de conteúdo.",
    "Não reutilizar temas, ganchos ou títulos recentes.",
    base
      ? "Visual e narrativa: títulos fortes e intrigantes, frases curtas e memoráveis, revelação gradual com suspense e identificação — sem contrariar o que o PROMPT DO USUÁRIO pedir."
      : "Manter o estilo visual e narrativo atual da Alilu: títulos fortes e intrigantes, frases curtas e memoráveis, revelação gradual com suspense e identificação.",
    "Nada de tom de iniciante, exageros, falsas promessas ou pedidos de seguidores.",
  ];
  if (base) rules.unshift("Não mencione a Alilu (a não ser que o PROMPT DO USUÁRIO peça): o conteúdo é da marca descrita no prompt.");
  if (!isContentCategory || fromPrompt) {
    rules.unshift(
      base
        ? "NÃO falar sobre criação de conteúdo, criadores, algoritmo, engajamento, roteiros ou produtividade de criador (a chamada final para seguir o perfil pedida no prompt é permitida)."
        : "NÃO falar sobre criação de conteúdo, criadores, Instagram, redes sociais, algoritmo, engajamento, seguidores, roteiros ou produtividade de criador neste carrossel (o convite final para seguir a Alilu é a única referência permitida).",
    );
  }
  lines.push(`REGRAS:\n${rules.map((rule) => `- ${rule}`).join("\n")}`);
  if (input.photos && input.photos.max > 0) {
    // Tema do prompt: as cenas da categoria sorteada não têm a ver com o assunto — não sugere.
    const scenes = category && !fromPrompt ? category.scenes.slice(0, 4).join("; ") : "";
    lines.push(
      `IMAGENS: marque como PHOTO de ${input.photos.min} a ${input.photos.max} slides (nunca o último); os demais são tipografia (GRAPHIC). Em cada PHOTO, imageQuery é uma cena concreta, em inglês, de 3 a 5 palavras, ligada ao que aquele slide diz (não ao título) e diferente das outras.${scenes ? ` Cenas coerentes com a categoria: ${scenes}.` : ""}`,
    );
  }
  return lines.join("\n");
}
