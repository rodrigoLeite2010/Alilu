import { fitTextBlock, type TextBlockBox, type TextMeasurer } from "@/lib/instagram/carousel/text-fit";
import { STORY_LIMITS, type StoryContent } from "../types";
import { EYEBROW_BY_TYPE, templateIdForType, type StoryTemplateId } from "./templates";

/**
 * Layout PURO dos Stories inteligentes: recebe o conteúdo e um medidor de
 * texto e devolve uma lista de itens de desenho em pixels de um canvas
 * 1080×1920 — sem canvas, sem fonte, sem rede. Assim as regras (área
 * segura, cabe/não cabe, hierarquia) são testáveis com um medidor falso;
 * o desenho de verdade (draw.ts) só executa a lista.
 */

export const STORY_WIDTH = 1080;
export const STORY_HEIGHT = 1920;

/**
 * Área segura do Story: o Instagram cobre o topo (perfil/barra de
 * progresso) e a base (campo "enviar mensagem"). Nenhum texto sai daqui.
 */
export const SAFE_AREA = { left: 90, right: 90, top: 250, bottom: 380 } as const;
export const SAFE_WIDTH = STORY_WIDTH - SAFE_AREA.left - SAFE_AREA.right; // 900
const CENTER_X = STORY_WIDTH / 2;

/** Faixa do rodapé de marca (logo + @alilu.tec), dentro da área segura. */
export const FOOTER_CENTER_Y = STORY_HEIGHT - SAFE_AREA.bottom - 40; // 1500
const FOOTER_RESERVED = 110;
const MASCOT_SIZE = 300;
export const MASCOT_BOX = {
  x: STORY_WIDTH - SAFE_AREA.right - MASCOT_SIZE,
  y: STORY_HEIGHT - SAFE_AREA.bottom - FOOTER_RESERVED - MASCOT_SIZE + 40,
  size: MASCOT_SIZE,
} as const;

export const FONT_SERIF = '"Alilu Story Serif"';
export const FONT_SANS = '"Alilu Story Sans"';

export type ColorToken = "text" | "textSoft" | "accent" | "onAccent";
export type FillToken = "card" | "accent" | "accentSoft";

export type DrawItem =
  | { kind: "text"; text: string; x: number; y: number; fontPx: number; family: string; bold: boolean; align: "left" | "center"; color: ColorToken }
  | { kind: "roundRect"; x: number; y: number; w: number; h: number; r: number; fill: FillToken | null; stroke: "border" | "accent" | null; strokeWidth: number }
  | { kind: "checkbox"; x: number; y: number; size: number }
  | { kind: "line"; x1: number; x2: number; y: number; thickness: number }
  | { kind: "image"; asset: "logo" | "mascot"; x: number; y: number; w: number; h: number };

export interface LayoutOptions {
  /** Desenhar logo e/ou @ da marca (os que existirem) discretos no rodapé. */
  showBrand: boolean;
  /** @ da marca do usuário (null/ausente = não desenha texto de marca). */
  brandHandle?: string | null;
  /** A marca tem logo carregado para desenhar. */
  hasLogo?: boolean;
  /** O mascote será desenhado (PNG existe E o plano pediu): reserva o espaço dele. */
  mascot: boolean;
  /** Texto do CTA a exibir (StoryContent.cta). Vazio = sem pílula. */
  showCta?: boolean;
}

export interface StoryLayoutResult {
  templateId: StoryTemplateId;
  items: DrawItem[];
  /** Avisos de diagnóstico (texto encolhido até o piso/cortado com "…"). Nunca bloqueiam a arte. */
  warnings: string[];
}

interface Piece {
  height: number;
  /** Espaço ANTES desta peça (ignorado na primeira). */
  gap: number;
  build: (top: number) => DrawItem[];
}

/** Canvas só para medir texto: o que o layout precisa do contexto. */
export type StoryMeasurer = TextMeasurer;

function textBox(maxWidthPx: number, maxBlockHeightPx: number, family: string, bold: boolean, preferred: number, min: number, lineHeight: number): TextBlockBox {
  return { maxWidthPx, maxBlockHeightPx, fontFamily: family, bold, preferredFontSizePx: preferred, minFontSizePx: min, lineHeight };
}

