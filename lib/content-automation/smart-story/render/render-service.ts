import "server-only";
import fs from "node:fs";
import path from "node:path";
import { createCanvas, GlobalFonts, loadImage } from "@napi-rs/canvas";
import type { RenderableImage } from "@/lib/instagram/render";
import { storeGeneratedAutomationJpeg } from "@/lib/instagram/backend/template-render-service";
import { brandHasLogo, brandHasMascot, NONE_BRAND, type StoryBrand } from "../brand";
import type { StoryContent } from "../types";
import type { StoryBackground } from "./backgrounds";
import { drawBackground, drawItems, paletteFor, type StoryCanvasContext } from "./draw";
import { FONT_SANS, FONT_SERIF, STORY_HEIGHT, STORY_WIDTH, layoutStory, type StoryMeasurer } from "./layout";
import type { StoryTemplateId } from "./templates";

/**
 * Renderização server-side dos Stories inteligentes. Usa o MESMO canvas
 * (@napi-rs/canvas), o MESMO formato (1080×1920 JPEG q92) e a MESMA
 * fonte-base embutida do motor de arte do Piloto Automático; a gravação em
 * Vercel Blob + instagram_media é a função compartilhada
 * `storeGeneratedAutomationJpeg` (template-render-service) — nenhum
 * storage novo.
 */

export const SMART_STORY_RENDER_VERSION = "smart-story-v1";
export const SMART_STORY_JPEG_QUALITY = 92;

const ASSETS_DIR = path.join(process.cwd(), "lib/content-automation/smart-story/assets");
const SERIF_FILES = [
  path.join(process.cwd(), "lib/instagram/backend/fonts/DejaVuSerif.ttf"),
  path.join(process.cwd(), "lib/instagram/backend/fonts/DejaVuSerif-Bold.ttf"),
];
const SANS_FILES = [path.join(ASSETS_DIR, "fonts/DejaVuSans.ttf"), path.join(ASSETS_DIR, "fonts/DejaVuSans-Bold.ttf")];
export const LOGO_PATH = path.join(ASSETS_DIR, "logo.png");
/** Opcional: se o arquivo não existir, o mascote simplesmente não é desenhado (nada quebra). */
export const MASCOT_PATH = path.join(ASSETS_DIR, "mascot.png");

