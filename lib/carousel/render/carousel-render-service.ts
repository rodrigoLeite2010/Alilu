import "server-only";
import fs from "node:fs";
import path from "node:path";
import { createCanvas, GlobalFonts, loadImage } from "@napi-rs/canvas";
import { computeCoverRect } from "@/lib/instagram/layout-math";
import type { RenderableImage, RenderingContext2DLike } from "@/lib/instagram/render";
import type { TextMeasurer } from "@/lib/instagram/carousel/text-fit";
import { storeGeneratedAutomationJpeg } from "@/lib/instagram/backend/template-render-service";
import { isAllowedPhotoUrl } from "../photos/photo-provider";
import { layoutCarouselSlide, FONT_SANS, FONT_SERIF, type ColorRole, type DrawItem } from "../design/layout";
import { CAROUSEL_HEIGHT, CAROUSEL_WIDTH, getCarouselTemplate, resolvePalette, type CarouselTemplate } from "../design/templates";

/**
 * Renderização server-side dos slides (JPEG 1080×1350, q92) com o mesmo
 * canvas/fontes embutidas do Piloto Automático. Prévia e publicação usam
 * ESTA função, então o que o usuário vê é o que vai para o Instagram.
 */
export const CAROUSEL_RENDER_VERSION = "carousel-v1";
export const CAROUSEL_JPEG_QUALITY = 92;

const SERIF_FILES = [path.join(process.cwd(), "lib/instagram/backend/fonts/DejaVuSerif.ttf"), path.join(process.cwd(), "lib/instagram/backend/fonts/DejaVuSerif-Bold.ttf")];
const SANS_FILES = [
  path.join(process.cwd(), "lib/content-automation/smart-story/assets/fonts/DejaVuSans.ttf"),
  path.join(process.cwd(), "lib/content-automation/smart-story/assets/fonts/DejaVuSans-Bold.ttf"),
];
export const ALILU_LOGO_PATH = path.join(process.cwd(), "lib/content-automation/smart-story/assets/logo.png");

