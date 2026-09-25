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
  /**
   * Rótulo em português do dia da semana CONFIGURADO para esta execução
   * (ex.: "Quinta-feira") — NUNCA o dia atual do servidor. Corrige o bug
   * relatado de a IA "falar" um dia diferente do dia configurado (ex.:
   * gerar "segunda-feira" para uma automação de quinta): o prompt sempre
   * precisa dizer explicitamente qual dia é, já que o modelo não tem
   * acesso à data real. Ver content-generation-service.ts (única fonte:
   * AutomationDayRecord.dayOfWeek) e anthropic-content-provider.ts (onde
   * isso entra no texto enviado à IA).
   *
   * Opcional só para a chamada avulsa do compositor manual do Agendador
   * (/api/instagram/ai-caption — sem automação nem dia configurado por
   * trás); toda chamada do Piloto Automático (content-generation-service.ts)
   * sempre informa este campo.
   */
  dayOfWeekLabel?: string;
  /** Assuntos/legendas recentes a evitar repetir (seção 21). */
  avoidTopics: string[];
  /**
   * Quando true, pede também um texto curto para desenhar sobre a imagem
   * (modo de imagem AUTO_TEMPLATE — ver template-render-service.ts),
   * numa única chamada em vez de duas. `false`/ausente preserva o
   * comportamento histórico (só legenda).
   */
  includeVisualText?: boolean;
}

export interface GeneratedPostContent {
  title: string;
  caption: string;
  hashtags: string[];
  cta: string;
  /** Descrição do visual sugerido — informativo hoje (a arte final usa a imagem fixa/biblioteca configurada, ver docs/content-automation.md). */
  visualDescription: string;
  /**
   * Frase curta para desenhar sobre a imagem (modo AUTO_TEMPLATE), gerada
   * só quando `includeVisualText` foi pedido — `undefined` caso
   * contrário, nunca usado como legenda.
   */
  visualText?: string;
}

export interface GenerateReelContentInput {
  brandContext: string;
  dayPrompt: string;
  /** Ver GeneratePostContentInput.dayOfWeekLabel — mesma regra, mesma razão, mesma opcionalidade. */
  dayOfWeekLabel?: string;
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
