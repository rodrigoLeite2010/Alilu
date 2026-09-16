import type { MetadataRoute } from "next";
import { categories } from "@/data/categories";
import { tools } from "@/data/tools";
import { SITE_URL } from "@/lib/seo/site";
import { getPublishedTools } from "@/lib/seo/publish";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/utilitarios`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/sobre`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/privacidade`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/termos-de-uso`, changeFrequency: "yearly", priority: 0.2 },
  ];

  const categoryRoutes: MetadataRoute.Sitemap = categories.map((category) => ({
    url: `${SITE_URL}/utilitarios/${category.id}`,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  // Ferramentas "em-breve" nunca entram no sitemap — ver lib/seo/publish.ts.
  // Assim que uma ferramenta passa a status "ativo", ela aparece aqui
  // automaticamente, sem qualquer alteração neste arquivo.
  const toolRoutes: MetadataRoute.Sitemap = getPublishedTools(tools).map(
    (tool) => ({
      url: `${SITE_URL}/utilitarios/${tool.category}/${tool.slug}`,
      changeFrequency: "monthly",
      priority: 0.6,
    })
  );

  return [...staticRoutes, ...categoryRoutes, ...toolRoutes];
}
