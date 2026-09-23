/**
 * Motor de renderização do editor: desenha o estado atual (formato,
 * template, textos, cores, imagem) em um <canvas>. Usado tanto para a
 * prévia em tempo real quanto para a exportação (ETAPA 6, requisitos 1 e
 * 2): o canvas de prévia já é criado na resolução REAL do formato
 * escolhido (ver components/tools/instagram-post-creator/EditorPreviewCanvas.tsx),
 * então exportar é apenas ler os pixels desse mesmo canvas — não existe
 * uma versão "de baixa resolução" separada, o que garante que a imagem
 * exportada corresponda exatamente ao que aparece na prévia.
 *
 * Este arquivo depende da Canvas API do navegador e por isso não é testado
 * diretamente com Vitest/jsdom (mesma decisão já tomada em
 * lib/calculators/placeholder-image-generator.ts) — a matemática pura que
 * ele usa (recorte "cover", clamps, cores) fica isolada e testada em
 * lib/instagram/layout-math.ts.
 */

import type { PostFormat } from "./formats";
import { getFontById } from "./fonts";
import { clamp, computeCoverRect, resolveFontSizePx, shadeHexColor } from "./layout-math";
import { getTemplateById, TEXT_SLOT_IDS, type PostTemplate, type TextSlotId } from "./templates";
import type { PostEditorState } from "./editor-state";

export interface SlotBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type SlotBoundingBoxMap = Partial<Record<TextSlotId, SlotBoundingBox>>;

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const r = Math.max(0, Math.min(radius, Math.min(width, height) / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.arcTo(x + width, y, x + width, y + r, r);
  ctx.lineTo(x + width, y + height - r);
  ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
  ctx.lineTo(x + r, y + height);
  ctx.arcTo(x, y + height, x, y + height - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const paragraphs = text.split("\n");
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }

    let current = words[0];
    for (const word of words.slice(1)) {
      const candidate = `${current} ${word}`;
      if (ctx.measureText(candidate).width <= maxWidth) {
        current = candidate;
      } else {
        lines.push(current);
        current = word;
      }
    }
    lines.push(current);
  }

  return lines;
}

function drawTextLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  letterSpacing: number
): void {
  if (!letterSpacing) {
    ctx.fillText(text, x, y);
    return;
  }

  // Espaçamento entre letras desenhado manualmente (compatível com
  // qualquer navegador, sem depender de CanvasRenderingContext2D.letterSpacing).
  const align = ctx.textAlign;
  const chars = text.split("");
  const widths = chars.map((char) => ctx.measureText(char).width + letterSpacing);
  const totalWidth = widths.reduce((sum, w) => sum + w, 0) - letterSpacing;

  let startX = x;
  if (align === "center") startX = x - totalWidth / 2;
  else if (align === "right") startX = x - totalWidth;

  const previousAlign = ctx.textAlign;
  ctx.textAlign = "left";
  let cursor = startX;
  chars.forEach((char, index) => {
    ctx.fillText(char, cursor, y);
    cursor += widths[index];
  });
  ctx.textAlign = previousAlign;
}

function measureLinesWidth(ctx: CanvasRenderingContext2D, lines: string[]): number {
  return lines.reduce((max, line) => Math.max(max, ctx.measureText(line).width), 0);
}

function drawPlaceholderIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
  ctx.lineWidth = Math.max(2, size * 0.08);
  ctx.lineJoin = "round";
  roundedRectPath(ctx, cx - size, cy - size * 0.72, size * 2, size * 1.44, size * 0.18);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.42, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  state: PostEditorState,
  format: PostFormat,
  template: PostTemplate,
  uploadedImage: HTMLImageElement | null
): void {
  if (template.imageArea === null && uploadedImage) {
    const cover = computeCoverRect(
      format.width,
      format.height,
      uploadedImage.naturalWidth,
      uploadedImage.naturalHeight,
      state.backgroundImage.focusXFrac,
      state.backgroundImage.focusYFrac,
      state.backgroundImage.zoom ?? 1
    );
    ctx.drawImage(
      uploadedImage,
      cover.sx,
      cover.sy,
      cover.sWidth,
      cover.sHeight,
      0,
      0,
      format.width,
      format.height
    );

    if (template.scrimOverBackgroundImage) {
      const gradient = ctx.createLinearGradient(0, 0, 0, format.height);
      gradient.addColorStop(0, "rgba(0, 0, 0, 0.18)");
      gradient.addColorStop(0.55, "rgba(0, 0, 0, 0.38)");
      gradient.addColorStop(1, "rgba(0, 0, 0, 0.74)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, format.width, format.height);
    }
    return;
  }

  const gradient = ctx.createLinearGradient(0, 0, 0, format.height);
  gradient.addColorStop(0, shadeHexColor(state.backgroundColor, 0.14));
  gradient.addColorStop(1, shadeHexColor(state.backgroundColor, -0.14));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, format.width, format.height);
}

