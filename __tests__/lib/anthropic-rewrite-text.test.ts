// @vitest-environment node
// Provedor de IA (Anthropic) — método rewriteText da Legibilidade: request,
// JSON interpretado, erro HTTP e resposta sem JSON (fetch simulado).
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { AnthropicContentProvider } = await import("@/lib/content-automation/backend/anthropic-content-provider");
const { AIProviderRequestError } = await import("@/lib/content-automation/backend/ai-provider");

const original = global.fetch;
afterEach(() => {
  global.fetch = original;
});

function respond(status: number, body: unknown) {
  const fetchMock = vi.fn(async () => ({ ok: status < 400, status, json: async () => body }) as Response);
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

const provider = new AnthropicContentProvider({ apiKey: "chave-secreta", model: "modelo-x" });

describe("AnthropicContentProvider.rewriteText", () => {
  it("envia o prompt com o limite de saída pedido e devolve o JSON interpretado", async () => {
    const fetchMock = respond(200, { content: [{ type: "text", text: 'Aqui: {"text": "Versão simples."}' }], usage: { input_tokens: 10, output_tokens: 5 } });
    const { content, usage } = await provider.rewriteText({ prompt: "Reescreva...", maxOutputTokens: 2500 });
    expect(content).toEqual({ text: "Versão simples." });
    expect(usage).toMatchObject({ provider: "anthropic", tokensInput: 10, tokensOutput: 5 });
    const body = JSON.parse(String((fetchMock.mock.calls[0] as unknown[])[1] && ((fetchMock.mock.calls[0] as unknown[])[1] as RequestInit).body));
    expect(body).toMatchObject({ model: "modelo-x", max_tokens: 2500, messages: [{ role: "user", content: "Reescreva..." }] });
  });

  it("erro HTTP e resposta sem JSON viram AIProviderRequestError (sem vazar a chave)", async () => {
    respond(500, {});
    const httpError = await provider.rewriteText({ prompt: "x" }).catch((e: unknown) => e);
    expect(httpError).toBeInstanceOf(AIProviderRequestError);
    expect(String((httpError as Error).message)).not.toContain("chave-secreta");
    respond(200, { content: [{ type: "text", text: "sem json" }] });
    await expect(provider.rewriteText({ prompt: "x" })).rejects.toBeInstanceOf(AIProviderRequestError);
  });
});
