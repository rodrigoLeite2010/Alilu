/**
 * Layout PURO de um slide do carrossel (1080×1350): recebe o conteúdo e um
 * medidor de texto e devolve itens de desenho em pixels — sem canvas, sem
 * fonte, sem rede. Regras de área segura, "cabe/não cabe" e hierarquia
 * ficam testáveis com um medidor falso.
 */
import { fitTextBlock, type TextBlockBox, type TextMeasurer } from "@/lib/instagram/carousel/text-fit";
import { CAROUSEL_HEIGHT, CAROUSEL_WIDTH, type CarouselTemplate } from "./templates";

export const FONT_SANS = '"Alilu Carousel Sans"';
export const FONT_SERIF = '"Alilu Carousel Serif"';

/** Margens seguras (o feed do Instagram corta um pouco nas bordas do grid 3:4). */
export const MARGIN = { left: 90, right: 90, top: 120, bottom: 150 } as const;
export const CONTENT_WIDTH = CAROUSEL_WIDTH - MARGIN.left - MARGIN.right; // 900
const TEXT_AREA_TOP = 230;
const TEXT_AREA_BOTTOM = CAROUSEL_HEIGHT - MARGIN.bottom - 40; // 1160

export type ColorRole = "text" | "textSoft" | "accent" | "onAccent";

export type DrawItem =
  | { kind: "text"; text: string; x: number; y: number; fontPx: number; family: string; bold: boolean; align: "left" | "center" | "right"; color: ColorRole }
  | { kind: "roundRect"; x: number; y: number; w: number; h: number; r: number; fill: ColorRole | null; stroke: ColorRole | null; strokeWidth: number; alpha: number }
  | { kind: "image"; asset: "logo"; x: number; y: number; w: number; h: number };

export interface SlideLayoutInput {
  position: number;
  total: number;
  headline: string;
  body: string;
  cta: string;
  template: CarouselTemplate;
  /** Foto como fundo (texto ancorado embaixo, sobre véu escuro). */
  hasPhoto: boolean;
  /** "@perfil" mostrado discretamente no topo (null = nada). */
  handle: string | null;
  hasLogo: boolean;
  /** Alinhamento escolhido no editor (padrão: o do template). */
  align?: "left" | "center";
}

export interface SlideLayoutResult {
  items: DrawItem[];
  warnings: string[];
}

function box(maxWidthPx: number, maxBlockHeightPx: number, family: string, bold: boolean, preferred: number, min: number, lineHeight: number): TextBlockBox {
  return { maxWidthPx, maxBlockHeightPx, fontFamily: family, bold, preferredFontSizePx: preferred, minFontSizePx: min, lineHeight };
}

interface Fitted {
  lines: string[];
  fontPx: number;
  lineHeightPx: number;
  height: number;
}

function fit(measurer: TextMeasurer, text: string, b: TextBlockBox, label: string, warnings: string[]): Fitted | null {
  const clean = text.trim();
  if (!clean) return null;
  const result = fitTextBlock(measurer, clean, b);
  const lineHeightPx = Math.round(result.fontSizePx * b.lineHeight);
  const maxLines = Math.max(1, Math.floor(b.maxBlockHeightPx / lineHeightPx));
  let lines = result.lines;
  if (lines.length > maxLines) {
    warnings.push(`${label}: texto cortado com "…"`);
    lines = [...lines.slice(0, maxLines - 1), `${lines[maxLines - 1].replace(/[.,;:!?…]*$/, "")}…`];
  } else if (!result.fits) {
    warnings.push(`${label}: texto encolhido até o mínimo`);
  }
  return { lines, fontPx: result.fontSizePx, lineHeightPx, height: lines.length * lineHeightPx };
}