let fontsRegistered = false;
function ensureFonts(): void {
  if (fontsRegistered) return;
  fontsRegistered = true;
  for (const [files, family] of [
    [SERIF_FILES, FONT_SERIF],
    [SANS_FILES, FONT_SANS],
  ] as const) {
    const name = family.replace(/"/g, "");
    for (const file of files) {
      if (!GlobalFonts.registerFromPath(file, name)) {
        console.error("[smart-story-render] falha ao registrar fonte", { file });
      }
    }
  }
}

const IMAGE_CACHE_LIMIT = 24;
const imageCache = new Map<string, Promise<RenderableImage | null>>();
function remember(key: string, promise: Promise<RenderableImage | null>): Promise<RenderableImage | null> {
  if (imageCache.size >= IMAGE_CACHE_LIMIT) {
    const oldest = imageCache.keys().next().value;
    if (oldest !== undefined) imageCache.delete(oldest);
  }
  imageCache.set(key, promise);
  return promise;
}

function loadAsset(file: string): Promise<RenderableImage | null> {
  const cached = imageCache.get(file);
  if (cached) return cached;
  return remember(
    file,
    fs.existsSync(file)
      ? loadImage(file).then(
          (image) => image as unknown as RenderableImage,
          () => null,
        )
      : Promise.resolve(null),
  );
}

/** Imagem do próprio usuário (Vercel Blob). Qualquer outra origem é ignorada: nunca buscamos URL arbitrária. */
function loadRemoteAsset(url: string): Promise<RenderableImage | null> {
  const cached = imageCache.get(url);
  if (cached) return cached;
  let host = "";
  try {
    const parsed = new URL(url);
    host = parsed.protocol === "https:" ? parsed.hostname : "";
  } catch {
    host = "";
  }
  if (!host.endsWith(".blob.vercel-storage.com")) return Promise.resolve(null);
  return remember(
    url,
    loadImage(url).then(
      (image) => image as unknown as RenderableImage,
      () => null,
    ),
  );
}

/** Logo da marca: Alilu → arquivo embutido; usuário → o dele; sem marca → nenhum (null). */
function loadBrandLogo(brand: StoryBrand): Promise<RenderableImage | null> {
  if (!brandHasLogo(brand)) return Promise.resolve(null);
  return brand.kind === "ALILU" ? loadAsset(LOGO_PATH) : brand.logoUrl ? loadRemoteAsset(brand.logoUrl) : Promise.resolve(null);
}

function loadBrandMascot(brand: StoryBrand): Promise<RenderableImage | null> {
  if (!brandHasMascot(brand)) return Promise.resolve(null);
  return brand.kind === "ALILU" ? loadAsset(MASCOT_PATH) : brand.mascotUrl ? loadRemoteAsset(brand.mascotUrl) : Promise.resolve(null);
}

/** O PNG do mascote existe neste ambiente? */
export function isMascotAvailable(): boolean {
  return fs.existsSync(MASCOT_PATH);
}

export interface RenderSmartStoryInput {
  content: StoryContent;
  background: StoryBackground;
  /** Logo e/ou @ da marca discretos no rodapé (só os que a marca tem). */
  showBrand: boolean;
  /** Identidade do usuário (padrão: nenhuma — nada do Alilu para quem não é o Alilu). */
  brand?: StoryBrand;
  /** O plano pediu o mascote (só é desenhado se o PNG existir). */
  useMascot: boolean;
}

export interface RenderedSmartStory {
  buffer: Buffer;
  contentType: "image/jpeg";
  templateId: StoryTemplateId;
  backgroundId: string;
  /** O mascote realmente apareceu na arte (false se o PNG não existe). */
  mascotDrawn: boolean;
  warnings: string[];
  width: number;
  height: number;
  renderVersion: string;
}

export class SmartStoryRenderError extends Error {}

/**
 * Desenha o Story e devolve só os bytes — sem subir nada, sem gravar no
 * banco. Geração real e prévia ("Gerar exemplo") chamam ESTA função, então
 * a prévia nunca diverge do Story publicado.
 */
export async function renderSmartStoryBuffer(input: RenderSmartStoryInput): Promise<RenderedSmartStory> {
  ensureFonts();
  const brand = input.brand ?? NONE_BRAND;
  const [logo, mascot] = await Promise.all([loadBrandLogo(brand), input.useMascot ? loadBrandMascot(brand) : Promise.resolve(null)]);

  let backgroundImage: RenderableImage | null = null;
  if (input.background.kind === "IMAGE") {
    if (!input.background.url) throw new SmartStoryRenderError("Fundo de imagem sem URL.");
    try {
      backgroundImage = (await loadImage(input.background.url)) as unknown as RenderableImage;
    } catch (error) {
      throw new SmartStoryRenderError(`Não foi possível carregar o fundo do Story: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const canvas = createCanvas(STORY_WIDTH, STORY_HEIGHT);
  const ctx = canvas.getContext("2d") as unknown as StoryCanvasContext;
  const layout = layoutStory(input.content, ctx as unknown as StoryMeasurer, {
    showBrand: input.showBrand,
    brandHandle: brand.handle,
    hasLogo: logo !== null,
    mascot: input.useMascot && mascot !== null,
  });

  drawBackground(ctx, input.background, backgroundImage);
  const { mascotDrawn } = drawItems(ctx, layout.items, paletteFor(input.background, brand), { logo, mascot });

  return {
    buffer: canvas.toBuffer("image/jpeg", SMART_STORY_JPEG_QUALITY),
    contentType: "image/jpeg",
    templateId: layout.templateId,
    backgroundId: input.background.id,
    mascotDrawn,
    warnings: layout.warnings,
    width: STORY_WIDTH,
    height: STORY_HEIGHT,
    renderVersion: SMART_STORY_RENDER_VERSION,
  };
}

export interface StoreSmartStoryInput extends RenderSmartStoryInput {
  userId: string;
  automationRunId: string | null;
}

export interface StoredSmartStory extends RenderedSmartStory {
  mediaId: string;
  imageUrl: string;
}

/**
 * Renderiza e grava (Vercel Blob + instagram_media). Devolve o `mediaId`
 * pronto para `createDraftStoryPost` (o fluxo de publicação atual).
 */
export async function renderAndStoreSmartStory(input: StoreSmartStoryInput): Promise<StoredSmartStory> {
  const rendered = await renderSmartStoryBuffer(input);
  const stored = await storeGeneratedAutomationJpeg({
    userId: input.userId,
    buffer: rendered.buffer,
    sourceMediaId: null,
    automationRunId: input.automationRunId,
  });
  console.info("[smart-story-render] story renderizado", {
    userId: input.userId,
    automationRunId: input.automationRunId,
    templateId: rendered.templateId,
    backgroundId: rendered.backgroundId,
    mascotDrawn: rendered.mascotDrawn,
    fileSizeBytes: rendered.buffer.byteLength,
    warnings: rendered.warnings.length,
    renderVersion: rendered.renderVersion,
  });
  return { ...rendered, mediaId: stored.mediaId, imageUrl: stored.url };
}
