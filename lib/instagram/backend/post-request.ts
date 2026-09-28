import type { PostExtraFields, PostMusicSelection } from "@/lib/instagram/backend/instagram-post-repository";
import type { MusicMode, MusicType } from "@/lib/instagram/backend/music-support";

/**
 * Leitura/validação dos campos opcionais de uma publicação vindos do
 * navegador (origem, template, fuso, música). Lógica pura, compartilhada
 * pelas rotas de criação e edição.
 */

const MUSIC_MODES: readonly MusicMode[] = ["ACCOUNT_DEFAULT", "NONE", "CUSTOM"];
const MUSIC_TYPES: readonly MusicType[] = ["None", "InstagramCatalog", "CustomAudio"];
const MAX_MUSIC_FIELD_LENGTH = 200;

function isValidOptionalString(value: unknown, maxLength = MAX_MUSIC_FIELD_LENGTH): boolean {
  return value === undefined || value === null || (typeof value === "string" && value.length <= maxLength);
}

/**
 * `musicSelection` só é aceito (e só faz sentido) quando `musicMode` é
 * "CUSTOM" — nos outros modos, qualquer coisa enviada em `musicSelection`
 * é ignorada silenciosamente (nunca gravada, ver insertPostWithItems),
 * mas a validação aqui roda de qualquer forma para nunca deixar passar um
 * tipo inesperado.
 */
export function validateMusicSelection(value: unknown): { selection: PostMusicSelection | null } | { error: string } {
  if (value === undefined || value === null) return { selection: null };
  if (typeof value !== "object" || Array.isArray(value)) return { error: "musicSelection precisa ser um objeto." };
  const { type, name, artist, externalId, url, audioFileUrl, audioFileName } = value as Record<string, unknown>;
  if (typeof type !== "string" || !MUSIC_TYPES.includes(type as MusicType)) {
    return { error: "musicSelection.type precisa ser None, InstagramCatalog ou CustomAudio." };
  }
  for (const [key, field] of Object.entries({ name, artist, externalId, url, audioFileUrl, audioFileName })) {
    if (!isValidOptionalString(field)) {
      return { error: `musicSelection.${key} precisa ser um texto de até ${MAX_MUSIC_FIELD_LENGTH} caracteres.` };
    }
  }
  return {
    selection: {
      type: type as MusicType,
      name: (name as string | null | undefined) ?? null,
      artist: (artist as string | null | undefined) ?? null,
      externalId: (externalId as string | null | undefined) ?? null,
      url: (url as string | null | undefined) ?? null,
      audioFileUrl: (audioFileUrl as string | null | undefined) ?? null,
      audioFileName: (audioFileName as string | null | undefined) ?? null,
    },
  };
}

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
  const { source, templateId, templateData, timezone, musicMode, musicSelection } = body;
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
  if (musicMode !== undefined && !MUSIC_MODES.includes(musicMode as MusicMode)) {
    return { error: "musicMode precisa ser ACCOUNT_DEFAULT, NONE ou CUSTOM." };
  }
  const musicResult = validateMusicSelection(musicSelection);
  if ("error" in musicResult) return { error: musicResult.error };

  const fields: PostExtraFields = {};
  if (source !== undefined) fields.source = source as PostExtraFields["source"];
  if (templateId !== undefined) fields.templateId = templateId as string | null;
  if (templateData !== undefined) fields.templateData = templateData;
  if (timezone !== undefined) fields.timezone = timezone as string | null;
  if (musicMode !== undefined) fields.musicMode = musicMode as MusicMode;
  if (musicSelection !== undefined) fields.musicSelection = musicResult.selection;
  return { fields };
}
