import "server-only";
import { del as deleteBlob, put } from "@vercel/blob";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { isAdminEmail } from "@/lib/admin/admin-email";
import {
  ALILU_BRAND_IDENTITY,
  NONE_BRAND,
  normalizeAccentColor,
  normalizeBrandName,
  normalizeHandle,
  normalizeSite,
  STORY_BRAND_CONTENT_TYPES,
  STORY_BRAND_MAX_UPLOAD_BYTES,
  storyBrandUploadPrefix,
  type StoryBrand,
  type StoryBrandProfileDto,
} from "../smart-story/brand";
import {
  getBrandProfile,
  getUserEmail,
  setBrandAsset,
  upsertBrandTexts,
  type StoryBrandProfile,
} from "./smart-story-brand-repository";

export { STORY_BRAND_CONTENT_TYPES, STORY_BRAND_MAX_UPLOAD_BYTES, storyBrandUploadPrefix };
export const STORY_BRAND_MAX_SIDE = 800;
export const STORY_BRAND_MIN_SIDE = 64;

export class StoryBrandValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoryBrandValidationError";
  }
}

function profileHasAnything(profile: StoryBrandProfile | null): profile is StoryBrandProfile {
  return Boolean(profile && (profile.brandName || profile.handle || profile.site || profile.logoUrl || profile.mascotUrl || profile.accentColor));
}

function brandFromProfile(profile: StoryBrandProfile): StoryBrand {
  return {
    kind: "CUSTOM",
    name: profile.brandName,
    handle: profile.handle,
    site: profile.site,
    accentColor: profile.accentColor,
    logoUrl: profile.logoUrl,
    mascotUrl: profile.mascotUrl,
  };
}

/**
 * Identidade de marca EFETIVA do usuário nos Stories inteligentes:
 *   - perfil preenchido → CUSTOM (só o que ele cadastrou);
 *   - sem perfil e conta de administrador do Alilu → identidade Alilu;
 *   - qualquer outro caso → NONE (nada de Alilu, nada de marca).
 * Falha de banco NUNCA derruba o Story: cai em NONE (e o admin, em Alilu).
 */
export async function resolveStoryBrand(userId: string): Promise<StoryBrand> {
  try {
    const profile = await getBrandProfile(userId);
    if (profileHasAnything(profile)) return brandFromProfile(profile);
    return isAdminEmail(await getUserEmail(userId)) ? ALILU_BRAND_IDENTITY : NONE_BRAND;
  } catch (error) {
    console.error("[smart-story-brand] falha ao resolver a marca; usando sem marca", { userId, message: error instanceof Error ? error.message : String(error) });
    return NONE_BRAND;
  }
}

export async function getStoryBrandDto(userId: string): Promise<StoryBrandProfileDto> {
  const [profile, brand] = await Promise.all([getBrandProfile(userId), resolveStoryBrand(userId)]);
  return {
    brandName: profile?.brandName ?? null,
    handle: profile?.handle ?? null,
    site: profile?.site ?? null,
    accentColor: profile?.accentColor ?? null,
    logoUrl: profile?.logoUrl ?? null,
    mascotUrl: profile?.mascotUrl ?? null,
    effectiveKind: brand.kind,
  };
}

function textInput(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Valida tudo no servidor: campo preenchido porém inválido é erro (nunca vira silenciosamente vazio). */
export async function saveStoryBrandTexts(userId: string, input: Record<string, unknown>): Promise<StoryBrandProfileDto> {
  const problems: string[] = [];
  const handleRaw = textInput(input.handle);
  const siteRaw = textInput(input.site);
  const colorRaw = textInput(input.accentColor);
  const handle = normalizeHandle(handleRaw);
  const site = normalizeSite(siteRaw);
  const accentColor = normalizeAccentColor(colorRaw);
  if (handleRaw && !handle) problems.push("O @ do Instagram deve ter só letras, números, ponto e sublinhado (até 30).");
  if (siteRaw && !site) problems.push("Informe o site no formato meusite.com.br.");
  if (colorRaw && !accentColor) problems.push("A cor de destaque deve estar no formato #rrggbb.");
  if (problems.length > 0) throw new StoryBrandValidationError(problems.join(" "));
  await upsertBrandTexts(userId, { brandName: normalizeBrandName(input.brandName), handle, site, accentColor });
  return getStoryBrandDto(userId);
}

function storageKeyFromUrl(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
  } catch {
    return "";
  }
}

