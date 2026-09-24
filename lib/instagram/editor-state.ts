/**
 * Estado central do editor (ETAPA 2/5) e funções puras para criá-lo e
 * atualizá-lo. Mantido sem nenhuma dependência de Canvas/DOM para poder ser
 * testado diretamente (ETAPA 11).
 */

import { DEFAULT_FORMAT_ID, type PostFormatId } from "./formats";
import { DEFAULT_FONT_ID } from "./fonts";
import { getColorComboById } from "./colors";
import {
  DEFAULT_TEMPLATE_ID,
  TEXT_SLOT_IDS,
  getTemplateById,
  type PostTemplate,
  type PostTemplateId,
  type TextAlign,
  type TextSlotId,
} from "./templates";
import { clampDragOffset } from "./layout-math";

export interface TextLayerState {
  value: string;
  fontId: string;
  /** Multiplicador aplicado ao fontSizeFrac do template (1 = tamanho padrão do template). */
  fontSizeScale: number;
  color: string;
  align: TextAlign;
  bold: boolean;
  /** Deslocamento manual (arraste), em fração da largura/altura do canvas. */
  offsetXFrac: number;
  offsetYFrac: number;
}

export interface BackgroundImageState {
  /** URL local (blob:) da imagem enviada pelo usuário — nunca é enviada a um servidor. */
  url: string | null;
  fileName: string | null;
  naturalWidth: number | null;
  naturalHeight: number | null;
  /** Ponto de enquadramento (0..1) usado no recorte "cover" — 0.5/0.5 é o centro. */
  focusXFrac: number;
  focusYFrac: number;
  /**
   * Ampliação sobre o enquadramento "cover" (1 = preenche a área sem
   * sobras; 2 = o dobro). Nunca menor que 1: a imagem nunca deixa buraco
   * nem é distorcida — só recortada.
   */
  zoom: number;
  /**
   * URL pública (storage persistente) da imagem ORIGINAL, quando já foi
   * enviada — permite reabrir e editar a arte dias depois (Posts Virais).
   * Nunca é uma URL blob:/data:.
   */
  storageUrl?: string | null;
  /**
   * Como a imagem ocupa a área disponível: "cover" (padrão histórico —
   * preenche a área, cortando o excesso, controlado por focus/zoom acima)
   * ou "contain" (a imagem inteira, sem cortar nada; o espaço sobrando
   * fica com o fundo da arte). Ausente em dados salvos antes desse campo
   * existir — tratado como "cover" em deserializeEditorState.
   */
  fitMode: ImageFitMode;
}

export type ImageFitMode = "cover" | "contain";

export const MIN_IMAGE_ZOOM = 1;
export const MAX_IMAGE_ZOOM = 4;

export interface PostEditorState {
  formatId: PostFormatId;
  templateId: PostTemplateId;
  /** Combinação de cores prontas selecionada, ou null quando o usuário personalizou as cores manualmente. */
  colorComboId: string | null;
  backgroundColor: string;
  /** Cores estruturais (selo/destaque decorativo) — separadas das cores de texto de cada slot. */
  badgeBackground: string;
  badgeTextColor: string;
  accentColor: string;
  backgroundImage: BackgroundImageState;
  texts: Record<TextSlotId, TextLayerState>;
}

function createEmptyBackgroundImage(): BackgroundImageState {
  return {
    url: null,
    fileName: null,
    naturalWidth: null,
    naturalHeight: null,
    focusXFrac: 0.5,
    focusYFrac: 0.5,
    zoom: 1,
    storageUrl: null,
    fitMode: "cover",
  };
}

function createTextLayer(
  template: PostTemplate,
  slotId: TextSlotId,
  color: string
): TextLayerState {
  const slot = template.slots[slotId];
  const isBadge = slotId === "badge";
  const startsEmpty = isBadge && !template.slots.badge.enabledByDefault;

  return {
    value: startsEmpty ? "" : slot.defaultValue,
    fontId: template.defaultFontId ?? DEFAULT_FONT_ID,
    fontSizeScale: 1,
    color,
    align: slot.layout.align,
    bold: slot.layout.fontWeight === "bold",
    offsetXFrac: 0,
    offsetYFrac: 0,
  };
}

