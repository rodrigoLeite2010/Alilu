import "server-only";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { put } from "@vercel/blob";
import { getFormatById } from "../formats";
import {
  createInitialEditorState,
  deserializeEditorState,
  updateTextValue,
  EDITOR_STATE_SCHEMA_VERSION,
  type PostEditorState,
} from "../editor-state";
import { isPostTemplateId, type PostTemplateId, type TextSlotId } from "../templates";
import { drawPost, type RenderableImage, type RenderingContext2DLike } from "../render";
import { insertInstagramMedia } from "./media-repository";

/**
 * Renderização server-side do template do compositor (Piloto Automático,
 * modo de imagem "AUTO_TEMPLATE" — ver docs/content-automation.md §2.2).
 * Reaproveita INTEIRAMENTE o motor de desenho do compositor manual
 * (drawPost, lib/instagram/render.ts) e as funções puras de
 * lib/instagram/editor-state.ts — a única coisa nova aqui é a origem do
 * contexto de desenho e da imagem (@napi-rs/canvas em vez do <canvas> do
 * navegador), que implementa a mesma Canvas 2D API.
 *
 * Limitação conhecida: as fontes do editor (lib/instagram/fonts.ts) são
 * fontes de sistema do navegador do usuário (Segoe UI, Impact, etc.), que
 * não existem no container Linux da Vercel — sem registrar arquivos de
 * fonte via GlobalFonts do @napi-rs/canvas, o texto renderiza com a fonte
 * padrão do Skia (legível, mas não necessariamente idêntica à prévia).
 * Registrar fontes reais fica para uma etapa futura (ver docs).
 */

export class TemplateRenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TemplateRenderError";
  }
}

/** Formato usado para a arte gerada automaticamente — vertical (4:5), o mais comum no feed. */
export const AUTO_TEMPLATE_FORMAT_ID = "vertical";

/**
 * Slot de texto que recebe o texto visual (IA ou manual). Fixo em
 * "heading" nesta etapa — todos os 5 templates existentes o usam como
 * destaque principal; um seletor por dia (escolher outro slot) fica para
 * uma fase 2, junto do editor de estilo completo.
 */
export const AUTO_TEMPLATE_TEXT_SLOT: TextSlotId = "heading";

function buildBaseEditorState(
  templateId: string | null,
  styleConfig: Record<string, unknown> | null
): PostEditorState {
  if (styleConfig) {
    const restored = deserializeEditorState({ version: EDITOR_STATE_SCHEMA_VERSION, state: styleConfig }, null);
    if (restored) return restored;
  }
  const safeTemplateId = templateId && isPostTemplateId(templateId) ? (templateId as PostTemplateId) : undefined;
  return createInitialEditorState(safeTemplateId, AUTO_TEMPLATE_FORMAT_ID);
}

export interface RenderAutomationArtInput {
  userId: string;
  /** templateId e styleConfig salvos no dia (content_automation_days.template_id/style_config). */
  templateId: string | null;
  styleConfig: Record<string, unknown> | null;
  /** URL pública (Vercel Blob) da foto de origem — a mesma resolvida hoje por resolveImageMediaId no cron. */
  sourceImageUrl: string;
  /** Id da mídia de origem (instagram_media), só para rastreabilidade. */
  sourceMediaId: string | null;
  /** Texto curto a desenhar sobre a imagem — gerado pela IA ou escrito manualmente pelo usuário. */
  visualText: string;
  /** Id da execução (automation_runs), só para rastreabilidade. */
  automationRunId: string | null;
}

/**
 * Desenha o template com o texto visual sobre a imagem de origem, sobe o
 * resultado ao Vercel Blob (mesmo storage do upload manual — put() aceita
 * a mesma autenticação OIDC já usada pela rota de upload, sem precisar de
 * BLOB_READ_WRITE_TOKEN novo) e grava a linha em instagram_media,
 * retornando o novo mediaId pronto para createDraftImagePost.
 */
export async function renderAndStoreAutomationArt(input: RenderAutomationArtInput): Promise<string> {
  const format = getFormatById(AUTO_TEMPLATE_FORMAT_ID);
  const baseState = buildBaseEditorState(input.templateId, input.styleConfig);
  const state = updateTextValue(baseState, AUTO_TEMPLATE_TEXT_SLOT, input.visualText);

  let sourceImage: Awaited<ReturnType<typeof loadImage>>;
  try {
    sourceImage = await loadImage(input.sourceImageUrl);
  } catch (error) {
    throw new TemplateRenderError(
      `Não foi possível carregar a imagem de origem para gerar a arte: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const canvas = createCanvas(format.width, format.height);
  const ctx = canvas.getContext("2d");
  drawPost(ctx as unknown as RenderingContext2DLike, format, state, sourceImage as unknown as RenderableImage);

  const buffer = canvas.toBuffer("image/jpeg", 0.9);

  const blob = await put(`instagram-media/${input.userId}/generated/${Date.now()}.jpg`, buffer, {
    access: "public",
    addRandomSuffix: true,
    contentType: "image/jpeg",
  });

  return insertInstagramMedia({
    userId: input.userId,
    storageUrl: blob.url,
    mediaType: "image",
    fileSizeBytes: buffer.byteLength,
    originalFilename: null,
    generatedFromMediaId: input.sourceMediaId,
    automationRunId: input.automationRunId,
  });
}
