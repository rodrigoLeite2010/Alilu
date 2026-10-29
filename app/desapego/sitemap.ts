import type {MetadataRoute} from "next";
import {SITE_URL} from "@/lib/seo/site";
import {sitemapProducts} from "@/lib/desapego/repository";
export const dynamic="force-dynamic";
export default async function sitemap():Promise<MetadataRoute.Sitemap>{const products=await sitemapProducts();return products.map(product=>({url:`${SITE_URL}/desapego/${product.slug}`,lastModified:product.updated_at,changeFrequency:"weekly" as const,priority:0.7}));}
