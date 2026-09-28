import { buildFaqJsonLd } from "@/lib/seo/faq";
import type { ToolFaqItem } from "@/components/tools/ToolPageTemplate";

/**
 * Renderiza os dados estruturados schema.org/FAQPage correspondentes à
 * seção "Perguntas frequentes" visível na página (ToolPageTemplate). Mesmo
 * padrão de components/seo/BreadcrumbJsonLd.tsx.
 */
export function FaqJsonLd({ faq }: { faq: ToolFaqItem[] }) {
  const json = buildFaqJsonLd(faq);
  if (!json) return null;

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  );
}
