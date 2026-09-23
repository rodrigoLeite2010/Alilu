import "server-only";
import {
  AIProviderRequestError,
  buildAvoidTopicsInstruction,
  type AIContentProvider,
  type AIGenerationUsage,
  type GeneratePostContentInput,
  type GenerateReelContentInput,
  type GeneratedPostContent,
  type GeneratedReelContent,
} from "./ai-provider";

/**
 * Implementação concreta de AIContentProvider usando a Anthropic Messages
 * API (https://api.anthropic.com/v1/messages) via `fetch`, sem SDK extra
 * (o projeto já evita dependências desnecessárias — ver package.json).
 *
 * Nunca loga a API key nem o corpo bruto da resposta (pode conter dados
 * do prompt) — só o necessário para diagnóstico (status HTTP, tipo de
 * erro), igual ao padrão de publish-errors.ts/publication-log.ts.
 */

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_TOKENS = 1024;

export interface AnthropicProviderConfig {
  apiKey: string;
  model: string;
}

function systemPrompt(): string {
  return [
    "Você é o gerador de conteúdo do ALILU, uma plataforma brasileira de ferramentas online gratuitas.",
    "Escreva sempre em português do Brasil.",
    "Responda SOMENTE com um objeto JSON válido, sem markdown, sem texto antes ou depois, sem blocos de código.",
    "Nunca invente dados factuais específicos (preços, datas, estatísticas) que não estejam no contexto fornecido.",
  ].join(" ");
}

async function callAnthropic(config: AnthropicProviderConfig, userPrompt: string): Promise<{ text: string; usage: AIGenerationUsage }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: systemPrompt(),
        messages: [{ role: "user", content: userPrompt }],
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new AIProviderRequestError("Tempo esgotado ao gerar conteúdo com IA. Tente novamente.");
    }
    throw new AIProviderRequestError("Falha de rede ao chamar o provedor de IA.");
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    // Nunca inclui o corpo bruto da resposta de erro (pode ecoar o prompt) — só o status.
    throw new AIProviderRequestError(`O provedor de IA respondeu com erro (HTTP ${response.status}).`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new AIProviderRequestError("Resposta do provedor de IA não é um JSON válido.");
  }

  const data = payload as {
    content?: Array<{ type: string; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
    model?: string;
  };
  const textBlock = data.content?.find((block) => block.type === "text");
  if (!textBlock?.text) {
    throw new AIProviderRequestError("O provedor de IA não retornou texto.");
  }

  return {
    text: textBlock.text,
    usage: {
      provider: "anthropic",
      model: data.model ?? config.model,
      tokensInput: data.usage?.input_tokens ?? null,
      tokensOutput: data.usage?.output_tokens ?? null,
    },
  };
}

/** Extrai o primeiro objeto JSON de um texto — tolera algum texto ao redor mesmo pedindo "só JSON". */
function extractJsonObject(text: string): Record<string, unknown> {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new AIProviderRequestError("Não foi possível interpretar o conteúdo gerado pela IA.");
  }
  try {
    return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    throw new AIProviderRequestError("O conteúdo gerado pela IA não é um JSON válido.");
  }
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
}

export class AnthropicContentProvider implements AIContentProvider {
  readonly providerId = "anthropic";
  readonly model: string;
  private readonly config: AnthropicProviderConfig;

  constructor(config: AnthropicProviderConfig) {
    this.config = config;
    this.model = config.model;
  }

  async generatePost(
    input: GeneratePostContentInput,
  ): Promise<{ content: GeneratedPostContent; usage: AIGenerationUsage }> {
    const prompt = [
      `Contexto da marca: ${input.brandContext || "(sem contexto adicional)"}`,
      `O que publicar hoje: ${input.dayPrompt}`,
      buildAvoidTopicsInstruction(input.avoidTopics),
      "",
      "Gere o conteúdo de UM post para Instagram (imagem única) com este formato JSON exato:",
      '{"title": string (até 70 caracteres), "caption": string (legenda completa, com quebras de linha, pronta para publicar, incluindo uma chamada para ação natural no texto), "hashtags": string[] (5 a 10 hashtags relevantes, cada uma começando com #), "cta": string (chamada para ação curta, até 60 caracteres), "visualDescription": string (descrição breve da imagem ideal para este post, até 200 caracteres)}',
    ]
      .filter(Boolean)
      .join("\n");

    const { text, usage } = await callAnthropic(this.config, prompt);
    const json = extractJsonObject(text);

    const content: GeneratedPostContent = {
      title: asString(json.title),
      caption: asString(json.caption),
      hashtags: asStringArray(json.hashtags),
      cta: asString(json.cta),
      visualDescription: asString(json.visualDescription),
    };
    if (!content.caption) {
      throw new AIProviderRequestError("A IA não gerou uma legenda válida.");
    }
    return { content, usage };
  }

  async generateReel(
    input: GenerateReelContentInput,
  ): Promise<{ content: GeneratedReelContent; usage: AIGenerationUsage }> {
    const prompt = [
      `Contexto da marca: ${input.brandContext || "(sem contexto adicional)"}`,
      `O que publicar hoje: ${input.dayPrompt}`,
      buildAvoidTopicsInstruction(input.avoidTopics),
      "",
      "Gere o conteúdo de UM Reel para Instagram com este formato JSON exato (o vídeo em si já existe — reutilizado da biblioteca de mídia do usuário; gere só o texto):",
      '{"title": string (até 70 caracteres), "hook": string (primeira frase, para prender atenção nos 3 primeiros segundos), "script": string (roteiro curto de narração/legendas na tela, até 400 caracteres), "caption": string (legenda completa para publicar), "hashtags": string[] (5 a 10 hashtags relevantes), "coverText": string (texto curto para a capa do Reel, até 40 caracteres)}',
    ]
      .filter(Boolean)
      .join("\n");

    const { text, usage } = await callAnthropic(this.config, prompt);
    const json = extractJsonObject(text);

    const content: GeneratedReelContent = {
      title: asString(json.title),
      hook: asString(json.hook),
      script: asString(json.script),
      caption: asString(json.caption),
      hashtags: asStringArray(json.hashtags),
      coverText: asString(json.coverText),
    };
    if (!content.caption) {
      throw new AIProviderRequestError("A IA não gerou uma legenda válida.");
    }
    return { content, usage };
  }
}
