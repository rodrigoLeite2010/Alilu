/**
 * Identidade visual de UM usuário nos Stories inteligentes.
 *
 * Regra de ouro (multi-usuário): a marca Alilu (logo, mascote, @alilu.tec,
 * alilu.com.br) pertence SÓ à conta do próprio Alilu. Qualquer outra conta
 * começa em NONE — sem logo, sem @, sem mascote, sem CTA de marca — e só
 * ganha esses elementos quando preenche a própria identidade.
 */
export type StoryBrandKind = "ALILU" | "CUSTOM" | "NONE";

export interface StoryBrand {
  kind: StoryBrandKind;
  /** Nome exibido nos textos ("Studio Ana"). Nunca desenhado na arte. */
  name: string | null;
  /** "@usuario" (com arroba) ou null. */
  handle: string | null;
  /** "meusite.com.br" (sem protocolo) ou null. */
  site: string | null;
  /** "#rrggbb" ou null (usa a cor do fundo). */
  accentColor: string | null;
  /** URL pública do logo (CUSTOM). ALILU usa o arquivo embutido. */
  logoUrl: string | null;
  /** URL pública do mascote (CUSTOM). ALILU usa o arquivo embutido. */
  mascotUrl: string | null;
}

export const NONE_BRAND: StoryBrand = {
  kind: "NONE",
  name: null,
  handle: null,
  site: null,
  accentColor: null,
  logoUrl: null,
  mascotUrl: null,
};

/** Identidade do próprio Alilu — só é usada para contas de administrador. */
export const ALILU_BRAND_IDENTITY: StoryBrand = {
  kind: "ALILU",
  name: "Alilu",
  handle: "@alilu.tec",
  site: "alilu.com.br",
  accentColor: null,
  logoUrl: null,
  mascotUrl: null,
};

/** A marca tem logo para desenhar (ALILU: arquivo embutido; CUSTOM: o enviado)? */
export function brandHasLogo(brand: StoryBrand): boolean {
  return brand.kind === "ALILU" || (brand.kind === "CUSTOM" && Boolean(brand.logoUrl));
}

export function brandHasMascot(brand: StoryBrand): boolean {
  return brand.kind === "ALILU" || (brand.kind === "CUSTOM" && Boolean(brand.mascotUrl));
}

/** Há algo de marca para mostrar no rodapé (logo ou @)? */
export function brandHasIdentity(brand: StoryBrand): boolean {
  return Boolean(brand.handle) || brandHasLogo(brand);
}

/**
 * A marca consegue "convidar" (CTA de visita/seguir, tipo Marca/Convite)?
 * Precisa de @ ou site próprio — sem isso o convite não teria para onde levar.
 */
export function brandCanPromote(brand: StoryBrand): boolean {
  return Boolean(brand.handle) || Boolean(brand.site);
}

/** Nome para falar da marca nos textos: nome → @ → site → null. */
export function brandDisplayName(brand: StoryBrand): string | null {
  return brand.name ?? brand.handle ?? brand.site;
}

export function normalizeHandle(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().replace(/^@+/, "").toLowerCase();
  if (!value) return null;
  // Regras do Instagram: letras, números, ponto e sublinhado; até 30.
  if (!/^[a-z0-9._]{1,30}$/.test(value)) return null;
  return `@${value}`;
}

export function normalizeSite(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");
  if (!value || value.length > 60) return null;
  if (!/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(\/[a-z0-9._~\-/]*)?$/.test(value)) return null;
  return value;
}

export function normalizeBrandName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.replace(/\s+/g, " ").trim().slice(0, 40);
  return value || null;
}

export function normalizeAccentColor(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(value) ? value : null;
}

function luminance(hex: string): number {
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/**
 * Cor de destaque da arte: a do usuário só vale se tiver contraste mínimo
 * com o texto do fundo (texto claro → destaque não pode ser escuro demais,
 * e vice-versa). Caso contrário, mantém a cor do próprio fundo — a arte
 * nunca fica ilegível por causa de uma cor mal escolhida.
 */
export function accentFor(brand: StoryBrand, textTone: "light" | "dark", backgroundAccent: string): string {
  const custom = brand.kind === "CUSTOM" ? brand.accentColor : null;
  if (!custom) return backgroundAccent;
  const lum = luminance(custom);
  if (textTone === "light" && lum < 0.2) return backgroundAccent;
  if (textTone === "dark" && lum > 0.35) return backgroundAccent;
  return custom;
}

/** Constantes e DTO compartilhados com a tela (sem segredos, sem banco). */
export const STORY_BRAND_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const STORY_BRAND_CONTENT_TYPES = ["image/png", "image/jpeg", "image/webp"];

export function storyBrandUploadPrefix(userId: string): string {
  return `smart-story-brand/${userId}/`;
}

export interface StoryBrandProfileDto {
  brandName: string | null;
  handle: string | null;
  site: string | null;
  accentColor: string | null;
  logoUrl: string | null;
  mascotUrl: string | null;
  /** Identidade efetiva nos Stories: ALILU (conta do Alilu sem perfil), CUSTOM ou NONE. */
  effectiveKind: StoryBrandKind;
}
