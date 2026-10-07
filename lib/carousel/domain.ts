/**
 * Domínio puro do Carrossel Inteligente (sem banco, sem rede): papéis dos
 * slides por quantidade, estilos de gancho, transições de status e
 * validação/normalização dos textos dos slides.
 */
import { CAROUSEL_LIMITS } from "./carousel-plans";

export const CAROUSEL_PROJECT_STATUSES = ["DRAFT", "GENERATING", "READY", "SCHEDULED", "PUBLISHED", "FAILED"] as const;
export type CarouselProjectStatus = (typeof CAROUSEL_PROJECT_STATUSES)[number];

export const CAROUSEL_SOURCE_KINDS = ["TOPIC", "SUGGESTED", "TREND", "URL", "PROFILE"] as const;
export type CarouselSourceKind = (typeof CAROUSEL_SOURCE_KINDS)[number];

export const HOOK_STYLES = ["ORIGINAL", "PROVOCATIVE", "AUTHORITY", "STORYTELLING", "CUSTOM"] as const;
export type HookStyle = (typeof HOOK_STYLES)[number];
export const HOOK_STYLE_LABEL: Record<HookStyle, string> = {
  ORIGINAL: "Original",
  PROVOCATIVE: "Provocativo",
  AUTHORITY: "Autoridade",
  STORYTELLING: "Storytelling",
  CUSTOM: "Escrito por você",
};

export const VISUAL_KINDS = ["PHOTO", "ILLUSTRATION", "GRAPHIC", "IMAGE_AI", "NONE"] as const;
export type VisualKind = (typeof VISUAL_KINDS)[number];

export const SLIDE_ROLES = [
  "HOOK",
  "CONTEXT",
  "DEEPENING",
  "INSIGHT",
  "DEVELOPMENT",
  "EXAMPLE",
  "TURN",
  "APPLICATION",
  "CONCLUSION",
  "CTA",
] as const;
export type SlideRole = (typeof SLIDE_ROLES)[number];

export const SLIDE_ROLE_LABEL: Record<SlideRole, string> = {
  HOOK: "Gancho",
  CONTEXT: "Contexto / problema",
  DEEPENING: "Aprofundamento",
  INSIGHT: "Insight",
  DEVELOPMENT: "Desenvolvimento",
  EXAMPLE: "Exemplo / dado",
  TURN: "Virada",
  APPLICATION: "Aplicação prática",
  CONCLUSION: "Conclusão",
  CTA: "Chamada para ação",
};

/**
 * Estrutura narrativa por quantidade de slides (5–10). Sempre abre com o
 * gancho e fecha com conclusão + CTA; com menos slides, cortam-se os papéis
 * intermediários menos essenciais, mantendo a progressão.
 */
const ROLES_BY_COUNT: Record<number, SlideRole[]> = {
  5: ["HOOK", "CONTEXT", "INSIGHT", "APPLICATION", "CTA"],
  6: ["HOOK", "CONTEXT", "INSIGHT", "EXAMPLE", "APPLICATION", "CTA"],
  7: ["HOOK", "CONTEXT", "DEEPENING", "INSIGHT", "EXAMPLE", "APPLICATION", "CTA"],
  8: ["HOOK", "CONTEXT", "DEEPENING", "INSIGHT", "EXAMPLE", "TURN", "APPLICATION", "CTA"],
  9: ["HOOK", "CONTEXT", "DEEPENING", "INSIGHT", "DEVELOPMENT", "EXAMPLE", "TURN", "APPLICATION", "CTA"],
  10: ["HOOK", "CONTEXT", "DEEPENING", "INSIGHT", "DEVELOPMENT", "EXAMPLE", "TURN", "APPLICATION", "CONCLUSION", "CTA"],
};

export function clampSlideCount(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return CAROUSEL_LIMITS.defaultSlides;
  return Math.min(CAROUSEL_LIMITS.maxSlides, Math.max(CAROUSEL_LIMITS.minSlides, Math.round(parsed)));
}

export function slideRolesFor(count: number): SlideRole[] {
  return [...ROLES_BY_COUNT[clampSlideCount(count)]];
}

/**
 * Quantos slides gerados cabem no post: o Instagram aceita 10 itens; se o
 * usuário usa a imagem final padrão, ela ocupa 1 vaga.
 */
export function maxGeneratedSlides(wantsEndImage: boolean, maxItems = CAROUSEL_LIMITS.maxSlides): number {
  return wantsEndImage ? maxItems - 1 : maxItems;
}

const TRANSITIONS: Record<CarouselProjectStatus, CarouselProjectStatus[]> = {
  DRAFT: ["GENERATING", "READY"],
  GENERATING: ["READY", "FAILED", "DRAFT"],
  READY: ["DRAFT", "GENERATING", "SCHEDULED", "PUBLISHED"],
  SCHEDULED: ["READY", "PUBLISHED", "FAILED"],
  PUBLISHED: [],
  FAILED: ["DRAFT", "GENERATING"],
};

export function canTransition(from: CarouselProjectStatus, to: CarouselProjectStatus): boolean {
  return from === to || TRANSITIONS[from].includes(to);
}

export function isCarouselStatus(value: unknown): value is CarouselProjectStatus {
  return typeof value === "string" && (CAROUSEL_PROJECT_STATUSES as readonly string[]).includes(value);
}

export function isVisualKind(value: unknown): value is VisualKind {
  return typeof value === "string" && (VISUAL_KINDS as readonly string[]).includes(value);
}

export function isHookStyle(value: unknown): value is HookStyle {
  return typeof value === "string" && (HOOK_STYLES as readonly string[]).includes(value);
}

/** Trunca em fronteira de palavra (com reticências) sem cortar no meio. */
export function truncateAtWord(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.\-–]+$/, "")}…`;
}

export interface SlideTextInput {
  headline?: unknown;
  body?: unknown;
  cta?: unknown;
}

export interface NormalizedSlideText {
  headline: string;
  body: string;
  cta: string;
  /** Campos que passaram do limite e foram encurtados. */
  truncated: Array<"headline" | "body" | "cta">;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Normaliza e aplica os limites de texto do slide (headline 70, body 220, CTA curto). */
export function normalizeSlideText(input: SlideTextInput): NormalizedSlideText {
  const truncated: NormalizedSlideText["truncated"] = [];
  const fit = (key: "headline" | "body" | "cta", max: number) => {
    const clean = text(input[key]).replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    if (clean.length <= max) return clean;
    truncated.push(key);
    return truncateAtWord(clean, max);
  };
  return {
    headline: fit("headline", CAROUSEL_LIMITS.headline),
    body: fit("body", CAROUSEL_LIMITS.body),
    cta: fit("cta", CAROUSEL_LIMITS.cta),
    truncated,
  };
}

/** Número de semana ISO "AAAA-Www" (chave da pauta semanal; segunda-feira inicia a semana). */
export function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
