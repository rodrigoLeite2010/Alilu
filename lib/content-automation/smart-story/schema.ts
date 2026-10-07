import type { StoryBrand } from "./brand";
import { INTERACTIVE_CLAIM_RE, pickCta } from "./cta";
import { cleanStoryText, normalizeForCompare, sameText, truncateSafely } from "./text";
import {
  STORY_LIMITS,
  isVisualMood,
  type StoryContent,
  type StoryHistoryItem,
  type StoryType,
  type VisualMood,
} from "./types";

export class StoryValidationError extends Error {
  constructor(public readonly reasons: string[]) {
    super(`Conteúdo de Story inválido: ${reasons.join("; ")}`);
  }
}

/** Campos OBRIGATÓRIOS por tipo (headline é sempre obrigatório). */
export const REQUIRED_FIELDS: Record<StoryType, Array<"body" | "optionA" | "optionB" | "cta">> = {
  REFLECTION: [],
  EMOTIONAL_QUESTION: [],
  VISUAL_POLL: ["optionA", "optionB"],
  CHOICE_AB: ["optionA", "optionB"],
  COMPLETE_SENTENCE: [],
  MINI_STORY: ["body"],
  CURIOSITY: ["body"],
  CHECKLIST: ["body"],
  ADVICE: ["body"],
  CTA: ["cta"],
  ALILU_BRAND: ["cta"],
};

/** Clima visual padrão por tipo (quando a IA não informa/erra). */
export const DEFAULT_MOOD: Record<StoryType, VisualMood> = {
  REFLECTION: "emotional",
  EMOTIONAL_QUESTION: "emotional",
  VISUAL_POLL: "light",
  CHOICE_AB: "light",
  COMPLETE_SENTENCE: "neutral",
  MINI_STORY: "emotional",
  CURIOSITY: "technology",
  CHECKLIST: "motivational",
  ADVICE: "motivational",
  CTA: "dark",
  ALILU_BRAND: "technology",
};

/** Tira o "A)", "1.", "-" do começo de uma opção/linha. */
function stripListMarker(text: string): string {
  return text.replace(/^(?:[A-Da-d][).:]|\d+[).:]|[-•–]\s)\s*/, "").trim();
}

/** Checklist: até 5 linhas curtas, uma por item. */
function normalizeChecklist(body: string): string {
  const lines = body
    .split("\n")
    .map(stripListMarker)
    .filter(Boolean)
    .slice(0, 5)
    .map((line) => truncateSafely(line, 40));
  return truncateSafely(lines.join("\n"), STORY_LIMITS.body);
}

export interface ValidateStoryInput {
  raw: unknown;
  /** Tipo que o motor decidiu — é ele que vale, mesmo se a IA devolver outro. */
  type: StoryType;
  /** Stories anteriores (mais recente primeiro) para rejeitar título repetido e variar o CTA. */
  history: StoryHistoryItem[];
  /** Semente (para o CTA substituto determinístico). */
  seed: string;
  /** Identidade da marca do usuário (padrão: nenhuma) — decide os CTAs de visita/seguir. */
  brand?: StoryBrand;
}

/**
 * Valida e NORMALIZA o JSON da IA: limpa texto, aplica limites com corte
 * seguro, exige os campos do tipo, rejeita título repetido e promessa de
 * interatividade que a API da Meta não entrega. Lança StoryValidationError
 * (com os motivos) — quem chama decide tentar de novo ou cair no fallback.
 */
export function validateStoryContent(input: ValidateStoryInput): StoryContent {
  const { type, history, seed } = input;
  const raw = typeof input.raw === "object" && input.raw !== null ? (input.raw as Record<string, unknown>) : null;
  if (!raw) throw new StoryValidationError(["a resposta da IA não é um objeto JSON"]);

  const reasons: string[] = [];
  const headline = truncateSafely(cleanStoryText(raw.headline), STORY_LIMITS.headline);
  let body = cleanStoryText(raw.body);
  const optionA = truncateSafely(stripListMarker(cleanStoryText(raw.optionA)), STORY_LIMITS.option);
  const optionB = truncateSafely(stripListMarker(cleanStoryText(raw.optionB)), STORY_LIMITS.option);
  let cta = truncateSafely(cleanStoryText(raw.cta), STORY_LIMITS.cta);
  const topic = truncateSafely(cleanStoryText(raw.topic) || headline, STORY_LIMITS.topic);

  body = type === "CHECKLIST" ? normalizeChecklist(body) : truncateSafely(body, STORY_LIMITS.body);

  if (!headline) reasons.push("falta o título (headline)");
  for (const field of REQUIRED_FIELDS[type]) {
    const value = { body, optionA, optionB, cta }[field];
    if (!value) reasons.push(`falta o campo ${field} (obrigatório para ${type})`);
  }
  if ((type === "VISUAL_POLL" || type === "CHOICE_AB") && optionA && optionB && sameText(optionA, optionB)) {
    reasons.push("as opções A e B são iguais");
  }
  if (type === "CHECKLIST" && body && body.split("\n").length < 2) {
    reasons.push("o checklist precisa de pelo menos 2 itens");
  }
  if (headline && history.some((item) => sameText(item.headline, headline))) {
    reasons.push("título repetido de um Story recente");
  }
  if (INTERACTIVE_CLAIM_RE.test(headline) || INTERACTIVE_CLAIM_RE.test(body)) {
    reasons.push("o texto promete interação nativa (vote/toque/clique) que a API não publica");
  }
  if (reasons.length > 0) throw new StoryValidationError(reasons);

  // CTA: sem CTA, repetido, ou prometendo sticker → troca por um variado do banco.
  const recentCtas = history.slice(0, 5).map((item) => item.cta);
  const ctaRepeated = cta !== "" && recentCtas.some((recent) => normalizeForCompare(recent) === normalizeForCompare(cta));
  if (!cta || ctaRepeated || INTERACTIVE_CLAIM_RE.test(cta)) {
    cta = pickCta(type, seed, recentCtas, input.brand);
  }

  const mood = typeof raw.visualMood === "string" ? raw.visualMood.trim().toLowerCase() : "";
  return {
    type,
    headline,
    body,
    optionA,
    optionB,
    cta,
    visualMood: isVisualMood(mood) ? mood : DEFAULT_MOOD[type],
    topic,
  };
}
