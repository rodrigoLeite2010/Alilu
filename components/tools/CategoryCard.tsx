import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import type { Category } from "@/data/categories";
import { getToolsByCategory } from "@/data/tools";

export function CategoryCard({ category }: { category: Category }) {
  const toolCount = getToolsByCategory(category.id).length;

  return (
    <Link
      href={`/utilitarios/${category.id}`}
      className="group flex h-full flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-5 transition-colors hover:border-brand-primary/40 hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-md bg-brand-primary-soft text-brand-primary transition-colors group-hover:bg-brand-accent-soft group-hover:text-brand-accent-dark">
        <Icon name={category.icon} className="h-5 w-5" />
      </span>
      <div>
        <p className="text-lg font-semibold text-zinc-900 group-hover:text-brand-primary">
          {category.name}
        </p>
        <p className="mt-1 text-sm text-zinc-600">{category.description}</p>
      </div>
      <p className="mt-auto text-xs font-medium text-zinc-500">
        {toolCount} {toolCount === 1 ? "ferramenta" : "ferramentas"}
      </p>
    </Link>
  );
}
