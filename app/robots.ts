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
      disallow: [
        "/entrar",
        "/minha-conta",
        "/api/",
        "/instagram/painel",
        // Área privada de "Meus Jogos" (Loterias) — dados pessoais do usuário.
        "/loterias/lotofacil/meus-jogos",
        "/loterias/mega-sena/meus-jogos",
        "/loterias/quina/meus-jogos",
        "/loterias/lotomania/meus-jogos",
        "/loterias/dia-de-sorte/meus-jogos",
        // Área privada de Educação Financeira (dados pessoais do usuário).
        "/financeiro/meu-orcamento",
        "/financeiro/calendario",
        "/financeiro/receitas",
        "/financeiro/despesas",
        "/financeiro/metas",
        "/financeiro/reserva-de-emergencia",
        "/financeiro/metodo-50-30-20",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
