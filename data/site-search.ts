import { tools } from "./tools";
import { instagramTools } from "./instagram";
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

  cachedIndex = [...fromTools, ...fromInstagram];
  return cachedIndex;
}
