/**
 * Medição de texto pura, sem Canvas/DOM (mesma decisão de
 * lib/instagram/layout-math.ts — testável direto com Vitest). Usada pelo
 * planejamento automático de slides (generate-slides-from-text.ts) para
 * decidir, ANTES de desenhar nada, quanto texto cabe em um bloco — com a
 * mesma matemática do ajuste dinâmico de fonte já usado ao desenhar cada
 * slide de verdade (drawTextSlots, em lib/instagram/render.ts): quebra de
 * linha por palavra medida de verdade (`measureText`), depois encolhe a
 * fonte até um piso de legibilidade (nunca "letrinha minúscula" só para
 * caber tudo) antes de considerar que o texto não cabe.
 *
 * Não é a mesma implementação de drawTextSlots (aquele fica dentro de
 * render.ts, que depende da Canvas API do navegador e por isso não é
 * testado diretamente) — mas usa os MESMOS dois números que definem os
 * limites do ajuste automático (TEXT_SLOT_MAX_BLOCK_HEIGHT_FRAC e
 * TEXT_SLOT_MIN_FONT_SIZE_FRAC, importados de layout-math.ts), então o que
 * este arquivo decide que "cabe" sempre bate com o que o motor de
 * desenho de fato vai desenhar depois — nunca um slide gerado
 * automaticamente aparece cortado com "…" na hora de publicar.
 */

import {
  TEXT_SLOT_GENERATED_MIN_SHRINK_RATIO,
  TEXT_SLOT_MAX_BLOCK_HEIGHT_FRAC,
  TEXT_SLOT_MIN_FONT_SIZE_FRAC,
  resolveFontSizePx,
} from "../layout-math";

/**
 * Subconjunto mínimo da Canvas 2D API que a medição precisa —
 * `RenderingContext2DLike` (render.ts) satisfaz isto estruturalmente; em
 * testes, um objeto simples com um `measureText` determinístico basta
 * (ver __tests__/lib/instagram-carousel-generate-slides.test.ts).
 */
export interface TextMeasurer {
  measureText(text: string): { width: number };
  font: string;
}

export interface TextBlockBox {
  /** Largura máxima do bloco de texto, em pixels do canvas (já resolvida a partir de maxWidthFrac × largura do formato). */
  maxWidthPx: number;
  /** Altura máxima que o bloco de linhas pode ocupar, em pixels (já resolvida a partir de TEXT_SLOT_MAX_BLOCK_HEIGHT_FRAC × altura do formato). */
  maxBlockHeightPx: number;
  fontFamily: string;
  bold: boolean;
  /** Tamanho de fonte preferido (o padrão do template, em px) — o ponto de partida antes de qualquer encolhimento. */
  preferredFontSizePx: number;
  /** Piso de legibilidade, em px — nunca encolhe além disto (já resolvido a partir de TEXT_SLOT_MIN_FONT_SIZE_FRAC). */
  minFontSizePx: number;
  lineHeight: number;
}

export interface TextFitResult {
  lines: string[];
  fontSizePx: number;
  /** true quando o texto coube inteiro (mesmo que encolhido até o piso) sem precisar cortar com "…". */
  fits: boolean;
}

/**
 * Quebra de linha por palavra, medida de verdade — mesmo algoritmo de
 * `wrapLines` em render.ts (parágrafos por "\n", depois palavras
 * gulosamente encaixadas até estourar `maxWidthPx`).
 */
export function wrapMeasuredLines(ctx: TextMeasurer, text: string, maxWidthPx: number): string[] {
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
      if (ctx.measureText(candidate).width <= maxWidthPx) {
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

/**
 * Decide se `text` cabe em `box`, encolhendo a fonte a partir de
 * `preferredFontSizePx` até `minFontSizePx` (mesmo fator 0.92 por
 * tentativa do ajuste dinâmico em drawTextSlots) — sem nunca cortar o
 * texto: `fits: false` sinaliza que nem no piso mínimo o texto coube
 * inteiro (quem chama decide o que fazer, normalmente: comece um slide
 * novo).
 */
export function fitTextBlock(ctx: TextMeasurer, text: string, box: TextBlockBox): TextFitResult {
  const setFont = (sizePx: number) => {
    ctx.font = `${box.bold ? "bold " : ""}${sizePx}px ${box.fontFamily}`;
  };

  let fontSizePx = box.preferredFontSizePx;
  let lineHeightPx = Math.round(fontSizePx * box.lineHeight);
  setFont(fontSizePx);
  let lines = wrapMeasuredLines(ctx, text, box.maxWidthPx);

  while (lines.length * lineHeightPx > box.maxBlockHeightPx && fontSizePx > box.minFontSizePx) {
    fontSizePx = Math.max(box.minFontSizePx, Math.round(fontSizePx * 0.92));
    lineHeightPx = Math.round(fontSizePx * box.lineHeight);
    setFont(fontSizePx);
    lines = wrapMeasuredLines(ctx, text, box.maxWidthPx);
  }

  return {
    lines,
    fontSizePx,
    fits: lines.length * lineHeightPx <= box.maxBlockHeightPx,
  };
}

/**
 * Resolve um `TextBlockBox` a partir do layout de um slot de template
 * (lib/instagram/templates.ts) e das dimensões reais do formato escolhido
 * — mesmas contas de drawTextSlots, reaproveitando `resolveFontSizePx` de
 * layout-math.ts em vez de duplicar a fórmula.
 */
export function resolveTextBlockBox(params: {
  maxWidthFrac: number;
  fontSizeFrac: number;
  fontWeight: "normal" | "bold";
  lineHeight: number;
  fontFamily: string;
  canvasWidth: number;
  canvasHeight: number;
}): TextBlockBox {
  const { canvasWidth, canvasHeight } = params;
  const preferredFontSizePx = resolveFontSizePx(params.fontSizeFrac, 1, canvasWidth, canvasHeight);
  // Piso absoluto de segurança (o mesmo que render.ts usa) — nunca é isto
  // sozinho que decide o piso de PLANEJAMENTO, ver comentário abaixo.
  const absoluteMinFontSizePx = Math.max(8, Math.round(Math.min(canvasWidth, canvasHeight) * TEXT_SLOT_MIN_FONT_SIZE_FRAC));
  // Piso de planejamento: o maior entre o piso absoluto e ~85% do tamanho
  // preferido do slot — evita empacotar um slide até o piso de segurança
  // só para economizar um slide; prefere abrir um slide novo antes disso
  // (TEXT_SLOT_GENERATED_MIN_SHRINK_RATIO, layout-math.ts).
  const minFontSizePx = Math.max(
    absoluteMinFontSizePx,
    Math.round(preferredFontSizePx * TEXT_SLOT_GENERATED_MIN_SHRINK_RATIO)
  );
  return {
    maxWidthPx: params.maxWidthFrac * canvasWidth,
    maxBlockHeightPx: canvasHeight * TEXT_SLOT_MAX_BLOCK_HEIGHT_FRAC,
    fontFamily: params.fontFamily,
    bold: params.fontWeight === "bold",
    preferredFontSizePx,
    minFontSizePx,
    lineHeight: params.lineHeight,
  };
}
