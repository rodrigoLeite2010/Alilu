import { buildBreadcrumbJsonLd, type BreadcrumbItem } from "@/lib/seo/breadcrumb";

/**
 * Renderiza os dados estruturados schema.org/BreadcrumbList correspondentes
 * à trilha de navegação visível (components/navigation/Breadcrumbs.tsx).
 */
export function BreadcrumbJsonLd({ items }: { items: BreadcrumbItem[] }) {
  const json = buildBreadcrumbJsonLd(items);
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  );
}