interface TextPieceInput {
  text: string;
  family: string;
  bold: boolean;
  preferredPx: number;
  minPx: number;
  maxWidth: number;
  maxHeight: number;
  lineHeight: number;
  align: "left" | "center";
  color: ColorToken;
  /** Coordenada X da âncora (esquerda ou centro, conforme align). */
  x: number;
  gap: number;
  label: string;
}

function fitLines(measurer: StoryMeasurer, input: TextPieceInput, warnings: string[]): { lines: string[]; fontPx: number; lineHeightPx: number } {
  const box = textBox(input.maxWidth, input.maxHeight, input.family, input.bold, input.preferredPx, input.minPx, input.lineHeight);
  const fit = fitTextBlock(measurer, input.text, box);
  const lineHeightPx = Math.round(fit.fontSizePx * input.lineHeight);
  const maxLines = Math.max(1, Math.floor(input.maxHeight / lineHeightPx));
  let lines = fit.lines;
  if (lines.length > maxLines) {
    warnings.push(`${input.label}: texto cortado com "…" (não coube em ${maxLines} linhas)`);
    lines = [...lines.slice(0, maxLines - 1), `${lines[maxLines - 1].replace(/[.,;:!?…]*$/, "")}…`];
  } else if (!fit.fits) {
    warnings.push(`${input.label}: texto encolhido até o mínimo`);
  } else if (fit.fontSizePx < input.preferredPx) {
    // encolher até caber é esperado: só diagnóstico leve
  }
  return { lines, fontPx: fit.fontSizePx, lineHeightPx };
}

function textPiece(measurer: StoryMeasurer, input: TextPieceInput, warnings: string[]): Piece | null {
  const text = input.text.trim();
  if (!text) return null;
  const { lines, fontPx, lineHeightPx } = fitLines(measurer, { ...input, text }, warnings);
  return {
    height: lines.length * lineHeightPx,
    gap: input.gap,
    build: (top) =>
      lines.map((line, index) => ({
        kind: "text" as const,
        text: line,
        x: input.x,
        y: top + lineHeightPx * (index + 0.5),
        fontPx,
        family: input.family,
        bold: input.bold,
        align: input.align,
        color: input.color,
      })),
  };
}

function measureWidth(measurer: StoryMeasurer, text: string, family: string, bold: boolean, px: number): number {
  measurer.font = `${bold ? "bold " : ""}${px}px ${family}`;
  return measurer.measureText(text).width;
}

/** Empilha as peças e centraliza o bloco verticalmente na área (nunca acima do topo). */
function stack(pieces: Array<Piece | null>, area: { top: number; bottom: number }, onOverflow?: () => void): DrawItem[] {
  const list = pieces.filter((piece): piece is Piece => piece !== null);
  if (list.length === 0) return [];
  const total = list.reduce((sum, piece, index) => sum + piece.height + (index === 0 ? 0 : piece.gap), 0);
  const free = area.bottom - area.top - total;
  if (free < 0) onOverflow?.();
  let cursor = area.top + Math.max(0, free / 2);
  const items: DrawItem[] = [];
  list.forEach((piece, index) => {
    if (index > 0) cursor += piece.gap;
    items.push(...piece.build(cursor));
    cursor += piece.height;
  });
  return items;
}

function eyebrowPiece(measurer: StoryMeasurer, label: string, align: "left" | "center", warnings: string[]): Piece | null {
  return textPiece(
    measurer,
    {
      text: label,
      family: FONT_SANS,
      bold: true,
      preferredPx: 32,
      minPx: 24,
      maxWidth: SAFE_WIDTH,
      maxHeight: 48,
      lineHeight: 1.2,
      align,
      color: "accent",
      x: align === "center" ? CENTER_X : SAFE_AREA.left,
      gap: 0,
      label: "selo",
    },
    warnings,
  );
}

function dividerPiece(gap: number, width = 140): Piece {
  return {
    height: 8,
    gap,
    build: (top) => [{ kind: "line", x1: CENTER_X - width / 2, x2: CENTER_X + width / 2, y: top + 4, thickness: 8 }],
  };
}

