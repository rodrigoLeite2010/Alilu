import "server-only";

/**
 * Interface do provedor de IA de geração de conteúdo (seção 13 do
 * briefing) — a regra de negócio (content-generation-service.ts) nunca
 * fala diretamente com OpenAI/Anthropic/etc.; só com este contrato. Trocar
 * de provedor no futuro é só implementar esta interface de novo, sem
 * tocar em automation-run/cron/UI.
 */

export interface GeneratePostContentInput {
  /** Contexto geral da marca (seção 7), já combinado a todo prompt. */
  brandContext: string;
  /** Prompt específico do dia (seção 8). */
  dayPrompt: string;
  /** Assuntos/legendas recentes a evitar repetir (seção 21). */
  avoidTopics: string[];
}

export interface GeneratedPostContent {
  title: string;
  caption: string;
  hashtags: string[];
  cta: string;
  /** Descrição do visual sugerido — informativo hoje (a arte final usa a imagem fixa/biblioteca configurada, ver docs/content-automation.md). */
  visualDescription: string;
}

export interface GenerateReelContentInput {
  brandContext: string;
  dayPrompt: string;
  avoidTopics: string[];
}

export interface GeneratedReelContent {
  title: string;
  hook: string;
  script: string;
  caption: string;
  hashtags: string[];
  coverText: string;
}

export interface AIGenerationUsage {
  provider: string;
  model: string;
  tokensInput: number | null;
  tokensOutput: number | null;
}

export interface AIContentProvider {
  readonly providerId: string;
  readonly model: string;
  generatePost(input: GeneratePostContentInput): Promise<{ content: GeneratedPostContent; usage: AIGenerationUsage }>;
  generateReel(input: GenerateReelContentInput): Promise<{ content: GeneratedReelContent; usage: AIGenerationUsage }>;
}

/** Configuração ausente/inválida (CONTENT_AI_API_KEY, CONTENT_AI_MODEL) — nunca vaza a chave na mensagem. */
export class AIProviderConfigError extends Error {}

/** A chamada ao provedor falhou (rede, formato de resposta inesperado, etc.) — mensagem sempre sanitizada. */
export class AIProviderRequestError extends Error {}

export function buildAvoidTopicsInstruction(avoidTopics: string[]): string {
  if (avoidTopics.length === 0) return "";
  const list = avoidTopics
    .slice(0, 7)
    .map((topic) => `- ${topic.replace(/\s+/g, " ").trim().slice(0, 200)}`)
    .join("\n");
  return `\n\nEvite repetir o tema, o título ou a legenda destas publicações recentes:\n${list}`;
}
