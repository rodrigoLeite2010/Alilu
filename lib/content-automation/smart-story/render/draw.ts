import type { RenderableImage, RenderingContext2DLike } from "@/lib/instagram/render";
import { computeCoverRect } from "@/lib/instagram/layout-math";
import type { StoryBackground } from "./backgrounds";
import { STORY_HEIGHT, STORY_WIDTH, type ColorToken, type DrawItem, type FillToken } from "./layout";

/** Contexto 2D mínimo (o do @napi-rs/canvas satisfaz) + o que o desenho do Story acrescenta. */
export interface StoryCanvasContext extends RenderingContext2DLike {
  lineCap: string;
}

export interface StoryDrawAssets {
  logo: RenderableImage | null;
  mascot: RenderableImage | null;
  /** Foto de fundo já carregada (fundos kind = IMAGE). */
  backgroundImage?: RenderableImage | null;
}

interface Palette {
  text: string;
  textSoft: string;
  accent: string;
  onAccent: string;
  card: string;
  accentSoft: string;
  border: string;
}

export function paletteFor(background: StoryBackground): Palette {
  if (background.textTone === "dark") {
    return {
      text: "#14202b",
      textSoft: "rgba(20, 32, 43, 0.78)",
      accent: background.accent,
      onAccent: "#ffffff",
      card: "rgba(255, 255, 255, 0.58)",
      accentSoft: "rgba(20, 32, 43, 0.08)",
      border: "rgba(20, 32, 43, 0.16)",
    };
  }
  return {
    text: "#ffffff",
    textSoft: "rgba(255, 255, 255, 0.84)",
    accent: background.accent,
    onAccent: "#14202b",
    card: "rgba(255, 255, 255, 0.13)",
    accentSoft: "rgba(255, 255, 255, 0.2)",
    border: "rgba(255, 255, 255, 0.3)",
  };
}

function roundRectPath(ctx: StoryCanvasContext, x: number, y: number, w: number, h: number, radius: number): void {
  const r = Math.max(0, Math.min(radius, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

export function drawBackground(ctx: StoryCanvasContext, background: StoryBackground, backgroundImage?: RenderableImage | null): void {
  ctx.clearRect(0, 0, STORY_WIDTH, STORY_HEIGHT);
  if (background.kind === "IMAGE" && backgroundImage) {
    const cover = computeCoverRect(STORY_WIDTH, STORY_HEIGHT, backgroundImage.naturalWidth, backgroundImage.naturalHeight, 0.5, 0.5, 1);
    ctx.drawImage(backgroundImage, cover.sx, cover.sy, cover.sWidth, cover.sHeight, 0, 0, STORY_WIDTH, STORY_HEIGHT);
    // Véu para o texto continuar legível sobre qualquer foto.
    ctx.fillStyle = background.textTone === "dark" ? "rgba(255, 255, 255, 0.45)" : "rgba(0, 0, 0, 0.45)";
    ctx.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);
    return;
  }
  const gradient = ctx.createLinearGradient(STORY_WIDTH * 0.1, 0, STORY_WIDTH * 0.9, STORY_HEIGHT);
  const stops = background.stops.length > 0 ? background.stops : [{ at: 0, color: "#1f2933" }];
  for (const stop of stops) gradient.addColorStop(stop.at, stop.color);
  if (stops.length === 1) gradient.addColorStop(1, stops[0].color);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);

  // Dois círculos suaves de luz (profundidade), sempre nas mesmas posições.
  ctx.save();
  ctx.globalAlpha = background.textTone === "dark" ? 0.18 : 0.1;
  ctx.fillStyle = background.accent;
  ctx.beginPath();
  ctx.arc(STORY_WIDTH * 0.92, STORY_HEIGHT * 0.12, 360, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(STORY_WIDTH * 0.04, STORY_HEIGHT * 0.86, 440, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function color(palette: Palette, token: ColorToken): string {
  return palette[token];
}

function fill(palette: Palette, token: FillToken): string {
  return token === "accent" ? palette.accent : token === "accentSoft" ? palette.accentSoft : palette.card;
}

export function drawItems(ctx: StoryCanvasContext, items: DrawItem[], palette: Palette, assets: StoryDrawAssets): { mascotDrawn: boolean } {
  let mascotDrawn = false;
  for (const item of items) {
    ctx.save();
    switch (item.kind) {
      case "roundRect": {
        roundRectPath(ctx, item.x, item.y, item.w, item.h, item.r);
        if (item.fill) {
          ctx.fillStyle = fill(palette, item.fill);
          ctx.fill();
        }
        if (item.stroke) {
          ctx.strokeStyle = item.stroke === "accent" ? palette.accent : palette.border;
          ctx.lineWidth = item.strokeWidth;
          ctx.stroke();
        }
        break;
      }
      case "line": {
        roundRectPath(ctx, item.x1, item.y - item.thickness / 2, item.x2 - item.x1, item.thickness, item.thickness / 2);
        ctx.fillStyle = palette.accent;
        ctx.fill();
        break;
      }
      case "checkbox": {
        roundRectPath(ctx, item.x, item.y, item.size, item.size, 16);
        ctx.fillStyle = palette.accent;
        ctx.fill();
        ctx.strokeStyle = palette.onAccent;
        ctx.lineWidth = 7;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(item.x + item.size * 0.26, item.y + item.size * 0.52);
        ctx.lineTo(item.x + item.size * 0.43, item.y + item.size * 0.7);
        ctx.lineTo(item.x + item.size * 0.76, item.y + item.size * 0.32);
        ctx.stroke();
        break;
      }
      case "text": {
        ctx.font = `${item.bold ? "bold " : ""}${item.fontPx}px ${item.family}`;
        ctx.textAlign = item.align;
        ctx.textBaseline = "middle";
        ctx.fillStyle = color(palette, item.color);
        ctx.fillText(item.text, item.x, item.y);
        break;
      }
      case "image": {
        const image = item.asset === "logo" ? assets.logo : assets.mascot;
        if (image) {
          if (item.asset === "logo") {
            // O ícone é azul-petróleo: num chip branco ele aparece em qualquer fundo (escuro ou claro).
            const pad = item.w * 0.16;
            roundRectPath(ctx, item.x - pad, item.y - pad, item.w + pad * 2, item.h + pad * 2, (item.w + pad * 2) * 0.28);
            ctx.fillStyle = "rgba(255, 255, 255, 0.96)";
            ctx.fill();
          }
          ctx.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight, item.x, item.y, item.w, item.h);
          if (item.asset === "mascot") mascotDrawn = true;
        }
        break;
      }
    }
    ctx.restore();
  }
  return { mascotDrawn };
}
