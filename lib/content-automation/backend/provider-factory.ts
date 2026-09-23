import "server-only";
import { AIProviderConfigError, type AIContentProvider } from "./ai-provider";
import { AnthropicContentProvider } from "./anthropic-content-provider";

/**
 * Ponto único de escolha do provedor de IA (seção 14 do briefing).
 * CONTENT_AI_PROVIDER escolhe a implementação ("anthropic" é a única
 * disponível nesta etapa — ver docs/content-automation.md); trocar de
 * provedor no futuro é implementar AIContentProvider de novo e adicionar
 * um `case` aqui, sem tocar em nenhum outro arquivo deste módulo.
 *
 * As credenciais NUNCA saem do servidor — nada aqui é importado por
 * nenhum componente cliente (a automação inteira é `server-only`).
 */
export function getContentAIProvider(): AIContentProvider {
  const providerId = (process.env.CONTENT_AI_PROVIDER || "anthropic").trim().toLowerCase();
  const apiKey = process.env.CONTENT_AI_API_KEY;
  const model = process.env.CONTENT_AI_MODEL;

  if (!apiKey) {
    throw new AIProviderConfigError(
      "CONTENT_AI_API_KEY não está configurada. O Piloto Automático de Conteúdo depende de um provedor de IA " +
        "para gerar posts e Reels — configure essa variável (e CONTENT_AI_MODEL) antes de ativar qualquer automação.",
    );
  }
  if (!model) {
    throw new AIProviderConfigError(
      "CONTENT_AI_MODEL não está configurada. Defina o identificador do modelo do provedor escolhido " +
        "(CONTENT_AI_PROVIDER) antes de ativar qualquer automação.",
    );
  }

  switch (providerId) {
    case "anthropic":
      return new AnthropicContentProvider({ apiKey, model });
    default:
      throw new AIProviderConfigError(
        `CONTENT_AI_PROVIDER="${providerId}" não é suportado nesta etapa. Provedores disponíveis: "anthropic".`,
      );
  }
}
