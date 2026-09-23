import type { PostExtraFields } from "@/lib/instagram/backend/instagram-post-repository";

/**
 * Leitura/validação dos campos opcionais de uma publicação vindos do
 * navegador (origem, template, fuso). Lógica pura, compartilhada pelas
 * rotas de criação e edição.
 */

/** Limite do estado do template salvo no banco — é JSON de configuração, nunca imagem. */
export const MAX_TEMPLATE_DATA_BYTES = 64 * 1024;

export function validateTemplateData(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) return "templateData precisa ser um objeto.";
  const serialized = JSON.stringify(value);
  if (serialized.length > MAX_TEMPLATE_DATA_BYTES) {
    return "Os dados do template são grandes demais.";
  }
  // Imagens nunca vão em Base64 para o banco — só URLs públicas do storage.
  if (serialized.includes("data:") || serialized.includes("blob:")) {
    return "templateData não pode conter imagens embutidas (data:/blob:). Envie a imagem ao storage.";
  }
  return null;
}

export function readPostExtraFields(
  body: Record<string, unknown>,
): { fields: PostExtraFields } | { error: string } {
  const { source, templateId, templateData, timezone } = body;
  if (source !== undefined && source !== "MANUAL" && source !== "VIRAL_POST") {
    return { error: "source precisa ser MANUAL ou VIRAL_POST." };
  }
  if (templateId !== undefined && templateId !== null && (typeof templateId !== "string" || templateId.length > 64)) {
    return { error: "templateId inválido." };
  }
  if (timezone !== undefined && timezone !== null && typeof timezone !== "string") {
    return { error: "timezone inválido." };
  }
  const templateError = validateTemplateData(templateData);
  if (templateError) return { error: templateError };

  const fields: PostExtraFields = {};
  if (source !== undefined) fields.source = source as PostExtraFields["source"];
  if (templateId !== undefined) fields.templateId = templateId as string | null;
  if (templateData !== undefined) fields.templateData = templateData;
  if (timezone !== undefined) fields.timezone = timezone as string | null;
  return { fields };
}
