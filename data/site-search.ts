import { tools } from "./tools";
import { instagramTools } from "./instagram";
import { lotteryModalities } from "./lotteries";
import { videoTools } from "./videos";
import { getCategoryById } from "./categories";

/**
 * Item unificado de busca, combinando os dois catálogos existentes do
 * projeto — data/tools.ts (calculadoras/utilitarios, em /utilitarios/...) e
 * data/instagram.ts (ferramentas de Instagram, em /instagram/...) — sem
 * duplicar nome, descrição ou palavras-chave: cada campo é só uma cópia de
 * leitura do catálogo original correspondente.
 *
 * Usado pela busca da Home (components/home/HomeSearch.tsx). A busca de
 * /utilitarios (components/tools/ToolCatalogSearch.tsx) continua usando
 * `tools` diretamente — ela é específica do catálogo de calculadoras e não
 * precisa dos resultados de Instagram.
 */
export interface SiteSearchItem {
  id: string;
  name: string;
  shortName: string;
  description: string;
  keywords: string[];
  icon: string;
  href: string;
  /** Nome da categoria/área, só para exibição no resultado da busca. */
  categoryLabel: string;
}

let cachedIndex: SiteSearchItem[] | null = null;

export function getSiteSearchIndex(): SiteSearchItem[] {
  if (cachedIndex) {
    return cachedIndex;
  }

  const fromTools: SiteSearchItem[] = tools
    .filter((tool) => tool.status === "ativo")
    .map((tool) => ({
      id: `tool:${tool.id}`,
      name: tool.name,
      shortName: tool.shortName,
      description: tool.description,
      keywords: tool.keywords,
      icon: tool.icon,
      href: `/utilitarios/${tool.category}/${tool.slug}`,
      categoryLabel: getCategoryById(tool.category)?.name ?? "Ferramentas",
    }));

  const fromInstagram: SiteSearchItem[] = instagramTools
    .filter((tool) => tool.status === "ativo")
    .map((tool) => ({
      id: `instagram:${tool.id}`,
      name: tool.name,
      shortName: tool.shortName,
      description: tool.description,
      keywords: tool.keywords,
      icon: tool.icon,
      href: tool.path,
      categoryLabel: "Instagram",
    }));

  const fromLotteries: SiteSearchItem[] = lotteryModalities
    .filter((modality) => modality.status === "ativo")
    .map((modality) => ({
      id: `lottery:${modality.id}`,
      name: modality.name,
      shortName: modality.shortName,
      description: modality.description,
      keywords: [modality.shortName.toLowerCase(), "loteria", "loterias", "jogo", "gerador de jogos"],
      icon: modality.icon,
      href: modality.path,
      categoryLabel: "Loterias",
    }));

  const fromVideos: SiteSearchItem[] = videoTools
    .filter((tool) => tool.status === "ativo")
    .map((tool) => ({
      id: `video:${tool.id}`,
      name: tool.name,
      shortName: tool.shortName,
      description: tool.description,
      keywords: [tool.shortName.toLowerCase(), "vídeo", "editor de vídeo", "split screen", "reels", "shorts", "tiktok"],
      icon: tool.icon,
      href: tool.path,
      categoryLabel: "Vídeos",
    }));

  cachedIndex = [...fromTools, ...fromInstagram, ...fromLotteries, ...fromVideos];
  return cachedIndex;
}
