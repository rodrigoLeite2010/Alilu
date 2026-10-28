import type { MetadataRoute } from "next";
import { cities, sitemapEntries } from "@/lib/imoveis/repository";
import { slugify } from "@/lib/imoveis/model";
import { SITE_URL } from "@/lib/seo/site";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [entries, locations] = await Promise.all([sitemapEntries(), cities()]);
  return [
    { url: `${SITE_URL}/imoveis`, changeFrequency: "daily", priority: 0.8 },
    ...entries.map((p) => ({
      url: `${SITE_URL}/imoveis/${p.slug}`,
      lastModified: p.updated_at,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...locations.map((c) => ({
      url: `${SITE_URL}/imoveis/cidade/${c.state.toLowerCase()}/${slugify(c.city)}`,
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
  ];
}