export function layoutCarouselSlide(measurer: TextMeasurer, input: SlideLayoutInput): SlideLayoutResult {
  const warnings: string[] = [];
  const items: DrawItem[] = [];
  const { template } = input;
  const align = input.align ?? template.align;
  const isCover = input.position === 1;
  const isLast = input.position === input.total && input.total > 1;
  const x = align === "center" ? CAROUSEL_WIDTH / 2 : MARGIN.left;
  const headlineFamily = template.headlineFont === "serif" ? FONT_SERIF : FONT_SANS;

  // --- Cabeçalho: numeração e @ discretos --------------------------------
  if (!isCover || input.handle) {
    items.push({
      kind: "text",
      text: `${String(input.position).padStart(2, "0")}/${String(input.total).padStart(2, "0")}`,
      x: MARGIN.left,
      y: MARGIN.top,
      fontPx: 30,
      family: FONT_SANS,
      bold: true,
      align: "left",
      color: "textSoft",
    });
  }
  if (input.handle) {
    items.push({ kind: "text", text: input.handle, x: CAROUSEL_WIDTH - MARGIN.right - (input.hasLogo ? 84 : 0), y: MARGIN.top, fontPx: 30, family: FONT_SANS, bold: false, align: "right", color: "textSoft" });
  }
  if (input.hasLogo) {
    items.push({ kind: "image", asset: "logo", x: CAROUSEL_WIDTH - MARGIN.right - 56, y: MARGIN.top - 28, w: 56, h: 56 });
  }

  // --- Texto principal ----------------------------------------------------
  const ctaReserve = isLast && input.cta.trim() ? 150 : 0;
  const bottom = TEXT_AREA_BOTTOM - ctaReserve;
  const headline = fit(measurer, input.headline, box(CONTENT_WIDTH, isCover ? 560 : 420, headlineFamily, true, isCover ? 104 : 80, isCover ? 52 : 46, 1.12), "título", warnings);
  const bodyAvailable = Math.max(120, bottom - TEXT_AREA_TOP - (headline?.height ?? 0) - 40);
  const body = fit(measurer, input.body, box(CONTENT_WIDTH, Math.min(bodyAvailable, 520), FONT_SANS, false, isCover ? 40 : 42, 28, 1.36), "texto", warnings);

  const gap = headline && body ? 38 : 0;
  const barHeight = template.decor === "bar" ? 12 : 0;
  const barGap = barHeight ? 34 : 0;
  const total = barHeight + barGap + (headline?.height ?? 0) + gap + (body?.height ?? 0);
  const free = bottom - TEXT_AREA_TOP - total;
  // Foto: bloco ancorado embaixo; sem foto: centralizado verticalmente.
  let cursor = input.hasPhoto ? Math.max(TEXT_AREA_TOP, bottom - total) : TEXT_AREA_TOP + Math.max(0, free / 2);

  if (barHeight) {
    const barW = 140;
    const barX = align === "center" ? (CAROUSEL_WIDTH - barW) / 2 : MARGIN.left;
    items.push({ kind: "roundRect", x: barX, y: cursor, w: barW, h: barHeight, r: barHeight / 2, fill: "accent", stroke: null, strokeWidth: 0, alpha: 1 });
    cursor += barHeight + barGap;
  }
  for (const [piece, color, bold, family] of [
    [headline, "text", true, headlineFamily],
    [body, "textSoft", false, FONT_SANS],
  ] as const) {
    if (!piece) continue;
    piece.lines.forEach((line, index) => {
      items.push({ kind: "text", text: line, x, y: cursor + piece.lineHeightPx * (index + 0.5), fontPx: piece.fontPx, family, bold, align, color });
    });
    cursor += piece.height + (piece === headline ? gap : 0);
  }

  // --- CTA (último slide) --------------------------------------------------
  const cta = input.cta.trim();
  if (isLast && cta) {
    const fontPx = 38;
    measurer.font = `bold ${fontPx}px ${FONT_SANS}`;
    const textWidth = Math.min(CONTENT_WIDTH - 100, measurer.measureText(cta).width);
    const w = textWidth + 100;
    const h = 92;
    const pillX = align === "center" ? (CAROUSEL_WIDTH - w) / 2 : MARGIN.left;
    const pillY = TEXT_AREA_BOTTOM - h;
    items.push({ kind: "roundRect", x: pillX, y: pillY, w, h, r: h / 2, fill: "accent", stroke: null, strokeWidth: 0, alpha: 1 });
    items.push({ kind: "text", text: cta, x: pillX + w / 2, y: pillY + h / 2, fontPx, family: FONT_SANS, bold: true, align: "center", color: "onAccent" });
  }

  // --- Cobertura: dica de arraste -----------------------------------------
  if (isCover && input.total > 1) {
    items.push({ kind: "text", text: "arraste →", x: CAROUSEL_WIDTH - MARGIN.right, y: CAROUSEL_HEIGHT - MARGIN.bottom - 10, fontPx: 32, family: FONT_SANS, bold: true, align: "right", color: "accent" });
  }

  // --- Barra de progresso -------------------------------------------------
  const barY = CAROUSEL_HEIGHT - 70;
  const gapPx = 10;
  const segment = (CONTENT_WIDTH - gapPx * (input.total - 1)) / input.total;
  for (let index = 0; index < input.total; index += 1) {
    items.push({
      kind: "roundRect",
      x: MARGIN.left + index * (segment + gapPx),
      y: barY,
      w: segment,
      h: 8,
      r: 4,
      fill: index < input.position ? "accent" : "textSoft",
      stroke: null,
      strokeWidth: 0,
      alpha: index < input.position ? 1 : 0.28,
    });
  }
  return { items, warnings };
}
