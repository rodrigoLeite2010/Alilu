import type { StoryBrand } from "./brand";
import { buildFallbackContent } from "./fallback";
import { buildStoryPrompt } from "./prompts";
import { validateStoryContent, StoryValidationError } from "./schema";
import type { StoryContent, StoryHistoryItem, StoryPlan } from "./types";

export const DEFAULT_MAX_ATTEMPTS = 2;

/** Resultado de UMA chamada à IA (o que o provedor devolve). */
export interface StoryAiResult {
  content: Record<string, unknown>;
  usage?: unknown;
}

/** A IA é injetada: o motor não conhece provedor, chave nem rede. */
export type StoryAiCaller = (prompt: string) => Promise<StoryAiResult>;

export interface GenerateStoryInput {
  plan: StoryPlan;
  seed: string;
  basePrompt: string;
  brandContext: string;
  dayOfWeekLabel?: string;
  /** Mais recente primeiro. Já cortado em contextWindow para o prompt; a antirrepetição usa tudo que vier. */
  history: StoryHistoryItem[];
  contextWindow: number;
  callAi: StoryAiCaller;
  /** Identidade visual/textual do usuário (padrão: nenhuma — sem Alilu para quem não é o Alilu). */
  brand?: StoryBrand;
  /** Tentativas na IA (padrão 2: a primeira + 1 retry controlado). */
  maxAttempts?: number;
}

export interface GenerateStoryResult {
  content: StoryContent;
  source: "AI" | "FALLBACK";
  attempts: number;
  /** Último prompt enviado à IA (sem segredos) — vai para prompt_used. */
  promptUsed: string;
  /** Erros de cada tentativa (para diagnóstico); vazio se a 1ª deu certo. */
  errors: string[];
  /** Uso de cada chamada à IA bem-sucedida (para generation_usage). */
  usages: unknown[];
}

function describeError(error: unknown): string {
  if (error instanceof StoryValidationError) return error.message;
  // Mensagens dos provedores já são sanitizadas (sem chave nem corpo bruto); limita o tamanho por garantia.
  return (error instanceof Error ? error.message : "erro desconhecido").slice(0, 300);
}

/**
 * Gera o conteúdo estruturado de um Story: prompt por tipo → IA → valida
 * → (se inválido) retry controlado dizendo à IA o que corrigir → (se
 * ainda falhar ou a IA cair) FALLBACK curado. NUNCA lança por causa da IA:
 * a automação não pode abortar — no pior caso o Story sai com texto
 * local, e `source`/`errors` registram o que houve.
 */
export async function generateStoryContent(input: GenerateStoryInput): Promise<GenerateStoryResult> {
  const maxAttempts = Math.max(1, input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
  const promptHistory = input.history.slice(0, Math.max(0, input.contextWindow));
  const errors: string[] = [];
  const usages: unknown[] = [];
  let promptUsed = "";
  let problems: string[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    promptUsed = buildStoryPrompt({
      plan: input.plan,
      basePrompt: input.basePrompt,
      brandContext: input.brandContext,
      dayOfWeekLabel: input.dayOfWeekLabel,
      history: promptHistory,
      previousProblems: problems,
      brand: input.brand,
    });
    try {
      const result = await input.callAi(promptUsed);
      if (result.usage !== undefined) usages.push(result.usage);
      const content = validateStoryContent({
        raw: result.content,
        type: input.plan.type,
        history: input.history,
        seed: input.seed,
        brand: input.brand,
      });
      return { content, source: "AI", attempts: attempt, promptUsed, errors, usages };
    } catch (error) {
      errors.push(`tentativa ${attempt}: ${describeError(error)}`);
      problems = error instanceof StoryValidationError ? error.reasons : [];
    }
  }

  return {
    content: buildFallbackContent(input.plan.type, input.seed, input.history, input.brand),
    source: "FALLBACK",
    attempts: maxAttempts,
    promptUsed,
    errors,
    usages,
  };
}