/** Só aceita arquivo que ESTE usuário acabou de enviar para o prefixo dele no Blob. */
export function assertOwnBrandUpload(userId: string, url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new StoryBrandValidationError("Arquivo inválido.");
  }
  const key = storageKeyFromUrl(url);
  if (parsed.protocol !== "https:" || !parsed.hostname.endsWith(".blob.vercel-storage.com") || !key.startsWith(storyBrandUploadPrefix(userId)) || key.includes("..")) {
    throw new StoryBrandValidationError("Arquivo inválido.");
  }
}

function parseSlot(value: unknown): "LOGO" | "MASCOT" {
  if (value === "LOGO" || value === "MASCOT") return value;
  throw new StoryBrandValidationError("Escolha logo ou mascote.");
}

/**
 * Valida a imagem enviada (decodifica de verdade), reduz para no máximo
 * 800 px mantendo a transparência (PNG) e guarda no prefixo do usuário. O
 * original do upload direto é apagado e o arquivo anterior também.
 */
export async function saveStoryBrandAsset(userId: string, input: { slot: unknown; url: unknown }): Promise<StoryBrandProfileDto> {
  const slot = parseSlot(input.slot);
  const url = typeof input.url === "string" ? input.url : "";
  assertOwnBrandUpload(userId, url);

  const response = await fetch(url);
  if (!response.ok) throw new StoryBrandValidationError("Não foi possível ler o arquivo enviado.");
  const original = Buffer.from(await response.arrayBuffer());
  if (original.byteLength > STORY_BRAND_MAX_UPLOAD_BYTES) {
    await deleteBlob(url).catch(() => undefined);
    throw new StoryBrandValidationError("A imagem passa do limite de 5 MB.");
  }
  let image;
  try {
    image = await loadImage(original);
  } catch {
    await deleteBlob(url).catch(() => undefined);
    throw new StoryBrandValidationError("Não foi possível ler a imagem. Envie um PNG, JPG ou WebP.");
  }
  if (image.width < STORY_BRAND_MIN_SIDE || image.height < STORY_BRAND_MIN_SIDE) {
    await deleteBlob(url).catch(() => undefined);
    throw new StoryBrandValidationError(`A imagem é muito pequena (mínimo ${STORY_BRAND_MIN_SIDE} px de lado).`);
  }
  const scale = Math.min(1, STORY_BRAND_MAX_SIDE / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = createCanvas(width, height);
  canvas.getContext("2d").drawImage(image, 0, 0, width, height);
  const png = canvas.toBuffer("image/png");

  const previous = (await getBrandProfile(userId)) ?? null;
  const previousUrl = slot === "LOGO" ? previous?.logoUrl : previous?.mascotUrl;
  const stored = await put(`${storyBrandUploadPrefix(userId)}${slot.toLowerCase()}-final.png`, png, {
    access: "public",
    contentType: "image/png",
    addRandomSuffix: true,
  });
  await setBrandAsset(userId, slot, stored.url);
  await deleteBlob(url).catch(() => undefined);
  if (previousUrl && previousUrl !== stored.url) await deleteBlob(previousUrl).catch(() => undefined);
  return getStoryBrandDto(userId);
}

export async function removeStoryBrandAsset(userId: string, slotRaw: unknown): Promise<StoryBrandProfileDto> {
  const slot = parseSlot(slotRaw);
  const previous = await getBrandProfile(userId);
  const previousUrl = slot === "LOGO" ? previous?.logoUrl : previous?.mascotUrl;
  if (previous) await setBrandAsset(userId, slot, null);
  if (previousUrl) await deleteBlob(previousUrl).catch(() => undefined);
  return getStoryBrandDto(userId);
}
