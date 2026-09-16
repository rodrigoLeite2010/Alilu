import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { BreadcrumbJsonLd } from "@/components/seo/BreadcrumbJsonLd";
import type { BreadcrumbItem } from "@/lib/seo/breadcrumb";

/**
 * Trilha de navegação visível + dados estruturados (schema.org BreadcrumbList).
 * `items` deve incluir a página atual por último (sem link).
 */
export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Trilha de navegação" className="mb-4 text-sm">
      <ol className="flex flex-wrap items-center gap-1 text-zinc-500 dark:text-zinc-400">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={item.path} className="flex items-center gap-1">
              {index > 0 ? (
                <Icon name="chevron-right" className="h-3.5 w-3.5 shrink-0" />
              ) : null}
              {isLast ? (
                <span
                  aria-current="page"
                  className="font-medium text-zinc-700 dark:text-zinc-200"
                >
                  {item.name}
                </span>
              ) : (
                <Link
                  href={item.path}
                  className="rounded hover:text-zinc-900 hover:underline dark:hover:text-zinc-50"
                >
                  {item.name}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
      <BreadcrumbJsonLd items={items} />
    </nav>
  );
}
