import "server-only";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { put } from "@vercel/blob";
import { getFormatById } from "../formats";
import {
  createInitialEditorState,
  deserializeEditorState,
  setBackgroundImageOverlayOpacity,
  updateTextValue,
  EDITOR_STATE_SCHEMA_VERSION,
  type PostEditorState,
} from "../editor-state";
import { isPostTemplateId, TEXT_SLOT_IDS, type PostTemplateId, type TextSlotId } from "../templates";
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

/**
 * Template usado quando o dia não escolheu nenhum explicitamente. Corrige
 * o bug relatado de "texto só na legenda"/"imagem errada": o padrão
 * histórico do editor manual ("promocao") reserva a foto numa área
 * pequena recortada (não em tela cheia) e tem badge/body/footer com
 * textos de exemplo próprios ("50% OFF", "Sua Loja Aqui") — exatamente o
 * oposto do que o Piloto Automático precisa (a foto escolhida como fundo
 * real, com só a frase gerada por cima). "frase-motivacional" já é o
 * template com foto em tela cheia + frase central + tipografia forte —
 * o pedido de um template "Motivação Clean" já existe pronto aqui.
 */
export const AUTO_TEMPLATE_DEFAULT_TEMPLATE_ID: PostTemplateId = "frase-motivacional";

/** Opacidade padrão do véu sobre a foto quando o dia não configurou nenhuma (20%, conforme pedido). */
export const AUTO_TEMPLATE_DEFAULT_OVERLAY_OPACITY = 0.2;

/** Níveis de véu permitidos na UI — nunca um valor arbitrário digitado à mão. */
export const AUTO_TEMPLATE_OVERLAY_LEVELS = [0, 0.1, 0.2, 0.3, 0.4] as const;

const NON_VISUAL_TEXT_SLOTS: TextSlotId[] = TEXT_SLOT_IDS.filter((slotId) => slotId !== AUTO_TEMPLATE_TEXT_SLOT);

function buildBaseEditorState(
  templateId: string | null,
  styleConfig: Record<string, unknown> | null
): PostEditorState {
  if (styleConfig) {
    const restored = deserializeEditorState({ version: EDITOR_STATE_SCHEMA_VERSION, state: styleConfig }, null);
    if (restored) return restored;
  }
  const safeTemplateId =
    templateId && isPostTemplateId(templateId) ? (templateId as PostTemplateId) : AUTO_TEMPLATE_DEFAULT_TEMPLATE_ID;
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
  /**
   * Opacidade (0..1) do véu escuro sobre a foto, só para legibilidade —
   * ver render.ts/drawBackgroundOverlay. `undefined`/`null` usa o padrão
   * (20%, AUTO_TEMPLATE_DEFAULT_OVERLAY_OPACITY).
   */
  overlayOpacity?: number | null;
  /** Id da execução (automation_runs), só para rastreabilidade. */
  automationRunId: string | null;
}

export interface RenderedAutomationArt {
  buffer: Buffer;
  contentType: "image/jpeg";
  templateIdUsed: PostTemplateId;
}

/**
 * Monta o estado do editor pronto para desenhar: aplica o template (ou o
 * padrão "frase-motivacional"), injeta o texto visual no slot certo e
 * SEMPRE limpa os outros três slots (badge/body/footer) — nenhum deles
 * tem campo próprio no Piloto Automático hoje, então deixá-los com o
 * valor padrão do template ("50% OFF", "Sua Loja Aqui" etc.) vazava texto
 * indesejado dentro da arte gerada (bug relatado: "texto visual da imagem
 * e a legenda estão misturados de forma errada"). Aplica também o véu
 * configurável sobre a foto (0/10/20/30/40%, padrão 20%).
 */
export function buildAutomationArtState(
  input: Pick<RenderAutomationArtInput, "templateId" | "styleConfig" | "visualText" | "overlayOpacity">
): { state: PostEditorState; templateIdUsed: PostTemplateId } {
  let state = buildBaseEditorState(input.templateId, input.styleConfig);
  state = updateTextValue(state, AUTO_TEMPLATE_TEXT_SLOT, input.visualText);
  for (const slotId of NON_VISUAL_TEXT_SLOTS) {
    state = updateTextValue(state, slotId, "");
  }
  const overlayOpacity = input.overlayOpacity ?? AUTO_TEMPLATE_DEFAULT_OVERLAY_OPACITY;
  state = setBackgroundImageOverlayOpacity(state, overlayOpacity);
  return { state, templateIdUsed: state.templateId };
}

/**
 * Desenha o template com o texto visual sobre a imagem de origem e
 * devolve só os bytes prontos (JPEG) — sem subir nada nem gravar no
 * banco. Usado tanto pela geração real (renderAndStoreAutomationArt,
 * abaixo) quanto pela prévia (Parte 8: "o preview deve representar
 * fielmente o resultado final" — a prévia chama exatamente esta mesma
 * função, nunca uma implementação separada, para nunca divergir do
 * resultado final).
 */
export async function renderAutomationArtBuffer(
  input: Pick<RenderAutomationArtInput, "templateId" | "styleConfig" | "sourceImageUrl" | "visualText" | "overlayOpacity">
): Promise<RenderedAutomationArt> {
  const format = getFormatById(AUTO_TEMPLATE_FORMAT_ID);
  const { state, templateIdUsed } = buildAutomationArtState(input);

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

  const buffer = canvas.toBuffer("image/jpeg", 0.92);
  return { buffer, contentType: "image/jpeg", templateIdUsed };
}

/**
 * Desenha o template com o texto visual sobre a imagem de origem, sobe o
 * resultado ao Vercel Blob (mesmo storage do upload manual — put() aceita
 * a mesma autenticação OIDC já usada pela rota de upload, sem precisar de
 * BLOB_READ_WRITE_TOKEN novo) e grava a linha em instagram_media,
 * retornando o novo mediaId pronto para createDraftImagePost.
 */
export async function renderAndStoreAutomationArt(input: RenderAutomationArtInput): Promise<string> {
  const { buffer, templateIdUsed } = await renderAutomationArtBuffer(input);

  const blob = await put(`instagram-media/${input.userId}/generated/${Date.now()}.jpg`, buffer, {
    access: "public",
    addRandomSuffix: true,
    contentType: "image/jpeg",
  });

  // Debug (Parte 11 do briefing) — nunca loga tokens/segredos/API keys,
  // só metadados de rastreabilidade já públicos na própria linha gerada.
  console.info("[template-render-service] arte AUTO_TEMPLATE gerada", {
    userId: input.userId,
    automationRunId: input.automationRunId,
    sourceMediaId: input.sourceMediaId,
    templateIdUsed,
    overlayOpacity: input.overlayOpacity ?? AUTO_TEMPLATE_DEFAULT_OVERLAY_OPACITY,
    visualTextLength: input.visualText.length,
    renderedMediaUrl: blob.url,
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
