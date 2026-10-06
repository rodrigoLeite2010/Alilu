import { categories } from "@/data/categories";
import { INSTAGRAM_CATEGORY } from "@/data/instagram";
import { LOTTERIES_CATEGORY } from "@/data/lotteries";
import { VIDEOS_CATEGORY } from "@/data/videos";

export interface MobileLink {
  href: string;
  label: string;
  icon: string;
  description?: string;
}

/**
 * Ações de criação (botão "Criar" da barra inferior). Só aponta para
 * telas que já existem — Story ainda não tem tela própria de criação.
 */
export const createLinks: MobileLink[] = [
  { href: "/instagram/criar-post", label: "Post", icon: "image", description: "Imagem com legenda" },
  { href: "/instagram/reels", label: "Reel", icon: "video", description: "Vídeo curto" },
  { href: "/instagram/carrossel", label: "Carrossel", icon: "columns", description: "Várias imagens" },
  { href: "/videos", label: "Vídeo", icon: "film", description: "Split screen e vídeo com IA" },
];

/** Ações principais da home mobile (grade 2x2). */
export const homeActionLinks: MobileLink[] = [
  { href: "/instagram/criar-post", label: "Criar Post", icon: "image", description: "Imagem com legenda" },
  { href: "/instagram/reels", label: "Criar Reel", icon: "video", description: "Vídeo curto" },
  { href: "/instagram/carrossel", label: "Criar Carrossel", icon: "columns", description: "Várias imagens" },
  { href: "/agenda", label: "Agenda", icon: "calendar", description: "Seus compromissos" },
];

/** "Mais ferramentas": as mesmas áreas do menu lateral, na mesma ordem. */
export const moreToolsLinks: MobileLink[] = [
  { href: "/utilitarios", label: "Todas as ferramentas", icon: "wrench" },
  { href: INSTAGRAM_CATEGORY.path, label: INSTAGRAM_CATEGORY.shortName, icon: INSTAGRAM_CATEGORY.icon },
  { href: VIDEOS_CATEGORY.path, label: VIDEOS_CATEGORY.shortName, icon: VIDEOS_CATEGORY.icon },
  { href: LOTTERIES_CATEGORY.path, label: LOTTERIES_CATEGORY.shortName, icon: LOTTERIES_CATEGORY.icon },
  { href: "/agenda", label: "Agenda", icon: "calendar" },
  ...categories.map((category) => ({
    href: `/utilitarios/${category.id}`,
    label: category.name,
    icon: category.icon,
  })),
];
