import "server-only";

/**
 * Banco de fotos do Carrossel Inteligente. Interface única: hoje a
 * implementações são o Pexels e o Pixabay (licenças gratuitas para uso
 * comercial, sem obrigação de crédito); trocar de provedor não toca no resto.
 * Usa o Pexels se PEXELS_API_KEY existir; senão o Pixabay (PIXABAY_API_KEY).
 */

export interface StockPhoto {
  provider: string;
  id: string;
  /** Imagem em boa resolução para o fundo do slide. */
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
  author: string;
  authorUrl: string | null;
  /** Página da foto no provedor (crédito/consulta). */
  sourceUrl: string | null;
}

export interface PhotoProvider {
  readonly id: string;
  search(query: string, options?: { limit?: number }): Promise<StockPhoto[]>;
}

/** Hosts de imagem aceitos como fundo (nunca buscamos URL arbitrária). */
const ALLOWED_PHOTO_HOSTS = ["images.pexels.com", "cdn.pixabay.com"];

export function isAllowedPhotoUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ALLOWED_PHOTO_HOSTS.includes(url.hostname);
  } catch {
    return false;
  }
}

export function normalizePhotoQuery(raw: string): string {
  return raw.replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

export class PexelsPhotoProvider implements PhotoProvider {
  readonly id = "pexels";
  constructor(private readonly apiKey: string) {}

  async search(query: string, options: { limit?: number } = {}): Promise<StockPhoto[]> {
    const clean = normalizePhotoQuery(query);
    if (!clean) return [];
    const url = new URL("https://api.pexels.com/v1/search");
    url.searchParams.set("query", clean);
    url.searchParams.set("per_page", String(Math.min(Math.max(options.limit ?? 8, 1), 20)));
    url.searchParams.set("orientation", "portrait");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(url, { headers: { Authorization: this.apiKey }, signal: controller.signal });
      if (!response.ok) return [];
      const data = (await response.json()) as { photos?: Array<Record<string, unknown>> };
      return parsePexelsPhotos(data);
    } catch {
      return [];
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function parsePexelsPhotos(data: { photos?: Array<Record<string, unknown>> }): StockPhoto[] {
  const out: StockPhoto[] = [];
  for (const photo of data.photos ?? []) {
    const src = (photo.src ?? {}) as Record<string, unknown>;
    const full = typeof src.large2x === "string" ? src.large2x : typeof src.large === "string" ? src.large : null;
    const thumb = typeof src.medium === "string" ? src.medium : full;
    if (!full || !thumb || !isAllowedPhotoUrl(full) || !isAllowedPhotoUrl(thumb)) continue;
    out.push({
      provider: "pexels",
      id: String(photo.id),
      url: full,
      thumbUrl: thumb,
      width: Number(photo.width) || 0,
      height: Number(photo.height) || 0,
      author: typeof photo.photographer === "string" ? photo.photographer : "Pexels",
      authorUrl: typeof photo.photographer_url === "string" ? photo.photographer_url : null,
      sourceUrl: typeof photo.url === "string" ? photo.url : null,
    });
  }
  return out;
}

export class PixabayPhotoProvider implements PhotoProvider {
  readonly id = "pixabay";
  constructor(private readonly apiKey: string) {}

  async search(query: string, options: { limit?: number } = {}): Promise<StockPhoto[]> {
    const clean = normalizePhotoQuery(query);
    if (!clean) return [];
    const url = new URL("https://pixabay.com/api/");
    url.searchParams.set("key", this.apiKey);
    url.searchParams.set("q", clean);
    url.searchParams.set("image_type", "photo");
    url.searchParams.set("orientation", "vertical");
    url.searchParams.set("safesearch", "true");
    url.searchParams.set("lang", "pt");
    url.searchParams.set("per_page", String(Math.min(Math.max(options.limit ?? 8, 3), 20)));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) return [];
      return parsePixabayPhotos((await response.json()) as { hits?: Array<Record<string, unknown>> });
    } catch {
      return [];
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function parsePixabayPhotos(data: { hits?: Array<Record<string, unknown>> }): StockPhoto[] {
  const out: StockPhoto[] = [];
  for (const hit of data.hits ?? []) {
    const full = typeof hit.largeImageURL === "string" ? hit.largeImageURL : null;
    const thumb = typeof hit.webformatURL === "string" ? hit.webformatURL : full;
    if (!full || !thumb || !isAllowedPhotoUrl(full) || !isAllowedPhotoUrl(thumb)) continue;
    out.push({
      provider: "pixabay",
      id: String(hit.id),
      url: full,
      thumbUrl: thumb,
      width: Number(hit.imageWidth) || 0,
      height: Number(hit.imageHeight) || 0,
      author: typeof hit.user === "string" ? hit.user : "Pixabay",
      authorUrl: typeof hit.user === "string" && hit.user_id ? `https://pixabay.com/users/${encodeURIComponent(hit.user)}-${String(hit.user_id)}/` : null,
      sourceUrl: typeof hit.pageURL === "string" ? hit.pageURL : null,
    });
  }
  return out;
}

/** null = banco de fotos não configurado (nem PEXELS_API_KEY nem PIXABAY_API_KEY). */
export function createPhotoProviderFromEnv(): PhotoProvider | null {
  if (process.env.PEXELS_API_KEY) return new PexelsPhotoProvider(process.env.PEXELS_API_KEY);
  if (process.env.PIXABAY_API_KEY) return new PixabayPhotoProvider(process.env.PIXABAY_API_KEY);
  return null;
}
