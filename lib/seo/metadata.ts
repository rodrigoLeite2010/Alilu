import type { Metadata } from "next";
import { SITE_NAME, SITE_URL } from "./site";

interface BuildPageMetadataInput {
  title: string;
  description: string;
  /** Caminho absoluto começando com "/", ex.: "/utilitarios/financeiro" */
  path: string;
  keywords?: string[];
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
  };
}
