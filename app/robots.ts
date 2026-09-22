import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Login, callbacks de OAuth e o painel autenticado de publicação no
      // Instagram nunca devem ser indexados (ETAPA 17 do PROMPT: "nunca
      // indexar páginas privadas, callbacks de OAuth ou telas com dados
      // pessoais").
      disallow: ["/entrar", "/api/", "/instagram/painel"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
