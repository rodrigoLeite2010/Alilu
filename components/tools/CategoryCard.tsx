import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import type { Category } from "@/data/categories";
import { getToolsByCategory } from "@/data/tools";

export function CategoryCard({ category }: { category: Category }) {
  const toolCount = getToolsByCategory(category.id).length;

  return (
    <Link
      href={`/utilitarios/${category.id}`}
      className="group flex h-full flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-5 transition-colors hover:border-teal-700/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-md bg-zinc-100 text-zinc-700 transition-colors group-hover:bg-teal-50 group-hover:text-teal-800">
        <Icon name={category.icon} className="h-5 w-5" />
      </span>
      <div>
        <p className="text-lg font-semibold text-zinc-900 group-hover:text-teal-800">
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
