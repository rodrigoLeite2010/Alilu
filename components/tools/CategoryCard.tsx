import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import type { Category } from "@/data/categories";
import { getToolsByCategory } from "@/data/tools";

export function CategoryCard({ category }: { category: Category }) {
  const toolCount = getToolsByCategory(category.id).length;

  return (
    <Link
      href={`/utilitarios/${category.id}`}
      className="group flex h-full flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-5 transition-colors hover:border-blue-300 hover:bg-blue-50/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-blue-800 dark:hover:bg-blue-950/30"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
        <Icon name={category.icon} className="h-6 w-6" />
      </span>
      <div>
        <p className="text-lg font-semibold text-zinc-900 group-hover:text-blue-700 dark:text-zinc-50 dark:group-hover:text-blue-300">
          {category.name}
        </p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {category.description}
        </p>
      </div>
      <p className="mt-auto text-xs font-medium text-zinc-500 dark:text-zinc-500">
        {toolCount} {toolCount === 1 ? "ferramenta" : "ferramentas"}
      </p>
    </Link>
  );
}