/** CTA: pílula só com contorno (não parece botão clicável) ou preenchida nos templates de marca. */
function ctaPiece(measurer: StoryMeasurer, cta: string, gap: number, filled: boolean, warnings: string[]): Piece | null {
  const text = cta.trim();
  if (!text) return null;
  let fontPx = 38;
  const maxTextWidth = SAFE_WIDTH - 100;
  while (fontPx > 26 && measureWidth(measurer, text, FONT_SANS, true, fontPx) > maxTextWidth) fontPx -= 2;
  let shown = text;
  if (measureWidth(measurer, shown, FONT_SANS, true, fontPx) > maxTextWidth) {
    warnings.push("cta: texto cortado com \"…\"");
    while (shown.length > 4 && measureWidth(measurer, `${shown}…`, FONT_SANS, true, fontPx) > maxTextWidth) shown = shown.slice(0, -1);
    shown = `${shown.trimEnd()}…`;
  }
  const width = Math.min(SAFE_WIDTH, Math.round(measureWidth(measurer, shown, FONT_SANS, true, fontPx)) + 100);
  const height = 92;
  return {
    height,
    gap,
    build: (top) => [
      {
        kind: "roundRect",
        x: CENTER_X - width / 2,
        y: top,
        w: width,
        h: height,
        r: height / 2,
        fill: filled ? "accent" : null,
        stroke: filled ? null : "accent",
        strokeWidth: 4,
      },
      { kind: "text", text: shown, x: CENTER_X, y: top + height / 2, fontPx, family: FONT_SANS, bold: true, align: "center", color: filled ? "onAccent" : "accent" },
    ],
  };
}

function imagePiece(asset: "logo" | "mascot", size: number, gap: number): Piece {
  return { height: size, gap, build: (top) => [{ kind: "image", asset, x: CENTER_X - size / 2, y: top, w: size, h: size }] };
}

function brandFooter(measurer: StoryMeasurer, handle: string | null, hasLogo: boolean): DrawItem[] {
  const logo = 64;
  const gap = 30;
  const textWidth = handle ? measureWidth(measurer, handle, FONT_SANS, true, 32) : 0;
  const total = (hasLogo ? logo : 0) + (hasLogo && handle ? gap : 0) + textWidth;
  const left = CENTER_X - total / 2;
  const items: DrawItem[] = [];
  if (hasLogo) items.push({ kind: "image", asset: "logo", x: left, y: FOOTER_CENTER_Y - logo / 2, w: logo, h: logo });
  if (handle) {
    items.push({ kind: "text", text: handle, x: hasLogo ? left + logo + gap : left, y: FOOTER_CENTER_Y, fontPx: 32, family: FONT_SANS, bold: true, align: "left", color: "textSoft" });
  }
  return items;
}

function base(text: string, over: Partial<TextPieceInput> & Pick<TextPieceInput, "label">): TextPieceInput {
  return {
    text,
    family: FONT_SANS,
    bold: false,
    preferredPx: 44,
    minPx: 32,
    maxWidth: SAFE_WIDTH - 20,
    maxHeight: 400,
    lineHeight: 1.35,
    align: "center",
    color: "textSoft",
    x: CENTER_X,
    gap: 40,
    ...over,
  };
}

/**
 * Constrói o layout do Story. Com mascote, o conteúdo sobe para liberar o
 * canto inferior direito; se mesmo assim não couber (ex.: checklist de 5
 * itens), o mascote é OMITIDO — texto nunca é sacrificado nem sobreposto.
 */
export function layoutStory(content: StoryContent, measurer: StoryMeasurer, options: LayoutOptions): StoryLayoutResult {
  const first = buildLayout(content, measurer, options);
  if (!(options.mascot && first.overflow)) return first.result;
  const second = buildLayout(content, measurer, { ...options, mascot: false });
  second.result.warnings.push("mascote omitido: o texto não deixava espaço para ele");
  return second.result;
}