function colorForSlot(template: PostTemplate, slotId: TextSlotId, combo: ReturnType<typeof getColorComboById>): string {
  if (slotId === "badge") return combo.badgeText;
  if (slotId === "heading") return combo.heading;
  if (slotId === "body") return combo.body;
  return combo.footer;
}

export function createInitialEditorState(
  templateId: PostTemplateId = DEFAULT_TEMPLATE_ID,
  formatId: PostFormatId = DEFAULT_FORMAT_ID
): PostEditorState {
  const template = getTemplateById(templateId);
  const combo = getColorComboById(template.defaultColorComboId);

  const texts = Object.fromEntries(
    TEXT_SLOT_IDS.map((slotId) => [
      slotId,
      createTextLayer(template, slotId, colorForSlot(template, slotId, combo)),
    ])
  ) as Record<TextSlotId, TextLayerState>;

  return {
    formatId,
    templateId,
    colorComboId: combo.id,
    backgroundColor: combo.background,
    badgeBackground: combo.badgeBackground,
    badgeTextColor: combo.badgeText,
    accentColor: combo.accent,
    backgroundImage: createEmptyBackgroundImage(),
    texts,
  };
}

/**
 * Aplica um novo template ao estado atual, preservando o conteúdo do
 * usuário sempre que possível (ETAPA 4: "A troca de template deverá
 * preservar o conteúdo do usuário sempre que possível"):
 *   - Um texto que o usuário editou (diferente do valor padrão do template
 *     anterior) é mantido.
 *   - Um texto que ainda estava no valor padrão do template anterior passa
 *     a usar o valor padrão do novo template (mantém a página coerente com
 *     o novo contexto, ex.: trocar de "Promoção" para "Aniversário").
 *   - Imagem de fundo enviada pelo usuário é sempre preservada.
 *   - Deslocamentos manuais (arraste) são reiniciados, porque cada
 *     template define posições próprias — arrastar de novo é rápido, e
 *     evita texto fora da área em templates com layouts bem diferentes.
 *   - Cores só são trocadas para a combinação padrão do novo template
 *     quando o usuário ainda não tinha personalizado as cores
 *     manualmente (colorComboId !== null).
 */
export function applyTemplateToState(
  state: PostEditorState,
  nextTemplateId: PostTemplateId
): PostEditorState {
  if (nextTemplateId === state.templateId) return state;

  const previousTemplate = getTemplateById(state.templateId);
  const nextTemplate = getTemplateById(nextTemplateId);
  const usingCustomColors = state.colorComboId === null;
  const nextCombo = getColorComboById(nextTemplate.defaultColorComboId);

  const texts = Object.fromEntries(
    TEXT_SLOT_IDS.map((slotId) => {
      const current = state.texts[slotId];
      const wasUntouched = current.value === previousTemplate.slots[slotId].defaultValue;
      const nextSlot = nextTemplate.slots[slotId];
      const nextDefaultVisible = slotId !== "badge" || nextTemplate.slots.badge.enabledByDefault;

      const value = wasUntouched
        ? nextDefaultVisible
          ? nextSlot.defaultValue
          : ""
        : current.value;

      const color = usingCustomColors ? current.color : colorForSlot(nextTemplate, slotId, nextCombo);

      return [
        slotId,
        {
          ...current,
          value,
          color,
          fontId: usingCustomColors ? current.fontId : nextTemplate.defaultFontId,
          align: nextSlot.layout.align,
          offsetXFrac: 0,
          offsetYFrac: 0,
        },
      ];
    })
  ) as Record<TextSlotId, TextLayerState>;

  return {
    ...state,
    templateId: nextTemplateId,
    colorComboId: usingCustomColors ? null : nextCombo.id,
    backgroundColor: usingCustomColors ? state.backgroundColor : nextCombo.background,
    badgeBackground: usingCustomColors ? state.badgeBackground : nextCombo.badgeBackground,
    badgeTextColor: usingCustomColors ? state.badgeTextColor : nextCombo.badgeText,
    accentColor: usingCustomColors ? state.accentColor : nextCombo.accent,
    texts,
  };
}

