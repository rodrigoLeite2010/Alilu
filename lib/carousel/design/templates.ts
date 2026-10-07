/**
 * Templates visuais do Carrossel Inteligente — identidade ALILU (originais,
 * sem copiar modelos de terceiros). Só dados e funções puras de cor: o
 * layout (layout.ts) e o desenho (render) leem daqui.
 */

export const CAROUSEL_WIDTH = 1080;
export const CAROUSEL_HEIGHT = 1350;

export type CarouselTone = "light" | "dark";
export type CarouselDecor = "none" | "bar" | "circles" | "frame";

export interface CarouselTemplate {
  id: string;
  name: string;
  description: string;
  /** Cores do degradê de fundo (1 = sólido). */
  background: readonly string[];
  /** Tom do TEXTO: "light" = texto claro (fundo escuro). */
  tone: CarouselTone;
  text: string;
  textSoft: string;
  accent: string;
  onAccent: string;
  headlineFont: "serif" | "sans";
  align: "left" | "center";
  decor: CarouselDecor;
}

export const CAROUSEL_TEMPLATES: readonly CarouselTemplate[] = [
  {
    id: "alilu-petroleo",
    name: "Petróleo",
    description: "Fundo azul-petróleo profundo, destaque âmbar.",
    background: ["#0b3a4a", "#0e5163"],
    tone: "light",
    text: "#ffffff",
    textSoft: "rgba(255,255,255,0.82)",
    accent: "#f2b134",
    onAccent: "#10242c",
    headlineFont: "sans",
    align: "left",
    decor: "circles",
  },
  {
    id: "alilu-areia",
    name: "Areia",
    description: "Fundo claro e quente, destaque terracota.",
    background: ["#f6efe4", "#efe4d2"],
    tone: "dark",
    text: "#2b2118",
    textSoft: "rgba(43,33,24,0.78)",
    accent: "#c4572f",
    onAccent: "#ffffff",
    headlineFont: "serif",
    align: "left",
    decor: "bar",
  },
  {
    id: "alilu-noite",
    name: "Noite",
    description: "Fundo quase preto, destaque violeta vivo.",
    background: ["#14121f", "#201c36"],
    tone: "light",
    text: "#f5f3ff",
    textSoft: "rgba(245,243,255,0.8)",
    accent: "#9d7bff",
    onAccent: "#120d26",
    headlineFont: "sans",
    align: "left",
    decor: "circles",
  },
  {
    id: "alilu-menta",
    name: "Menta",
    description: "Fundo menta suave, destaque verde-floresta.",
    background: ["#e4f5ec", "#d3eddf"],
    tone: "dark",
    text: "#10281e",
    textSoft: "rgba(16,40,30,0.78)",
    accent: "#1d8a5b",
    onAccent: "#ffffff",
    headlineFont: "sans",
    align: "center",
    decor: "bar",
  },
  {
    id: "alilu-solar",
    name: "Solar",
    description: "Fundo amarelo-sol, texto escuro de alto contraste.",
    background: ["#ffd23f", "#ffc21a"],
    tone: "dark",
    text: "#1d1a10",
    textSoft: "rgba(29,26,16,0.8)",
    accent: "#1d1a10",
    onAccent: "#ffd23f",
    headlineFont: "sans",
    align: "left",
    decor: "none",
  },
  {
    id: "alilu-editorial",
    name: "Editorial",
    description: "Fundo branco, serifa grande e moldura fina.",
    background: ["#ffffff"],
    tone: "dark",
    text: "#141414",
    textSoft: "rgba(20,20,20,0.75)",
    accent: "#141414",
    onAccent: "#ffffff",
    headlineFont: "serif",
    align: "center",
    decor: "frame",
  },
];

export const DEFAULT_CAROUSEL_TEMPLATE_ID = "alilu-petroleo";

export function getCarouselTemplate(id: string | null | undefined): CarouselTemplate {
  return CAROUSEL_TEMPLATES.find((template) => template.id === id) ?? CAROUSEL_TEMPLATES[0];
}

export function isCarouselTemplateId(value: unknown): value is string {
  return typeof value === "string" && CAROUSEL_TEMPLATES.some((template) => template.id === value);
}

// ---------------------------------------------------------------------------
// Cor
// ---------------------------------------------------------------------------
export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

export function relativeLuminance(hex: string): number {
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** Cor de texto legível (preto/branco) sobre um fundo. */
export function readableOn(background: string): string {
  return contrastRatio("#ffffff", background) >= 4 ? "#ffffff" : "#111111";
}

export interface ResolvedPalette {
  text: string;
  textSoft: string;
  accent: string;
  onAccent: string;
  background: readonly string[];
  tone: CarouselTone;
}

/**
 * Paleta final do slide. A cor de destaque da marca só vale com contraste
 * mínimo (3:1) contra o fundo — senão mantém a do template (a arte nunca
 * fica ilegível por uma cor mal escolhida). Com foto, o texto é sempre
 * claro (a foto recebe um véu escuro).
 */
export function resolvePalette(template: CarouselTemplate, options: { brandAccent?: string | null; hasPhoto?: boolean }): ResolvedPalette {
  const base = options.hasPhoto
    ? { text: "#ffffff", textSoft: "rgba(255,255,255,0.86)", tone: "light" as const, background: template.background }
    : { text: template.text, textSoft: template.textSoft, tone: template.tone, background: template.background };
  const probe = options.hasPhoto ? "#1a1a1a" : template.background[0];
  const brand = options.brandAccent && isHexColor(options.brandAccent) ? options.brandAccent : null;
  const accent = brand && contrastRatio(brand, probe) >= 3 ? brand : options.hasPhoto && contrastRatio(template.accent, probe) < 3 ? "#f2b134" : template.accent;
  return { ...base, accent, onAccent: readableOn(accent) };
}
