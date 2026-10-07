/**
 * SmartStoryEngine — tipos do domínio (puro: sem banco, sem rede, sem
 * server-only; importável por testes e, no futuro, pela UI).
 *
 * O motor NÃO é um módulo paralelo de Stories: ele só decide e valida o
 * CONTEÚDO de um Story. Agendar, renderizar, subir e publicar continuam
 * sendo o cron/automation_runs/instagram_posts que já existem.
 */

export const STORY_TYPES = [
  "REFLECTION",
  "EMOTIONAL_QUESTION",
  "VISUAL_POLL",
  "CHOICE_AB",
  "COMPLETE_SENTENCE",
  "MINI_STORY",
  "CURIOSITY",
  "CHECKLIST",
  "ADVICE",
  "CTA",
  "ALILU_BRAND",
] as const;
export type StoryType = (typeof STORY_TYPES)[number];

export const STORY_TYPE_LABEL: Record<StoryType, string> = {
  REFLECTION: "Reflexão",
  EMOTIONAL_QUESTION: "Pergunta emocional",
  VISUAL_POLL: "Enquete visual",
  CHOICE_AB: "Escolha A ou B",
  COMPLETE_SENTENCE: "Complete a frase",
  MINI_STORY: "Mini-história",
  CURIOSITY: "Curiosidade",
  CHECKLIST: "Checklist",
  ADVICE: "Conselho",
  CTA: "Chamada para ação",
  ALILU_BRAND: "Marca Alilu",
};

export function isStoryType(value: unknown): value is StoryType {
  return typeof value === "string" && (STORY_TYPES as readonly string[]).includes(value);
}

export const STORY_THEMES = [
  "motivacao",
  "familia",
  "amizade",
  "perdao",
  "superacao",
  "trabalho",
  "dinheiro",
  "autoestima",
  "fe",
  "disciplina",
  "empatia",
  "vida",
] as const;
export type StoryTheme = (typeof STORY_THEMES)[number];

export const STORY_THEME_LABEL: Record<StoryTheme, string> = {
  motivacao: "motivação",
  familia: "família",
  amizade: "amizade",
  perdao: "perdão",
  superacao: "superação",
  trabalho: "trabalho",
  dinheiro: "dinheiro",
  autoestima: "autoestima",
  fe: "fé",
  disciplina: "disciplina",
  empatia: "empatia",
  vida: "vida",
};

export function isStoryTheme(value: unknown): value is StoryTheme {
  return typeof value === "string" && (STORY_THEMES as readonly string[]).includes(value);
}

/** Clima visual — escolhe a categoria de fundo na Fase 3 (StoryBackground.Mood/Category). */
export const VISUAL_MOODS = ["emotional", "motivational", "finance", "technology", "neutral", "dark", "light"] as const;
export type VisualMood = (typeof VISUAL_MOODS)[number];

export function isVisualMood(value: unknown): value is VisualMood {
  return typeof value === "string" && (VISUAL_MOODS as readonly string[]).includes(value);
}

/** Limites de texto do Story (1080×1920 — texto grande precisa de pouco texto). */
export const STORY_LIMITS = {
  headline: 80,
  body: 180,
  option: 40,
  cta: 60,
  topic: 80,
} as const;

/**
 * Layout do Story. Hoje só SINGLE (uma imagem). SEQUENCE (2–4 imagens
 * encadeadas) fica APENAS preparado na estrutura/banco — nada o gera ainda.
 */
export type StoryLayout = "SINGLE" | "SEQUENCE";
export const MIN_SEQUENCE_COUNT = 2;
export const MAX_SEQUENCE_COUNT = 4;

/**
 * O que a API da Meta permite publicar num Story. Conferido na
 * documentação oficial (Content Publishing / POST /{ig-id}/media):
 * "Publishing stickers (i.e., link, poll, location) is not supported".
 * Por isso TUDO é false — e a enquete é sempre VisualPoll (desenhada,
 * sem fingir interatividade). Só mude estes valores se a Meta passar a
 * documentar suporte oficial (Fase 6).
 */
export interface StoryCapabilities {
  supportsNativePoll: boolean;
  supportsQuestionSticker: boolean;
  supportsLinkSticker: boolean;
}

export const STORY_CAPABILITIES: Readonly<StoryCapabilities> = Object.freeze({
  supportsNativePoll: false,
  supportsQuestionSticker: false,
  supportsLinkSticker: false,
});

/** Conteúdo estruturado de UM Story (já validado/normalizado). */
export interface StoryContent {
  type: StoryType;
  headline: string;
  body: string;
  optionA: string;
  optionB: string;
  cta: string;
  visualMood: VisualMood;
  /** Assunto curto, só para antirrepetição (não é desenhado). */
  topic: string;
}

export const STORY_STATUSES = ["GENERATED", "RENDERING", "READY", "PUBLISHING", "PUBLISHED", "FAILED"] as const;
export type StoryStatus = (typeof STORY_STATUSES)[number];

/** Um Story anterior, na forma que o motor precisa para evitar repetição. */
export interface StoryHistoryItem {
  storyType: StoryType;
  headline: string;
  topic: string;
  cta: string;
  usedMascot: boolean;
  generatedAt: Date;
}

/** Decisão do motor para um horário (antes de chamar a IA). */
export interface StoryPlan {
  type: StoryType;
  theme: StoryTheme;
  useMascot: boolean;
  layout: StoryLayout;
  sequenceCount: number;
  /** Faixa do dia que decidiu a estratégia (diagnóstico). */
  timeBucket: string;
}