export function applyColorComboToState(state: PostEditorState, comboId: string): PostEditorState {
  const template = getTemplateById(state.templateId);
  const combo = getColorComboById(comboId);

  const texts = Object.fromEntries(
    TEXT_SLOT_IDS.map((slotId) => [
      slotId,
      { ...state.texts[slotId], color: colorForSlot(template, slotId, combo) },
    ])
  ) as Record<TextSlotId, TextLayerState>;

  return {
    ...state,
    colorComboId: combo.id,
    backgroundColor: combo.background,
    badgeBackground: combo.badgeBackground,
    badgeTextColor: combo.badgeText,
    accentColor: combo.accent,
    texts,
  };
}

export function updateTextValue(state: PostEditorState, slotId: TextSlotId, value: string): PostEditorState {
  return { ...state, texts: { ...state.texts, [slotId]: { ...state.texts[slotId], value } } };
}

export function updateTextStyle(
  state: PostEditorState,
  slotId: TextSlotId,
  patch: Partial<Omit<TextLayerState, "value">>
): PostEditorState {
  return { ...state, texts: { ...state.texts, [slotId]: { ...state.texts[slotId], ...patch } } };
}

export function updateTextOffset(
  state: PostEditorState,
  slotId: TextSlotId,
  offsetXFrac: number,
  offsetYFrac: number
): PostEditorState {
  return {
    ...state,
    texts: {
      ...state.texts,
      [slotId]: {
        ...state.texts[slotId],
        offsetXFrac: clampDragOffset(offsetXFrac),
        offsetYFrac: clampDragOffset(offsetYFrac),
      },
    },
  };
}

export function setBackgroundColor(state: PostEditorState, color: string): PostEditorState {
  return { ...state, colorComboId: null, backgroundColor: color };
}

export function setBadgeColors(state: PostEditorState, background: string, text: string): PostEditorState {
  return { ...state, colorComboId: null, badgeBackground: background, badgeTextColor: text };
}

export function setBackgroundImage(
  state: PostEditorState,
  image: Pick<BackgroundImageState, "url" | "fileName" | "naturalWidth" | "naturalHeight">
): PostEditorState {
  return {
    ...state,
    backgroundImage: { ...createEmptyBackgroundImage(), ...image },
  };
}

export function clearBackgroundImage(state: PostEditorState): PostEditorState {
  return { ...state, backgroundImage: createEmptyBackgroundImage() };
}

export function setBackgroundImageFocus(state: PostEditorState, focusXFrac: number, focusYFrac: number): PostEditorState {
  return {
    ...state,
    backgroundImage: {
      ...state.backgroundImage,
      focusXFrac: Math.min(1, Math.max(0, focusXFrac)),
      focusYFrac: Math.min(1, Math.max(0, focusYFrac)),
    },
  };
}

export function setBackgroundImageZoom(state: PostEditorState, zoom: number): PostEditorState {
  const safe = Number.isFinite(zoom) ? zoom : 1;
  return {
    ...state,
    backgroundImage: {
      ...state.backgroundImage,
      zoom: Math.min(MAX_IMAGE_ZOOM, Math.max(MIN_IMAGE_ZOOM, safe)),
    },
  };
}

/** Alterna entre preencher a área cortando a imagem ("cover") e mostrar a imagem inteira sem cortar ("contain"). */
export function setBackgroundImageFitMode(state: PostEditorState, fitMode: ImageFitMode): PostEditorState {
  return {
    ...state,
    backgroundImage: { ...state.backgroundImage, fitMode },
  };
}

