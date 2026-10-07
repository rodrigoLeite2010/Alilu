import "server-only";

/**
 * Chamador de IA do Carrossel Inteligente (Anthropic Messages API via fetch),
 * com a ferramenta de busca na web da própria Anthropic. Fica atrás da
 * interface CarouselLlm para os testes usarem uma IA falsa e para trocar de
 * provedor sem tocar no serviço editorial.
 *
 * Nunca loga chave nem corpo bruto (pode ecoar o prompt).
 */

export interface LlmRequest {
  system: string;
  prompt: string;
  maxOutputTokens: number;
  /** >0 liga a busca na web, limitada a este número de buscas (teto de custo). */
  webSearchMax?: number;
}

export interface LlmCitation {
  title: string;
  url: string;
  pageAge: string | null;
}

export interface LlmResponse {
  text: string;
  model: string;
  tokensInput: number | null;
  tokensOutput: number | null;
  webSearches: number;
  /** Páginas realmente consultadas pela busca (fonte de verdade das citações). */
  citations: LlmCitation[];
}

export interface CarouselLlm {
  readonly provider: string;
  complete(request: LlmRequest): Promise<LlmResponse>;
}

export class CarouselLlmError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CarouselLlmError";
  }
}

const API_URL = "https://api.anthropic.com/v1/messages";
const VERSION = "2023-06-01";
const TIMEOUT_MS = 55_000;
const WEB_SEARCH_TOOL = "web_search_20250305";

export class AnthropicCarouselLlm implements CarouselLlm {
  readonly provider = "anthropic";
  constructor(private readonly config: { apiKey: string; model: string }) {}

  async complete(request: LlmRequest): Promise<LlmResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const body: Record<string, unknown> = {
      model: this.config.model,
      max_tokens: request.maxOutputTokens,
      system: request.system,
      messages: [{ role: "user", content: request.prompt }],
    };
    if (request.webSearchMax && request.webSearchMax > 0) {
      body.tools = [{ type: WEB_SEARCH_TOOL, name: "web_search", max_uses: Math.min(request.webSearchMax, 8) }];
    }

    let response: Response;
    try {
      response = await fetch(API_URL, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": this.config.apiKey, "anthropic-version": VERSION },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw new CarouselLlmError("Tempo esgotado ao gerar com IA. Tente novamente.");
      throw new CarouselLlmError("Falha de rede ao chamar a IA.");
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) throw new CarouselLlmError(`A IA respondeu com erro (HTTP ${response.status}).`);

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new CarouselLlmError("Resposta da IA inválida.");
    }
    return parseAnthropicPayload(payload, this.config.model);
  }
}

interface AnthropicBlock {
  type: string;
  text?: string;
  content?: unknown;
}

export function parseAnthropicPayload(payload: unknown, fallbackModel: string): LlmResponse {
  const data = payload as {
    content?: AnthropicBlock[];
    model?: string;
    usage?: { input_tokens?: number; output_tokens?: number; server_tool_use?: { web_search_requests?: number } };
  };
  const blocks = Array.isArray(data.content) ? data.content : [];
  const text = blocks
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text as string)
    .join("\n")
    .trim();
  if (!text) throw new CarouselLlmError("A IA não retornou texto.");

  const citations: LlmCitation[] = [];
  const seen = new Set<string>();
  for (const block of blocks) {
    if (block.type !== "web_search_tool_result" || !Array.isArray(block.content)) continue;
    for (const item of block.content as Array<Record<string, unknown>>) {
      const url = typeof item.url === "string" ? item.url : "";
      if (!url || seen.has(url) || !/^https:\/\//i.test(url)) continue;
      seen.add(url);
      citations.push({ title: typeof item.title === "string" ? item.title : url, url, pageAge: typeof item.page_age === "string" ? item.page_age : null });
    }
  }
  return {
    text,
    model: data.model ?? fallbackModel,
    tokensInput: data.usage?.input_tokens ?? null,
    tokensOutput: data.usage?.output_tokens ?? null,
    webSearches: data.usage?.server_tool_use?.web_search_requests ?? 0,
    citations,
  };
}

/** Cria a IA a partir do ambiente (mesmas variáveis do Piloto Automático). */
export function createCarouselLlmFromEnv(): CarouselLlm {
  const apiKey = process.env.CONTENT_AI_API_KEY;
  const model = process.env.CONTENT_AI_MODEL;
  if (!apiKey || !model) throw new CarouselLlmError("A IA do Carrossel Inteligente não está configurada (CONTENT_AI_API_KEY / CONTENT_AI_MODEL).");
  return new AnthropicCarouselLlm({ apiKey, model });
}
