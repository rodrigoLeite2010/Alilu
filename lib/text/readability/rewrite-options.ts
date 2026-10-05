/**
 * Opções da reescrita com IA (Legibilidade, fase 2) — compartilhadas entre
 * tela e servidor. Público e objetivo NUNCA mudam os cálculos de
 * legibilidade: só entram no prompt da reescrita.
 */

export type RewriteAudience = "general" | "child10" | "teen" | "adult" | "professional" | "technical";
export type RewriteGoal = "simplify" | "direct" | "persuasive" | "emotional" | "instagram" | "reels" | "caption" | "hook";

export const REWRITE_AUDIENCES: Array<{ id: RewriteAudience; label: string }> = [
  { id: "general", label: "Geral" },
  { id: "child10", label: "Criança de 10 anos" },
  { id: "teen", label: "Adolescente" },
  { id: "adult", label: "Adulto" },
  { id: "professional", label: "Profissional" },
  { id: "technical", label: "Técnico" },
];

export const REWRITE_GOALS: Array<{ id: RewriteGoal; label: string; button: string }> = [
  { id: "simplify", label: "Fácil entendimento", button: "Simplificar" },
  { id: "direct", label: "Mais direto", button: "Mais direto" },
  { id: "emotional", label: "Mais emocional", button: "Mais emocional" },
  { id: "persuasive", label: "Mais persuasivo", button: "Mais persuasivo" },
  { id: "hook", label: "Gancho de 3 segundos", button: "Criar gancho" },
  { id: "instagram", label: "Instagram", button: "Adaptar para Instagram" },
  { id: "reels", label: "Reels", button: "Adaptar para Reels" },
  { id: "caption", label: "Legenda", button: "Adaptar para legenda" },
];

/** A reescrita aceita menos texto que a análise (custo e tempo de resposta da IA). */
export const REWRITE_MAX_CHARACTERS = 5_000;
export const REWRITE_DAILY_LIMIT = 30;

export function isRewriteAudience(value: unknown): value is RewriteAudience {
  return REWRITE_AUDIENCES.some((item) => item.id === value);
}

export function isRewriteGoal(value: unknown): value is RewriteGoal {
  return REWRITE_GOALS.some((item) => item.id === value);
}