/** Guarda a URL persistente da imagem original (depois do upload ao storage). */
export function setBackgroundImageStorageUrl(state: PostEditorState, storageUrl: string | null): PostEditorState {
  return { ...state, backgroundImage: { ...state.backgroundImage, storageUrl } };
}

export function setFormat(state: PostEditorState, formatId: PostFormatId): PostEditorState {
  return { ...state, formatId };
}

/** Um slot só é considerado "visível" (e é desenhado) quando tem conteúdo — nunca desenhamos texto vazio. */
export function isSlotVisible(state: PostEditorState, slotId: TextSlotId): boolean {
  return state.texts[slotId].value.trim().length > 0;
}

/** Versão do formato serializado do editor (template_data no banco). */
export const EDITOR_STATE_SCHEMA_VERSION = 1;

export interface SerializedEditorState {
  version: number;
  state: Omit<PostEditorState, "backgroundImage"> & {
    backgroundImage: Omit<BackgroundImageState, "url">;
  };
}

/**
 * Estado do editor pronto para salvar (template_data): remove a URL local
 * (blob:), que não sobrevive a um recarregamento; a imagem é reaberta
 * depois pela `storageUrl` persistente.
 */
export function serializeEditorState(state: PostEditorState): SerializedEditorState {
  const { url: _localUrl, ...image } = state.backgroundImage;
  void _localUrl;
  return { version: EDITOR_STATE_SCHEMA_VERSION, state: { ...state, backgroundImage: image } };
}

/**
 * Reconstrói um estado válido a partir de template_data, tolerante a
 * campos ausentes/antigos (tudo que faltar vem do estado inicial do
 * template). `localImageUrl` é a URL (blob:) recriada para a imagem
 * persistida, quando houver.
 */
export function deserializeEditorState(data: unknown, localImageUrl: string | null = null): PostEditorState | null {
  if (typeof data !== "object" || data === null) return null;
  const raw = (data as { state?: unknown }).state;
  if (typeof raw !== "object" || raw === null) return null;
  const saved = raw as Partial<PostEditorState> & { backgroundImage?: Partial<BackgroundImageState> };
  const base = createInitialEditorState(
    (typeof saved.templateId === "string" ? saved.templateId : undefined) as PostTemplateId | undefined,
    (typeof saved.formatId === "string" ? saved.formatId : undefined) as PostFormatId | undefined,
  );
  const texts = { ...base.texts };
  for (const slotId of TEXT_SLOT_IDS) {
    const layer = saved.texts?.[slotId];
    if (layer && typeof layer === "object") texts[slotId] = { ...base.texts[slotId], ...layer };
  }
  const image: Partial<BackgroundImageState> = saved.backgroundImage ?? {};
  return {
    ...base,
    colorComboId: saved.colorComboId === undefined ? base.colorComboId : saved.colorComboId,
    backgroundColor: typeof saved.backgroundColor === "string" ? saved.backgroundColor : base.backgroundColor,
    badgeBackground: typeof saved.badgeBackground === "string" ? saved.badgeBackground : base.badgeBackground,
    badgeTextColor: typeof saved.badgeTextColor === "string" ? saved.badgeTextColor : base.badgeTextColor,
    accentColor: typeof saved.accentColor === "string" ? saved.accentColor : base.accentColor,
    texts,
    backgroundImage: {
      ...createEmptyBackgroundImage(),
      ...image,
      url: localImageUrl,
      zoom: Math.min(MAX_IMAGE_ZOOM, Math.max(MIN_IMAGE_ZOOM, Number(image.zoom ?? 1) || 1)),
      storageUrl: typeof image.storageUrl === "string" ? image.storageUrl : null,
      fitMode: image.fitMode === "contain" ? "contain" : "cover",
    },
  };
}
