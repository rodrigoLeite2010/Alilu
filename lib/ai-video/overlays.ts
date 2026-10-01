/**
 * Overlays FIXOS do vídeo com IA (logo, URL, textos) — módulo puro, usado
 * na tela (montar/prever) e no servidor (validar/renderizar).
 *
 * Princípio: texto e logo NUNCA passam pelo modelo de vídeo. A IA anima a
 * base visual; depois o Alilu desenha cada overlay (canvas, fontes
 * embutidas) e sobrepõe ao MP4 com FFmpeg — o texto final é exatamente o
 * digitado pelo usuário, sem letras trocadas nem acentos inventados.
 *
 * Coordenadas normalizadas 0..1 em relação ao quadro do vídeo (x/y = canto
 * superior esquerdo da caixa), para valer em qualquer proporção/resolução.
 * O modelo já é o de um editor completo (posição, tamanho, fonte, cores,
 * opacidade, tempo, camadas); a primeira versão da tela usa o "modo
 * simples" (buildSimpleOverlays) com posições pré-definidas.
 */

export type AiVideoOverlayType = "TEXT" | "URL" | "LOGO" | "IMAGE";
export type AiVideoOverlayFontFamily = "sans" | "serif";
export type AiVideoOverlayFontWeight = "normal" | "bold";
export type AiVideoOverlayTextAlign = "left" | "center" | "right";

export interface AiVideoOverlay {
  id: string;
  type: AiVideoOverlayType;
  /** TEXT/URL: o texto exato a desenhar. */
  text: string | null;
  /** LOGO/IMAGE: URL da imagem (Blob do próprio usuário). */
  imageUrl: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Tamanho máximo da fonte como fração da ALTURA do quadro (o texto encolhe para caber na caixa). */
  fontSize: number;
  fontFamily: AiVideoOverlayFontFamily;
  fontWeight: AiVideoOverlayFontWeight;
  textAlign: AiVideoOverlayTextAlign;
  /** "#rrggbb" ou "#rrggbbaa"; null = sem fundo. */
  backgroundColor: string | null;
  textColor: string;
  opacity: number;
  /** Segundos desde o início do vídeo. */
  startTime: number;
  /** null = até o fim. */
  endTime: number | null;
  zIndex: number;
}

/** Preparado para evolução (máscara/região protegida) — ainda sem editor nesta etapa. */
export type ProtectedRegionType = "TEXT" | "LOGO" | "FACE" | "CUSTOM";
export interface ProtectedRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  type: ProtectedRegionType;
}

export const AI_VIDEO_MAX_OVERLAYS = 8;
export const AI_VIDEO_OVERLAY_MAX_TEXT = 120;

export class OverlayValidationError extends Error {}

const COLOR_RE = /^#[0-9a-f]{6}([0-9a-f]{2})?$/i;
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

function finite(value: unknown, field: string): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) throw new OverlayValidationError(`Overlay: valor inválido em ${field}.`);
  return number;
}

/**
 * Valida a lista vinda do front (nunca confiar): tipos, limites,
 * coordenadas dentro do quadro, cores, texto não vazio, imagem só de URL
 * permitida (`isImageUrlAllowed` — no servidor: Blob do próprio usuário).
 * Devolve a lista normalizada e ordenada por zIndex.
 */
