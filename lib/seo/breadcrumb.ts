import { SITE_URL } from "./site";

export interface BreadcrumbItem {
  name: string;
  /** Caminho absoluto começando com "/" */
  path: string;
}

/**
 * Gera o objeto de dados estruturados (schema.org BreadcrumbList) a partir
 * de uma trilha de navegação. Usado por components/seo/BreadcrumbJsonLd.
 */
export function buildBreadcrumbJsonLd(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}