let fontsRegistered = false;
function ensureFonts(): void {
  if (fontsRegistered) return;
  fontsRegistered = true;
  for (const [files, family] of [
    [SERIF_FILES, FONT_SERIF],
    [SANS_FILES, FONT_SANS],
  ] as const) {
    for (const file of files) {
      if (!GlobalFonts.registerFromPath(file, family.replace(/"/g, ""))) console.error("[carousel-render] falha ao registrar fonte", { file });
    }
  }
}

export interface RenderSlideInput {
  position: number;
  total: number;
  headline: string;
  body: string;
  cta: string;
  templateId: string | null;
  /** Foto de fundo: URL do banco de fotos ou do Vercel Blob do próprio usuário. */
  photoUrl: string | null;
  align?: "left" | "center";
  brand: { handle: string | null; accentColor: string | null; logoUrl: string | null; useAliluLogo: boolean };
}

export interface RenderedSlide {
  buffer: Buffer;
  contentType: "image/jpeg";
  width: number;
  height: number;
  warnings: string[];
  /** A foto pedida não pôde ser carregada e o slide foi desenhado só com o fundo do template. */
  photoMissing: boolean;
  renderVersion: string;
}

function isUserBlobUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname.endsWith(".blob.vercel-storage.com");
  } catch {
    return false;
  }
}

async function loadPhoto(url: string): Promise<RenderableImage | null> {
  if (!isAllowedPhotoUrl(url) && !isUserBlobUrl(url)) return null;
  try {
    return (await loadImage(url)) as unknown as RenderableImage;
  } catch {
    return null;
  }
}

async function loadLogo(brand: RenderSlideInput["brand"]): Promise<RenderableImage | null> {
  try {
    if (brand.useAliluLogo && fs.existsSync(ALILU_LOGO_PATH)) return (await loadImage(ALILU_LOGO_PATH)) as unknown as RenderableImage;
    if (brand.logoUrl && isUserBlobUrl(brand.logoUrl)) return (await loadImage(brand.logoUrl)) as unknown as RenderableImage;
  } catch {
    // sem logo: o slide continua
  }
  return null;
}

function roundRectPath(ctx: RenderingContext2DLike, x: number, y: number, w: number, h: number, radius: number): void {
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

function drawBackground(ctx: RenderingContext2DLike, template: CarouselTemplate, accent: string, photo: RenderableImage | null): void {
  ctx.clearRect(0, 0, CAROUSEL_WIDTH, CAROUSEL_HEIGHT);
  if (photo) {
    const cover = computeCoverRect(CAROUSEL_WIDTH, CAROUSEL_HEIGHT, photo.naturalWidth, photo.naturalHeight, 0.5, 0.5, 1);
    ctx.drawImage(photo, cover.sx, cover.sy, cover.sWidth, cover.sHeight, 0, 0, CAROUSEL_WIDTH, CAROUSEL_HEIGHT);
    // Véu em degradê: mais forte embaixo, onde o texto fica ancorado.
    const scrim = ctx.createLinearGradient(0, 0, 0, CAROUSEL_HEIGHT);
    scrim.addColorStop(0, "rgba(0,0,0,0.38)");
    scrim.addColorStop(0.45, "rgba(0,0,0,0.5)");
    scrim.addColorStop(1, "rgba(0,0,0,0.82)");
    ctx.fillStyle = scrim;
    ctx.fillRect(0, 0, CAROUSEL_WIDTH, CAROUSEL_HEIGHT);
    return;
  }
  const stops = template.background;
  const gradient = ctx.createLinearGradient(0, 0, CAROUSEL_WIDTH * 0.6, CAROUSEL_HEIGHT);
  stops.forEach((color, index) => gradient.addColorStop(stops.length === 1 ? 0 : index / (stops.length - 1), color));
  if (stops.length === 1) gradient.addColorStop(1, stops[0]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CAROUSEL_WIDTH, CAROUSEL_HEIGHT);

  if (template.decor === "circles") {
    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(CAROUSEL_WIDTH * 0.95, CAROUSEL_HEIGHT * 0.1, 330, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(CAROUSEL_WIDTH * 0.02, CAROUSEL_HEIGHT * 0.9, 400, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (template.decor === "frame") {
    ctx.save();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    roundRectPath(ctx, 40, 40, CAROUSEL_WIDTH - 80, CAROUSEL_HEIGHT - 80, 6);
    ctx.stroke();
    ctx.restore();
  }
}

function drawItems(ctx: RenderingContext2DLike, items: DrawItem[], colors: Record<ColorRole, string>, logo: RenderableImage | null): void {
  for (const item of items) {
    ctx.save();
    if (item.kind === "text") {
      ctx.font = `${item.bold ? "bold " : ""}${item.fontPx}px ${item.family}`;
      ctx.textAlign = item.align;
      ctx.textBaseline = "middle";
      ctx.fillStyle = colors[item.color];
      ctx.fillText(item.text, item.x, item.y);
    } else if (item.kind === "roundRect") {
      roundRectPath(ctx, item.x, item.y, item.w, item.h, item.r);
      ctx.globalAlpha = item.alpha;
      if (item.fill) {
        ctx.fillStyle = colors[item.fill];
        ctx.fill();
      }
      if (item.stroke) {
        ctx.strokeStyle = colors[item.stroke];
        ctx.lineWidth = item.strokeWidth;
        ctx.stroke();
      }
    } else if (item.kind === "image" && logo) {
      const scale = Math.min(item.w / logo.naturalWidth, item.h / logo.naturalHeight);
      const dw = logo.naturalWidth * scale;
      const dh = logo.naturalHeight * scale;
      const pad = 8;
      roundRectPath(ctx, item.x - pad, item.y - pad, item.w + pad * 2, item.h + pad * 2, 16);
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.fill();
      ctx.drawImage(logo, 0, 0, logo.naturalWidth, logo.naturalHeight, item.x + (item.w - dw) / 2, item.y + (item.h - dh) / 2, dw, dh);
    }
    ctx.restore();
  }
}

export async function renderCarouselSlideBuffer(input: RenderSlideInput): Promise<RenderedSlide> {
  ensureFonts();
  const template = getCarouselTemplate(input.templateId);
  const [photo, logo] = await Promise.all([input.photoUrl ? loadPhoto(input.photoUrl) : Promise.resolve(null), loadLogo(input.brand)]);
  const palette = resolvePalette(template, { brandAccent: input.brand.accentColor, hasPhoto: photo !== null });

  const canvas = createCanvas(CAROUSEL_WIDTH, CAROUSEL_HEIGHT);
  const ctx = canvas.getContext("2d") as unknown as RenderingContext2DLike;
  const layout = layoutCarouselSlide(ctx as unknown as TextMeasurer, {
    position: input.position,
    total: input.total,
    headline: input.headline,
    body: input.body,
    cta: input.cta,
    template: photo ? { ...template, tone: "light" } : template,
    hasPhoto: photo !== null,
    handle: input.brand.handle,
    hasLogo: logo !== null,
    align: input.align,
  });

  drawBackground(ctx, template, palette.accent, photo);
  drawItems(ctx, layout.items, { text: palette.text, textSoft: palette.textSoft, accent: palette.accent, onAccent: palette.onAccent }, logo);

  return {
    buffer: canvas.toBuffer("image/jpeg", CAROUSEL_JPEG_QUALITY),
    contentType: "image/jpeg",
    width: CAROUSEL_WIDTH,
    height: CAROUSEL_HEIGHT,
    warnings: layout.warnings,
    photoMissing: Boolean(input.photoUrl) && photo === null,
    renderVersion: CAROUSEL_RENDER_VERSION,
  };
}

export async function renderAndStoreCarouselSlide(userId: string, input: RenderSlideInput): Promise<RenderedSlide & { mediaId: string; url: string }> {
  const rendered = await renderCarouselSlideBuffer(input);
  const stored = await storeGeneratedAutomationJpeg({ userId, buffer: rendered.buffer, sourceMediaId: null, automationRunId: null });
  return { ...rendered, mediaId: stored.mediaId, url: stored.url };
}