export function validateOverlays(raw: unknown, isImageUrlAllowed: (url: string) => boolean): AiVideoOverlay[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new OverlayValidationError("Overlays inválidos.");
  if (raw.length > AI_VIDEO_MAX_OVERLAYS) throw new OverlayValidationError(`No máximo ${AI_VIDEO_MAX_OVERLAYS} textos/logos por vídeo.`);

  const overlays = raw.map((item, index): AiVideoOverlay => {
    if (!item || typeof item !== "object") throw new OverlayValidationError("Overlay inválido.");
    const o = item as Record<string, unknown>;
    const type = o.type;
    if (type !== "TEXT" && type !== "URL" && type !== "LOGO" && type !== "IMAGE") throw new OverlayValidationError("Tipo de overlay inválido.");

    let text: string | null = null;
    let imageUrl: string | null = null;
    if (type === "TEXT" || type === "URL") {
      text = typeof o.text === "string" ? o.text.replace(/\s+/g, " ").trim() : "";
      if (!text) throw new OverlayValidationError("Texto do overlay vazio.");
      if (text.length > AI_VIDEO_OVERLAY_MAX_TEXT) {
        throw new OverlayValidationError(`Cada texto pode ter no máximo ${AI_VIDEO_OVERLAY_MAX_TEXT} caracteres.`);
      }
    } else {
      imageUrl = typeof o.imageUrl === "string" ? o.imageUrl : "";
      if (!imageUrl || !isImageUrlAllowed(imageUrl)) throw new OverlayValidationError("Envie o logo pela própria tela.");
    }

    const width = finite(o.width, "largura");
    const height = finite(o.height, "altura");
    if (width < 0.02 || width > 1 || height < 0.02 || height > 1) throw new OverlayValidationError("Tamanho do overlay inválido.");
    const x = finite(o.x, "x");
    const y = finite(o.y, "y");
    if (x < 0 || y < 0 || x + width > 1.0001 || y + height > 1.0001) throw new OverlayValidationError("Overlay fora do quadro do vídeo.");

    const fontSize = o.fontSize === undefined ? 0.05 : finite(o.fontSize, "fonte");
    if (fontSize < 0.01 || fontSize > 0.3) throw new OverlayValidationError("Tamanho de fonte inválido.");
    const textColor = typeof o.textColor === "string" && COLOR_RE.test(o.textColor) ? o.textColor : "#ffffff";
    const backgroundColor =
      o.backgroundColor === null || o.backgroundColor === undefined || o.backgroundColor === ""
        ? null
        : typeof o.backgroundColor === "string" && COLOR_RE.test(o.backgroundColor)
          ? o.backgroundColor
          : (() => {
              throw new OverlayValidationError("Cor de fundo inválida.");
            })();
    const startTime = o.startTime === undefined ? 0 : finite(o.startTime, "início");
    const endTime = o.endTime === undefined || o.endTime === null ? null : finite(o.endTime, "fim");
    if (startTime < 0 || startTime > 60 || (endTime !== null && (endTime <= startTime || endTime > 60))) {
      throw new OverlayValidationError("Tempo do overlay inválido.");
    }

    return {
      id: typeof o.id === "string" && o.id.length <= 40 ? o.id : `overlay-${index + 1}`,
      type,
      text,
      imageUrl,
      x,
      y,
      width,
      height,
      fontSize,
      fontFamily: o.fontFamily === "serif" ? "serif" : "sans",
      fontWeight: o.fontWeight === "normal" ? "normal" : "bold",
      textAlign: o.textAlign === "left" || o.textAlign === "right" ? o.textAlign : "center",
      backgroundColor,
      textColor,
      opacity: o.opacity === undefined ? 1 : clamp01(finite(o.opacity, "opacidade")),
      startTime,
      endTime,
      zIndex: o.zIndex === undefined ? index : Math.round(finite(o.zIndex, "camada")),
    };
  });

  return overlays.sort((a, b) => a.zIndex - b.zIndex);
}

// ---------------------------------------------------------------------------
// Modo simples (1ª versão da tela): logo, URL, texto principal e secundário
// em posições pré-definidas. Itens na mesma posição são empilhados.
// ---------------------------------------------------------------------------

export type OverlayPosition = "top-left" | "top-center" | "top-right" | "center" | "bottom-left" | "bottom-center" | "bottom-right";
export type OverlayBackgroundStyle = "none" | "dark" | "light";

export const OVERLAY_POSITION_LABEL: Record<OverlayPosition, string> = {
  "top-left": "Topo à esquerda",
  "top-center": "Topo, centro",
  "top-right": "Topo à direita",
  center: "Centro",
  "bottom-left": "Embaixo à esquerda",
  "bottom-center": "Embaixo, centro",
  "bottom-right": "Embaixo à direita",
};

export interface SimpleOverlayInput {
  logoUrl?: string | null;
  logoPosition?: OverlayPosition;
  url?: string | null;
  urlPosition?: OverlayPosition;
  mainText?: string | null;
  mainTextPosition?: OverlayPosition;
  secondaryText?: string | null;
  secondaryTextPosition?: OverlayPosition;
  textColor?: string;
  background?: OverlayBackgroundStyle;
}

const MARGIN = 0.04;
const GAP = 0.012;

interface SimpleItem {
  kind: "logo" | "main" | "secondary" | "url";
  position: OverlayPosition;
  width: number;
  height: number;
}

const ITEM_SIZE: Record<SimpleItem["kind"], { width: number; height: number; fontSize: number }> = {
  logo: { width: 0.24, height: 0.1, fontSize: 0.05 },
  main: { width: 0.88, height: 0.11, fontSize: 0.06 },
  secondary: { width: 0.84, height: 0.07, fontSize: 0.04 },
  url: { width: 0.7, height: 0.05, fontSize: 0.034 },
};

// Ordem de empilhamento dentro de uma mesma posição (de cima para baixo).
const STACK_ORDER: SimpleItem["kind"][] = ["logo", "main", "secondary", "url"];