function buildLayout(content: StoryContent, measurer: StoryMeasurer, options: LayoutOptions): { result: StoryLayoutResult; overflow: boolean } {
  const templateId = templateIdForType(content.type);
  const warnings: string[] = [];
  const brandHandle = options.brandHandle ?? null;
  const hasLogo = options.hasLogo === true;
  // Rodapé de marca só existe se a marca tem algo a mostrar (logo ou @).
  const brandOn = options.showBrand && (brandHandle !== null || hasLogo);
  const footerReserved = brandOn && templateId !== "smart-cta" ? FOOTER_RESERVED : 40;
  const areaBottom = STORY_HEIGHT - SAFE_AREA.bottom - footerReserved;
  // Com mascote, o conteúdo sobe para o espaço dele ficar livre (mascote ocupa o canto inferior direito).
  const area = { top: SAFE_AREA.top + 20, bottom: options.mascot ? Math.min(areaBottom, MASCOT_BOX.y - 30) : areaBottom };
  const showCta = options.showCta !== false;
  const eyebrow = EYEBROW_BY_TYPE[content.type];
  const items: DrawItem[] = [];
  let overflow = false;
  const stackArea = (pieces: Array<Piece | null>, target: { top: number; bottom: number }) =>
    stack(pieces, target, () => {
      overflow = true;
    });

  const headlineSerif = (preferred: number, min: number, maxHeight: number, over: Partial<TextPieceInput> = {}) =>
    textPiece(
      measurer,
      base(content.headline, {
        label: "título",
        family: FONT_SERIF,
        bold: true,
        preferredPx: preferred,
        minPx: min,
        maxHeight,
        lineHeight: 1.18,
        color: "text",
        gap: 36,
        ...over,
      }),
      warnings,
    );

  switch (templateId) {
    case "smart-reflection": {
      items.push(
        ...stackArea(
          [
            eyebrowPiece(measurer, eyebrow, "center", warnings),
            headlineSerif(96, 52, 640),
            content.body ? dividerPiece(44) : null,
            textPiece(measurer, base(content.body, { label: "corpo", maxHeight: 320, gap: 44 }), warnings),
            showCta ? ctaPiece(measurer, content.cta, 70, false, warnings) : null,
          ],
          area,
        ),
      );
      break;
    }
    case "smart-emotional-question": {
      const blank = content.type === "COMPLETE_SENTENCE";
      items.push(
        ...stackArea(
          [
            eyebrowPiece(measurer, eyebrow, "center", warnings),
            blank
              ? null
              : {
                  height: 120,
                  gap: 16,
                  build: (top) => [
                    { kind: "text", text: "?", x: CENTER_X, y: top + 60, fontPx: 150, family: FONT_SERIF, bold: true, align: "center", color: "accent" },
                  ],
                },
            headlineSerif(88, 50, 560, { gap: blank ? 36 : 10 }),
            blank
              ? {
                  height: 8,
                  gap: 70,
                  build: (top) => [{ kind: "line", x1: SAFE_AREA.left + 120, x2: STORY_WIDTH - SAFE_AREA.right - 120, y: top + 4, thickness: 8 }],
                }
              : null,
            textPiece(measurer, base(content.body, { label: "corpo", maxHeight: 260, gap: 40 }), warnings),
            showCta ? ctaPiece(measurer, content.cta, 70, false, warnings) : null,
          ],
          area,
        ),
      );
      break;
    }
    case "smart-visual-poll": {
      const cardH = 168;
      const card = (letter: "A" | "B", text: string): Piece => {
        const textLeft = SAFE_AREA.left + 40 + 96 + 30;
        const fit = fitLines(
          measurer,
          base(text, { label: `opção ${letter}`, family: FONT_SANS, bold: true, preferredPx: 52, minPx: 32, maxWidth: STORY_WIDTH - SAFE_AREA.right - 40 - textLeft, maxHeight: cardH - 36, lineHeight: 1.2, align: "left", color: "text", x: textLeft, gap: 0 }),
          warnings,
        );
        return {
          height: cardH,
          gap: 0,
          build: (top) => [
            { kind: "roundRect", x: SAFE_AREA.left, y: top, w: SAFE_WIDTH, h: cardH, r: 44, fill: "card", stroke: "border", strokeWidth: 3 },
            { kind: "roundRect", x: SAFE_AREA.left + 40, y: top + (cardH - 96) / 2, w: 96, h: 96, r: 48, fill: "accent", stroke: null, strokeWidth: 0 },
            { kind: "text", text: letter, x: SAFE_AREA.left + 40 + 48, y: top + cardH / 2, fontPx: 54, family: FONT_SANS, bold: true, align: "center", color: "onAccent" },
            ...fit.lines.map((line, index) => ({
              kind: "text" as const,
              text: line,
              x: textLeft,
              y: top + cardH / 2 + (index - (fit.lines.length - 1) / 2) * fit.lineHeightPx,
              fontPx: fit.fontPx,
              family: FONT_SANS,
              bold: true,
              align: "left" as const,
              color: "text" as const,
            })),
          ],
        };
      };
      const orPiece: Piece = {
        height: 64,
        gap: 16,
        build: (top) => [{ kind: "text", text: "ou", x: CENTER_X, y: top + 32, fontPx: 38, family: FONT_SERIF, bold: true, align: "center", color: "accent" }],
      };
      items.push(
        ...stackArea(
          [
            eyebrowPiece(measurer, eyebrow, "center", warnings),
            headlineSerif(80, 48, 400),
            { ...card("A", content.optionA), gap: 56 },
            orPiece,
            { ...card("B", content.optionB), gap: 16 },
            showCta ? ctaPiece(measurer, content.cta, 64, false, warnings) : null,
          ],
          area,
        ),
      );
      break;
    }
    case "smart-choice-ab": {
      const cardW = (SAFE_WIDTH - 40) / 2; // 430
      const cardH = 470;
      const side = (letter: "A" | "B", text: string, x: number): DrawItem[] => {
        const fit = fitLines(
          measurer,
          base(text, { label: `opção ${letter}`, family: FONT_SANS, bold: true, preferredPx: 54, minPx: 30, maxWidth: cardW - 70, maxHeight: 220, lineHeight: 1.2, color: "text", x: x + cardW / 2, gap: 0 }),
          warnings,
        );
        return [{ kind: "text", text: letter, x: x + cardW / 2, y: 0, fontPx: 150, family: FONT_SERIF, bold: true, align: "center", color: "accent" }, ...fit.lines.map((line, index) => ({ kind: "text" as const, text: line, x: x + cardW / 2, y: index * fit.lineHeightPx + fit.lineHeightPx / 2, fontPx: fit.fontPx, family: FONT_SANS, bold: true, align: "center" as const, color: "text" as const }))];
      };
      const cards: Piece = {
        height: cardH,
        gap: 56,
        build: (top) => {
          const out: DrawItem[] = [];
          const xs = [SAFE_AREA.left, SAFE_AREA.left + cardW + 40];
          (["A", "B"] as const).forEach((letter, index) => {
            const x = xs[index];
            out.push({ kind: "roundRect", x, y: top, w: cardW, h: cardH, r: 52, fill: "card", stroke: "border", strokeWidth: 3 });
            const parts = side(letter, letter === "A" ? content.optionA : content.optionB, x);
            parts.forEach((part, partIndex) => {
              if (part.kind !== "text") return;
              out.push({ ...part, y: partIndex === 0 ? top + 130 : top + 270 + part.y });
            });
          });
          out.push(
            { kind: "roundRect", x: CENTER_X - 44, y: top + cardH / 2 - 44, w: 88, h: 88, r: 44, fill: "accent", stroke: null, strokeWidth: 0 },
            { kind: "text", text: "ou", x: CENTER_X, y: top + cardH / 2, fontPx: 38, family: FONT_SERIF, bold: true, align: "center", color: "onAccent" },
          );
          return out;
        },
      };
      items.push(
        ...stackArea(
          [eyebrowPiece(measurer, eyebrow, "center", warnings), headlineSerif(80, 48, 380), cards, showCta ? ctaPiece(measurer, content.cta, 64, false, warnings) : null],
          area,
        ),
      );
      break;
    }
    case "smart-mini-story": {
      const padding = 48;
      const bodyInput = base(content.body, { label: "corpo", maxWidth: SAFE_WIDTH - padding * 2, maxHeight: 620, preferredPx: 46, minPx: 32, lineHeight: 1.4, align: "left", color: "text", x: SAFE_AREA.left + padding, gap: 0 });
      const body = content.body.trim() ? fitLines(measurer, bodyInput, warnings) : null;
      const panel: Piece | null = body
        ? {
            height: body.lines.length * body.lineHeightPx + padding * 2,
            gap: 44,
            build: (top) => [
              { kind: "roundRect", x: SAFE_AREA.left, y: top, w: SAFE_WIDTH, h: body.lines.length * body.lineHeightPx + padding * 2, r: 48, fill: "card", stroke: "border", strokeWidth: 3 },
              ...body.lines.map((line, index) => ({
                kind: "text" as const,
                text: line,
                x: SAFE_AREA.left + padding,
                y: top + padding + body.lineHeightPx * (index + 0.5),
                fontPx: body.fontPx,
                family: FONT_SANS,
                bold: false,
                align: "left" as const,
                color: "text" as const,
              })),
            ],
          }
        : null;
      items.push(
        ...stackArea(
          [
            eyebrowPiece(measurer, eyebrow, "left", warnings),
            headlineSerif(82, 48, 420, { align: "left", x: SAFE_AREA.left, gap: 28 }),
            panel,
            showCta ? ctaPiece(measurer, content.cta, 60, false, warnings) : null,
          ],
          area,
        ),
      );
      break;
    }
    case "smart-checklist": {
      const rows = content.body
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 5);
      const rowPieces: Piece[] = rows.map((row, index) => {
        const textLeft = SAFE_AREA.left + 40 + 56 + 28;
        const fit = fitLines(
          measurer,
          base(row, { label: `item ${index + 1}`, bold: true, preferredPx: 44, minPx: 30, maxWidth: STORY_WIDTH - SAFE_AREA.right - 36 - textLeft, maxHeight: 110, lineHeight: 1.2, align: "left", color: "text", x: textLeft, gap: 0 }),
          warnings,
        );
        const height = Math.max(104, fit.lines.length * fit.lineHeightPx + 40);
        return {
          height,
          gap: index === 0 ? 48 : 20,
          build: (top) => [
            { kind: "roundRect", x: SAFE_AREA.left, y: top, w: SAFE_WIDTH, h: height, r: 36, fill: "card", stroke: "border", strokeWidth: 3 },
            { kind: "checkbox", x: SAFE_AREA.left + 40, y: top + (height - 56) / 2, size: 56 },
            ...fit.lines.map((line, lineIndex) => ({
              kind: "text" as const,
              text: line,
              x: textLeft,
              y: top + height / 2 + (lineIndex - (fit.lines.length - 1) / 2) * fit.lineHeightPx,
              fontPx: fit.fontPx,
              family: FONT_SANS,
              bold: true,
              align: "left" as const,
              color: "text" as const,
            })),
          ],
        };
      });
      items.push(
        ...stackArea([eyebrowPiece(measurer, eyebrow, "center", warnings), headlineSerif(80, 48, 300), ...rowPieces, showCta ? ctaPiece(measurer, content.cta, 56, false, warnings) : null], area),
      );
      break;
    }
    case "smart-cta": {
      const handle: Piece | null = brandOn && brandHandle
        ? {
            height: 44,
            gap: 36,
            build: (top) => [{ kind: "text", text: brandHandle, x: CENTER_X, y: top + 22, fontPx: 40, family: FONT_SANS, bold: true, align: "center", color: "textSoft" }],
          }
        : null;
      items.push(
        ...stackArea(
          [
            hasLogo ? imagePiece("logo", 150, 0) : null,
            headlineSerif(92, 52, 520, { gap: 56 }),
            textPiece(measurer, base(content.body, { label: "corpo", maxHeight: 300, gap: 40 }), warnings),
            showCta ? ctaPiece(measurer, content.cta, 64, true, warnings) : null,
            handle,
          ],
          area,
        ),
      );
      break;
    }
  }

  if (brandOn && templateId !== "smart-cta") items.push(...brandFooter(measurer, brandHandle, hasLogo));
  if (options.mascot) items.push({ kind: "image", asset: "mascot", x: MASCOT_BOX.x, y: MASCOT_BOX.y, w: MASCOT_BOX.size, h: MASCOT_BOX.size });

  return { result: { templateId, items, warnings }, overflow };
}

/** Limites de texto do conteúdo, reexportados para quem desenha/valida na UI. */
export { STORY_LIMITS };
