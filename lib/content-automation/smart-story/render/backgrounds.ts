import { createRng } from "../random";
import { isVisualMood, type VisualMood } from "../types";

/**
 * Biblioteca de fundos de Story. Nasce 100% em código (gradientes), sem
 * nenhum asset externo nem direito de terceiros; o formato já aceita
 * fundos de IMAGEM (`kind: "IMAGE"` + `url`) para a biblioteca de fotos
 * (tabela própria) que virá depois.
 */
export interface StoryBackground {
  id: string;
  name: string;
  kind: "GRADIENT" | "IMAGE";
  /** Só IMAGE: URL pública (Vercel Blob). */
  url: string | null;
  /** Só GRADIENT: paradas do degradê, de cima-esquerda para baixo-direita. */
  stops: Array<{ at: number; color: string }>;
  /** Categoria = clima visual que o conteúdo pede (StoryContent.visualMood). */
  category: VisualMood;
  /** Sensação do fundo (descritivo; ajuda a curadoria). */
  mood: "calm" | "warm" | "energetic" | "serious" | "fresh" | "soft";
  /** Tom do TEXTO sobre este fundo: "light" = texto claro (fundo escuro), "dark" = texto escuro (fundo claro). */
  textTone: "light" | "dark";
  /** Cor de destaque (divisores, letras A/B, CTA) com bom contraste sobre o fundo. */
  accent: string;
  enabled: boolean;
}

function gradient(
  id: string,
  name: string,
  category: VisualMood,
  mood: StoryBackground["mood"],
  textTone: StoryBackground["textTone"],
  accent: string,
  colors: string[],
): StoryBackground {
  return {
    id,
    name,
    kind: "GRADIENT",
    url: null,
    stops: colors.map((color, index) => ({ at: colors.length === 1 ? 0 : index / (colors.length - 1), color })),
    category,
    mood,
    textTone,
    accent,
    enabled: true,
  };
}

export const STORY_BACKGROUNDS: StoryBackground[] = [
  gradient("emo-dusk", "Entardecer", "emotional", "warm", "light", "#ffb457", ["#3b1f4a", "#8a3b5c", "#e0725b"]),
  gradient("emo-rose", "Rosa profundo", "emotional", "soft", "light", "#ffc9a8", ["#4a1d3f", "#9c3d62"]),
  gradient("emo-night-blue", "Azul da noite", "emotional", "calm", "light", "#ffb457", ["#16254a", "#33437a", "#6a5aa0"]),
  gradient("mot-sunrise", "Amanhecer", "motivational", "energetic", "dark", "#c2410c", ["#ffe2a8", "#ffb27a", "#ff8a65"]),
  gradient("mot-teal", "Verde Alilu", "motivational", "fresh", "light", "#ffb94d", ["#0f4c5c", "#1b7f79", "#3fb59a"]),
  gradient("mot-gold", "Dourado", "motivational", "warm", "dark", "#7c2d12", ["#fff1c1", "#ffd36b", "#f5a53b"]),
  gradient("fin-forest", "Verde finanças", "finance", "serious", "light", "#ffd166", ["#0b3d2e", "#146c4f", "#2a9d6f"]),
  gradient("fin-navy", "Azul finanças", "finance", "serious", "light", "#ffd166", ["#0b2545", "#13407a", "#1f6fb2"]),
  gradient("tech-indigo", "Índigo tech", "technology", "energetic", "light", "#7ee0c3", ["#1a1446", "#2f2a8a", "#3e6bd6"]),
  gradient("tech-cyan", "Ciano tech", "technology", "fresh", "light", "#ffd166", ["#082f49", "#0e6a8a", "#19a7b8"]),
  gradient("neu-slate", "Grafite", "neutral", "calm", "light", "#ffb457", ["#1f2933", "#3e4c59", "#52606d"]),
  gradient("neu-sand", "Areia", "neutral", "soft", "dark", "#b45309", ["#f4ece1", "#e8d8c3"]),
  gradient("dark-ink", "Tinta", "dark", "serious", "light", "#ffb457", ["#0b0f19", "#161d2f", "#222c45"]),
  gradient("dark-wine", "Vinho", "dark", "serious", "light", "#ffc58a", ["#1a0b14", "#3d1229", "#5b1b3b"]),
  gradient("light-sky", "Céu claro", "light", "fresh", "dark", "#0f766e", ["#e8f6ff", "#cfe9fb", "#b7dcf5"]),
  gradient("light-mint", "Menta", "light", "calm", "dark", "#c2410c", ["#eafaf1", "#cdeedd", "#b2e3cb"]),
];

export function getBackgroundById(id: string): StoryBackground | null {
  return STORY_BACKGROUNDS.find((background) => background.id === id) ?? null;
}

export interface PickBackgroundInput {
  /** Clima pedido pelo conteúdo (valor inválido cai em "neutral"). */
  mood: string;
  seed: string;
  /** Ids usados nos últimos Stories (mais recente primeiro) — evita repetir o mesmo fundo em sequência. */
  recentBackgroundIds?: string[];
  /** Biblioteca (padrão: a embutida). Só os `enabled` entram. */
  library?: StoryBackground[];
}

/**
 * Escolhe o fundo do Story: mesma categoria do clima do conteúdo, sem
 * repetir os recentes quando há alternativa; sem nenhum da categoria,
 * qualquer habilitado. Determinístico pela semente (retry = mesmo fundo).
 */
export function pickBackground(input: PickBackgroundInput): StoryBackground {
  const library = (input.library ?? STORY_BACKGROUNDS).filter((background) => background.enabled);
  if (library.length === 0) throw new Error("Nenhum fundo de Story habilitado.");
  const mood = isVisualMood(input.mood) ? input.mood : "neutral";
  const recent = new Set((input.recentBackgroundIds ?? []).slice(0, 3));
  const inCategory = library.filter((background) => background.category === mood);
  const base = inCategory.length > 0 ? inCategory : library;
  const fresh = base.filter((background) => !recent.has(background.id));
  const notLast = base.filter((background) => background.id !== input.recentBackgroundIds?.[0]);
  const pool = fresh.length > 0 ? fresh : notLast.length > 0 ? notLast : base;
  return pool[Math.floor(createRng(`${input.seed}|background`)() * pool.length)];
}