function horizontal(position: OverlayPosition, width: number): { x: number; align: AiVideoOverlayTextAlign } {
  if (position.endsWith("left")) return { x: MARGIN, align: "left" };
  if (position.endsWith("right")) return { x: 1 - MARGIN - width, align: "right" };
  return { x: (1 - width) / 2, align: "center" };
}

export function buildSimpleOverlays(input: SimpleOverlayInput): AiVideoOverlay[] {
  const textColor = input.textColor && COLOR_RE.test(input.textColor) ? input.textColor : "#ffffff";
  const backgroundColor = input.background === "dark" ? "#000000a6" : input.background === "light" ? "#ffffffd9" : null;
  const entries: Array<{ item: SimpleItem; text: string | null; imageUrl: string | null }> = [];
  const push = (kind: SimpleItem["kind"], position: OverlayPosition | undefined, text: string | null, imageUrl: string | null) => {
    const size = ITEM_SIZE[kind];
    entries.push({ item: { kind, position: position ?? "bottom-center", width: size.width, height: size.height }, text, imageUrl });
  };
  if (input.logoUrl) push("logo", input.logoPosition ?? "top-left", null, input.logoUrl);
  if (input.mainText?.trim()) push("main", input.mainTextPosition ?? "bottom-center", input.mainText.trim(), null);
  if (input.secondaryText?.trim()) push("secondary", input.secondaryTextPosition ?? "bottom-center", input.secondaryText.trim(), null);
  if (input.url?.trim()) push("url", input.urlPosition ?? "bottom-center", input.url.trim(), null);

  const overlays: AiVideoOverlay[] = [];
  const byPosition = new Map<OverlayPosition, typeof entries>();
  for (const entry of entries) {
    const list = byPosition.get(entry.item.position) ?? [];
    list.push(entry);
    byPosition.set(entry.item.position, list);
  }

  for (const [position, list] of byPosition) {
    list.sort((a, b) => STACK_ORDER.indexOf(a.item.kind) - STACK_ORDER.indexOf(b.item.kind));
    const totalHeight = list.reduce((sum, entry) => sum + entry.item.height, 0) + GAP * (list.length - 1);
    let y = position.startsWith("top") ? MARGIN : position === "center" ? (1 - totalHeight) / 2 : 1 - MARGIN - totalHeight;
    for (const { item, text, imageUrl } of list) {
      const { x, align } = horizontal(position, item.width);
      const textual = item.kind !== "logo";
      overlays.push({
        id: item.kind,
        type: item.kind === "logo" ? "LOGO" : item.kind === "url" ? "URL" : "TEXT",
        text: textual ? text : null,
        imageUrl: textual ? null : imageUrl,
        x,
        y: Math.max(0, y),
        width: item.width,
        height: item.height,
        fontSize: ITEM_SIZE[item.kind].fontSize,
        fontFamily: "sans",
        fontWeight: item.kind === "secondary" ? "normal" : "bold",
        textAlign: align,
        backgroundColor: textual ? backgroundColor : null,
        textColor,
        opacity: 1,
        startTime: 0,
        endTime: null,
        zIndex: overlays.length,
      });
      y += item.height + GAP;
    }
  }
  return overlays;
}

function positionOf(overlay: AiVideoOverlay): OverlayPosition {
  const centerY = overlay.y + overlay.height / 2;
  const vertical = centerY < 0.34 ? "top" : centerY > 0.66 ? "bottom" : "center";
  if (vertical === "center") return "center";
  const horizontalPos = overlay.x <= MARGIN + 0.005 ? "left" : overlay.x + overlay.width >= 1 - MARGIN - 0.005 ? "right" : "center";
  return `${vertical}-${horizontalPos}` as OverlayPosition;
}

/** Caminho inverso (para "gerar novamente" e rascunho): overlays do modo simples → campos da tela. */
export function simpleInputFromOverlays(overlays: AiVideoOverlay[]): SimpleOverlayInput {
  const input: SimpleOverlayInput = {};
  for (const overlay of overlays) {
    if (overlay.id === "logo" && overlay.imageUrl) {
      input.logoUrl = overlay.imageUrl;
      input.logoPosition = positionOf(overlay);
    } else if (overlay.id === "main" && overlay.text) {
      input.mainText = overlay.text;
      input.mainTextPosition = positionOf(overlay);
    } else if (overlay.id === "secondary" && overlay.text) {
      input.secondaryText = overlay.text;
      input.secondaryTextPosition = positionOf(overlay);
    } else if (overlay.id === "url" && overlay.text) {
      input.url = overlay.text;
      input.urlPosition = positionOf(overlay);
    }
    if (overlay.text) {
      input.textColor = overlay.textColor;
      input.background = overlay.backgroundColor === null ? "none" : overlay.backgroundColor.toLowerCase().startsWith("#ffffff") ? "light" : "dark";
    }
  }
  return input;
}
