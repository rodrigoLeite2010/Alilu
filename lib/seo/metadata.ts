import type { Metadata } from "next";
import { SITE_NAME, SITE_URL } from "./site";

interface BuildPageMetadataInput {
  title: string;
  description: string;
  /** Caminho absoluto começando com "/", ex.: "/utilitarios/financeiro" */
  path: string;
  keywords?: string[];
  /**
   * Regras de robots para esta página específica (ex.: noindex para
   * ferramentas "em-breve" — ver lib/seo/publish.ts). Quando omitido, o
   * comportamento padrão de indexação do Next.js é mantido.
   */
  robots?: Metadata["robots"];
}

/**
 * Constrói um objeto Metadata (title, description, canonical, Open Graph)
 * de forma consistente para qualquer página da plataforma. Evita que cada
 * página precise reimplementar as mesmas regras de SEO (PROMPT MESTRE,
 * seção 8).
 */
export function buildPageMetadata({
  title,
  description,
  path,
  keywords,
  robots,
}: BuildPageMetadataInput): Metadata {
  const url = `${SITE_URL}${path}`;

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      locale: "pt_BR",
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
    ...(robots ? { robots } : {}),
  };
}
