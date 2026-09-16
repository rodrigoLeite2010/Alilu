import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import type { Tool } from "@/data/tools";

export function ToolCard({ tool }: { tool: Tool }) {
  const isAvailable = tool.status === "disponivel";

  return (
    <Link
      href={`/utilitarios/${tool.category}/${tool.slug}`}
      className="group flex h-full flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-blue-300 hover:bg-blue-50/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-blue-800 dark:hover:bg-blue-950/30"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
          <Icon name={tool.icon} className="h-5 w-5" />
        </span>
        {!isAvailable ? <Badge tone="warning">Em breve</Badge> : null}
      </div>
      <div>
        <p className="font-semibold text-zinc-900 group-hover:text-blue-700 dark:text-zinc-50 dark:group-hover:text-blue-300">
          {tool.shortName}
        </p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {tool.description}
        </p>
      </div>
    </Link>
  );
}