function drawDecoration(
  ctx: CanvasRenderingContext2D,
  format: PostFormat,
  template: PostTemplate,
  accentColor: string
): void {
  const min = Math.min(format.width, format.height);
  ctx.save();

  switch (template.decoration) {
    case "ribbon": {
      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(min * 0.26, 0);
      ctx.lineTo(0, min * 0.26);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(0, format.height - min * 0.02, format.width, min * 0.02);
      break;
    }
    case "frame": {
      ctx.fillStyle = "rgba(0, 0, 0, 0.06)";
      roundedRectPath(ctx, format.width * 0.04, format.height * 0.04, format.width * 0.92, format.height * 0.92, min * 0.05);
      ctx.fill();
      ctx.strokeStyle = accentColor;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = Math.max(2, min * 0.006);
      roundedRectPath(ctx, format.width * 0.05, format.height * 0.05, format.width * 0.9, format.height * 0.9, min * 0.045);
      ctx.stroke();
      ctx.globalAlpha = 1;
      break;
    }
    case "dots": {
      const seeds: Array<[number, number]> = [
        [0.08, 0.1], [0.9, 0.08], [0.85, 0.92], [0.1, 0.9], [0.5, 0.06],
        [0.92, 0.5], [0.06, 0.5], [0.5, 0.96], [0.25, 0.05], [0.75, 0.96],
      ];
      seeds.forEach(([fx, fy], index) => {
        ctx.globalAlpha = index % 2 === 0 ? 0.55 : 0.35;
        ctx.fillStyle = accentColor;
        ctx.beginPath();
        ctx.arc(fx * format.width, fy * format.height, min * (index % 3 === 0 ? 0.018 : 0.011), 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      break;
    }
    case "clean": {
      ctx.fillStyle = accentColor;
      ctx.fillRect(0, 0, format.width, min * 0.012);
      ctx.fillRect(format.width * 0.08, format.height * 0.22, min * 0.045, min * 0.045);
      break;
    }
    case "quote-marks": {
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = accentColor;
      ctx.font = `bold ${Math.round(min * 0.32)}px Georgia, serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("“", format.width * 0.5, format.height * 0.3);
      ctx.globalAlpha = 1;
      break;
    }
  }

  ctx.restore();
}

function drawImageArea(
  ctx: CanvasRenderingContext2D,
  state: PostEditorState,
  format: PostFormat,
  template: PostTemplate,
  uploadedImage: HTMLImageElement | null
): void {
  const area = template.imageArea;
  if (!area) return;

  const x = area.xFrac * format.width;
  const y = area.yFrac * format.height;
  const w = area.widthFrac * format.width;
  const h = area.heightFrac * format.height;
  const radius = area.cornerRadiusFrac * Math.min(w, h);

  ctx.save();
  roundedRectPath(ctx, x, y, w, h, radius);
  ctx.clip();

  if (uploadedImage) {
    const cover = computeCoverRect(
      w,
      h,
      uploadedImage.naturalWidth,
      uploadedImage.naturalHeight,
      state.backgroundImage.focusXFrac,
      state.backgroundImage.focusYFrac,
      state.backgroundImage.zoom ?? 1
    );
    ctx.drawImage(uploadedImage, cover.sx, cover.sy, cover.sWidth, cover.sHeight, x, y, w, h);
  } else {
    const gradient = ctx.createLinearGradient(x, y, x + w, y + h);
    gradient.addColorStop(0, "rgba(255, 255, 255, 0.22)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0.12)");
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, w, h);
    drawPlaceholderIcon(ctx, x + w / 2, y + h / 2, Math.min(w, h) * 0.2);
  }
  ctx.restore();

  ctx.save();
  roundedRectPath(ctx, x, y, w, h, radius);
  ctx.lineWidth = Math.max(2, Math.min(format.width, format.height) * 0.004);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
  ctx.stroke();
  ctx.restore();
}

function drawTextSlots(
  ctx: CanvasRenderingContext2D,
  state: PostEditorState,
  format: PostFormat,
  template: PostTemplate
): SlotBoundingBoxMap {
  const boxes: SlotBoundingBoxMap = {};

  for (const slotId of TEXT_SLOT_IDS) {
    const text = state.texts[slotId];
    const value = text.value.trim();
    if (!value) continue;

    const slot = template.slots[slotId];
    const layout = slot.layout;
    const font = getFontById(text.fontId);
    const fontSizePx = resolveFontSizePx(layout.fontSizeFrac, text.fontSizeScale, format.width, format.height);
    const lineHeightPx = Math.round(fontSizePx * layout.lineHeight);
    const bold = text.bold || layout.fontWeight === "bold";
    const displayValue = layout.uppercase ? value.toUpperCase() : value;

    ctx.font = `${bold ? "bold " : ""}${fontSizePx}px ${font.family}`;
    ctx.textAlign = text.align;
    ctx.textBaseline = "middle";

    const maxWidthPx = layout.maxWidthFrac * format.width;
    const fitsOneLine = ctx.measureText(displayValue).width <= maxWidthPx && !displayValue.includes("\n");
    const lines = slot.multiline || !fitsOneLine ? wrapLines(ctx, displayValue, maxWidthPx) : [displayValue];

    const centerX = clamp((layout.xFrac + text.offsetXFrac) * format.width, format.width * 0.02, format.width * 0.98);
    const centerY = clamp((layout.yFrac + text.offsetYFrac) * format.height, format.height * 0.04, format.height * 0.96);

    const totalHeight = lines.length * lineHeightPx;
    const startY = centerY - totalHeight / 2 + lineHeightPx / 2;
    const widestLine = measureLinesWidth(ctx, lines);

    if (layout.pill) {
      const paddingX = fontSizePx * 0.7;
      const paddingY = fontSizePx * 0.45;
      const pillWidth = widestLine + paddingX * 2;
      const pillHeight = totalHeight + paddingY * 2;
      const pillX = text.align === "left"
        ? centerX - paddingX
        : text.align === "right"
          ? centerX - pillWidth + paddingX
          : centerX - pillWidth / 2;
      const pillY = centerY - pillHeight / 2;

      ctx.save();
      ctx.fillStyle = state.badgeBackground;
      roundedRectPath(ctx, pillX, pillY, pillWidth, pillHeight, pillHeight / 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.fillStyle = state.badgeTextColor;
      ctx.font = `${bold ? "bold " : ""}${fontSizePx}px ${font.family}`;
      ctx.textAlign = text.align;
      ctx.textBaseline = "middle";
      lines.forEach((line, index) => {
        drawTextLine(ctx, line, centerX, startY + index * lineHeightPx, layout.letterSpacing ?? 0);
      });
      ctx.restore();

      const boxWidth = pillWidth;
      const boxHeight = pillHeight;
      const boxX = text.align === "left" ? pillX : text.align === "right" ? pillX : centerX - boxWidth / 2;
      boxes[slotId] = { x: boxX, y: pillY, width: boxWidth, height: boxHeight };
      continue;
    }

    ctx.save();
    ctx.fillStyle = text.color;
    lines.forEach((line, index) => {
      drawTextLine(ctx, line, centerX, startY + index * lineHeightPx, layout.letterSpacing ?? 0);
    });
    ctx.restore();

    const boxX = text.align === "left" ? centerX : text.align === "right" ? centerX - widestLine : centerX - widestLine / 2;
    boxes[slotId] = { x: boxX, y: centerY - totalHeight / 2, width: widestLine, height: totalHeight };
  }

  return boxes;
}

/**
 * Desenha o post inteiro no canvas informado, na resolução exata do
 * formato escolhido. Retorna a caixa delimitadora (em pixels do canvas) de
 * cada texto visível, usada por EditorPreviewCanvas para permitir
 * arrastar/reposicionar os textos (ETAPA 5.1).
 */
export function drawPost(
  ctx: CanvasRenderingContext2D,
  format: PostFormat,
  state: PostEditorState,
  uploadedImage: HTMLImageElement | null
): SlotBoundingBoxMap {
  const template = getTemplateById(state.templateId);

  ctx.clearRect(0, 0, format.width, format.height);
  ctx.save();

  drawBackground(ctx, state, format, template, uploadedImage);
  drawDecoration(ctx, format, template, state.accentColor);
  drawImageArea(ctx, state, format, template, uploadedImage);
  const boxes = drawTextSlots(ctx, state, format, template);

  ctx.restore();
  return boxes;
}
