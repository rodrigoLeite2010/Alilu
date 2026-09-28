import type { ToolFaqItem } from "@/components/tools/ToolPageTemplate";

/**
 * Gera o objeto de dados estruturados (schema.org FAQPage) a partir da
 * lista de perguntas/respostas já exibida na página (mesmo dado, só
 * serializado para o Googlebot). Usado por components/seo/FaqJsonLd.
 *
 * Não gera nada se a lista estiver vazia, para nunca publicar um FAQPage
 * sem itens (o que o Google trata como dado estruturado inválido).
 */
export function buildFaqJsonLd(faq: ToolFaqItem[]) {
  if (faq.length === 0) return null;

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}
