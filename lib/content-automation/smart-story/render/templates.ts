import type { StoryType } from "../types";

/**
 * Os 7 templates de layout do SmartStoryEngine. Diferente dos templates do
 * compositor manual (um slot de texto), aqui cada layout tem vários
 * blocos (selo, título, corpo, opções, CTA, rodapé, logo, mascote) — o
 * desenho fica em layout.ts/draw.ts.
 */
export const STORY_TEMPLATE_IDS = [
  "smart-reflection",
  "smart-emotional-question",
  "smart-visual-poll",
  "smart-choice-ab",
  "smart-mini-story",
  "smart-checklist",
  "smart-cta",
] as const;
export type StoryTemplateId = (typeof STORY_TEMPLATE_IDS)[number];

export function isStoryTemplateId(value: unknown): value is StoryTemplateId {
  return typeof value === "string" && (STORY_TEMPLATE_IDS as readonly string[]).includes(value);
}

/** Qual layout desenha cada tipo de Story (tipos parecidos dividem o layout). */
export const TEMPLATE_FOR_TYPE: Record<StoryType, StoryTemplateId> = {
  REFLECTION: "smart-reflection",
  EMOTIONAL_QUESTION: "smart-emotional-question",
  COMPLETE_SENTENCE: "smart-emotional-question",
  VISUAL_POLL: "smart-visual-poll",
  CHOICE_AB: "smart-choice-ab",
  MINI_STORY: "smart-mini-story",
  CURIOSITY: "smart-mini-story",
  ADVICE: "smart-mini-story",
  CHECKLIST: "smart-checklist",
  CTA: "smart-cta",
  ALILU_BRAND: "smart-cta",
};

export function templateIdForType(type: StoryType): StoryTemplateId {
  return TEMPLATE_FOR_TYPE[type];
}

/** Selo (eyebrow) fixo de cada tipo — nenhum promete interação ("Vote", "Toque"). */
export const EYEBROW_BY_TYPE: Record<StoryType, string> = {
  REFLECTION: "REFLEXÃO DO DIA",
  EMOTIONAL_QUESTION: "PARA PENSAR",
  VISUAL_POLL: "O QUE VOCÊ ESCOLHE?",
  CHOICE_AB: "A OU B?",
  COMPLETE_SENTENCE: "COMPLETE A FRASE",
  MINI_STORY: "MINI-HISTÓRIA",
  CURIOSITY: "VOCÊ SABIA?",
  CHECKLIST: "CHECKLIST",
  ADVICE: "CONSELHO",
  CTA: "",
  ALILU_BRAND: "",
};
