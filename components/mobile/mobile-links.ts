import { categories } from "@/data/categories";
import { INSTAGRAM_CATEGORY } from "@/data/instagram";
import { LOTTERIES_CATEGORY } from "@/data/lotteries";
import { VIDEOS_CATEGORY, videoTools } from "@/data/videos";
import { VIAGENS_CATEGORY } from "@/data/viagens";
import { IMOVEIS_CATEGORY } from "@/data/imoveis";

export interface MobileLink {
  href: string;
  label: string;
  icon: string;
  description?: string;
}

/**
 * Ações do Instagram (botão "Criar" da barra inferior). A criação manual saiu
 * da interface: o caminho principal é o Radar Instagram.
 */
export const createInstagramLinks: MobileLink[] = [
  { href: "/instagram/radar/novo", label: "Radar Instagram", icon: "trending-up", description: "Vídeos por links, publicação automática" },
  { href: "/instagram/radar", label: "Meus radares", icon: "list-ordered", description: "Filas, horários e histórico" },
  { href: "/instagram/painel/calendario", label: "Minhas publicações", icon: "calendar", description: "Histórico e próximas" },
];

/** Nome curto e descrição de cada ferramenta de vídeo no celular; os caminhos vêm de data/videos.ts. */
const videoCopy: Record<string, { label: string; description: string }> = {
  "editor-split-screen": { label: "Split Screen", description: "Dois vídeos em um só" },
  "imagem-para-video": { label: "Vídeo com IA", description: "Animar uma imagem" },
  "importar-instagram": { label: "Importar do Instagram", description: "Reel, vídeo ou foto pública" },
};

/** Atalhos diretos para as ferramentas de vídeo (Criar, home e hub de Vídeos). */
export const videoLinks: MobileLink[] = videoTools
  .filter((tool) => tool.status === "ativo")
  .map((tool) => ({
    href: tool.path,
    icon: tool.icon,
    label: videoCopy[tool.id]?.label ?? tool.shortName,
    description: videoCopy[tool.id]?.description,
  }));

/** Ações principais da home mobile (grade 2x2). */
export const homeActionLinks: MobileLink[] = [
  { href: "/instagram/radar/novo", label: "Radar Instagram", icon: "trending-up", description: "Publicação automática" },
  { href: "/instagram/radar", label: "Meus radares", icon: "list-ordered", description: "Filas e horários" },
  { href: "/instagram/painel/calendario", label: "Publicações", icon: "calendar", description: "Histórico e próximas" },
  { href: "/agenda", label: "Agenda", icon: "calendar", description: "Seus compromissos" },
];

/** "Mais ferramentas": as mesmas áreas do menu lateral, na mesma ordem. */
export const moreToolsLinks: MobileLink[] = [
  { href: IMOVEIS_CATEGORY.path, label: IMOVEIS_CATEGORY.name, icon: IMOVEIS_CATEGORY.icon },
  { href: VIAGENS_CATEGORY.path, label: VIAGENS_CATEGORY.name, icon: VIAGENS_CATEGORY.icon },
  { href: "/utilitarios", label: "Todas as ferramentas", icon: "wrench" },
  { href: "/planos", label: "Planos e assinatura", icon: "credit-card" },
  { href: "/minha-conta/creditos-ia", label: "Créditos de IA", icon: "coins" },
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
