/**
 * Funções puras (sem Canvas API, sem DOM) usadas pelo motor de renderização
 * do editor (lib/instagram/render.ts). Ficam isoladas aqui — em vez de
 * dentro do arquivo que usa CanvasRenderingContext2D — para poderem ser
 * testadas diretamente com Vitest, já que o jsdom usado nos testes não
 * implementa desenho real de canvas (mesmo padrão de lib/calculators/
 * placeholder-image-generator.ts).
 */

export interface CoverRect {
  sx: number;
  sy: number;
  sWidth: number;
  sHeight: number;
}

/**
 * Calcula o retângulo de origem (dentro de uma imagem de `imageWidth` x
 * `imageHeight`) que deve ser desenhado para preencher um destino de
 * `boxWidth` x `boxHeight` sem distorcer a imagem (equivalente a
 * `object-fit: cover`). `focusXFrac`/`focusYFrac` (0..1) controlam qual
 * parte da imagem fica centralizada quando ela precisa ser cortada —
 * 0.5/0.5 é o centro, usado por padrão.
 */
export function computeCoverRect(
  boxWidth: number,
  boxHeight: number,
  imageWidth: number,
  imageHeight: number,
  focusXFrac = 0.5,
  focusYFrac = 0.5,
  zoom = 1
): CoverRect {
  if (boxWidth <= 0 || boxHeight <= 0 || imageWidth <= 0 || imageHeight <= 0) {
    return { sx: 0, sy: 0, sWidth: imageWidth, sHeight: imageHeight };
  }

  const boxRatio = boxWidth / boxHeight;
  const imageRatio = imageWidth / imageHeight;

  let sWidth = imageWidth;
  let sHeight = imageHeight;

  if (imageRatio > boxRatio) {
    // Imagem mais larga que a caixa: corta as laterais.
    sWidth = imageHeight * boxRatio;
  } else {
    // Imagem mais alta que a caixa: corta em cima/embaixo.
    sHeight = imageWidth / boxRatio;
  }

  // Ampliação: recorta uma janela menor da imagem (sempre >= 1, então a
  // área continua 100% preenchida e a proporção é preservada).
  const safeZoom = Number.isFinite(zoom) && zoom > 1 ? zoom : 1;
  sWidth /= safeZoom;
  sHeight /= safeZoom;

  const maxSx = imageWidth - sWidth;
  const maxSy = imageHeight - sHeight;
  const sx = clamp(maxSx * clampFraction(focusXFrac), 0, Math.max(maxSx, 0));
  const sy = clamp(maxSy * clampFraction(focusYFrac), 0, Math.max(maxSy, 0));

  return { sx, sy, sWidth, sHeight };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clampFraction(value: number): number {
  return clamp(Number.isFinite(value) ? value : 0.5, 0, 1);
}

/** Limita o deslocamento manual (arraste) de um texto para que ele não saia da área segura da arte. */
export function clampDragOffset(value: number, limit = 0.32): number {
  return clamp(Number.isFinite(value) ? value : 0, -limit, limit);
}

/** Converte uma fração de tamanho de fonte do template em pixels reais para um formato/escala específicos. */
export function resolveFontSizePx(
  fontSizeFrac: number,
  scale: number,
  canvasWidth: number,
  canvasHeight: number
): number {
  const base = Math.min(canvasWidth, canvasHeight);
  return Math.max(8, Math.round(fontSizeFrac * clamp(scale, 0.5, 2) * base));
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace("#", "");
  const value = normalized.length === 3
    ? normalized.split("").map((char) => char + char).join("")
    : normalized;
  const int = parseInt(value, 16) || 0;
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

function componentToHex(value: number): string {
  return clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");
}

/** Clareia (percent > 0) ou escurece (percent < 0) uma cor hexadecimal. Usada para gerar o degradê de fundo. */
export function shadeHexColor(hex: string, percent: number): string {
  const { r, g, b } = hexToRgb(hex);
  const amount = clamp(percent, -1, 1);
  const mix = (channel: number) =>
    amount >= 0 ? channel + (255 - channel) * amount : channel * (1 + amount);

  return `#${componentToHex(mix(r))}${componentToHex(mix(g))}${componentToHex(mix(b))}`;
}

export function hexToRgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1)})`;
}

/** Nome de arquivo sugerido para a exportação (ETAPA 6). */
export function buildPostFileName(extension: "png" | "jpg"): string {
  return `alilu-instagram-post.${extension}`;
}

/**
 * Nome de arquivo sugerido para UM slide de carrossel ao publicar de
 * verdade (calendário editorial) — numerado (01, 02...) para ficar
 * identificável no Vercel Blob mesmo com o sufixo aleatório que o upload
 * sempre adiciona (addRandomSuffix, ver media/upload/route.ts). Mesma
 * ideia de buildPostFileName, mas com um índice por slide (o carrossel
 * sobe várias imagens de uma vez, então um nome fixo colidiria em
 * legibilidade, ainda que não em armazenamento).
 */
export function buildCarouselSlideFileName(index: number, extension: "png" | "jpg"): string {
  return `alilu-instagram-carrossel-slide-${String(index + 1).padStart(2, "0")}.${extension}`;
}

export interface PanImageInput {
  focusXFrac: number;
  focusYFrac: number;
  /** Deslocamento do ponteiro, em fração da largura/altura da área da imagem. */
  deltaXFrac: number;
  deltaYFrac: number;
  boxWidth: number;
  boxHeight: number;
  imageWidth: number;
  imageHeight: number;
  zoom: number;
}

/**
 * Novo ponto de enquadramento depois de arrastar a imagem dentro da área
 * do template: a imagem acompanha o dedo/mouse (arrastar para a direita
 * mostra mais do lado esquerdo). Quando não há sobra em um eixo (imagem
 * exatamente na proporção), o foco daquele eixo não muda.
 */
export function panImageFocus(input: PanImageInput): { focusXFrac: number; focusYFrac: number } {
  const rect = computeCoverRect(
    input.boxWidth,
    input.boxHeight,
    input.imageWidth,
    input.imageHeight,
    input.focusXFrac,
    input.focusYFrac,
    input.zoom
  );
  const maxSx = input.imageWidth - rect.sWidth;
  const maxSy = input.imageHeight - rect.sHeight;
  const focusXFrac =
    maxSx > 0.5 ? clampFraction(input.focusXFrac - (input.deltaXFrac * rect.sWidth) / maxSx) : input.focusXFrac;
  const focusYFrac =
    maxSy > 0.5 ? clampFraction(input.focusYFrac - (input.deltaYFrac * rect.sHeight) / maxSy) : input.focusYFrac;
  return { focusXFrac, focusYFrac };
}
