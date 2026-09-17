import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import type { Tool } from "@/data/tools";

export function ToolCard({ tool }: { tool: Tool }) {
  const isAvailable = tool.status === "ativo";
  const isFeatured = tool.featureRank !== undefined;

  return (
    <Link
      href={`/utilitarios/${tool.category}/${tool.slug}`}
      className={`group flex h-full flex-col gap-3 rounded-lg border p-4 transition-colors hover:border-teal-700/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
        isFeatured
          ? "border-teal-300 bg-teal-50/30"
          : "border-zinc-200 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-700 transition-colors group-hover:bg-teal-50 group-hover:text-teal-800">
          <Icon name={tool.icon} className="h-5 w-5" />
        </span>
        {isFeatured ? <Badge tone="brand">Em destaque</Badge> : null}
        {!isAvailable ? <Badge tone="warning">Em breve</Badge> : null}
      </div>
      <div>
        <p className="font-semibold text-zinc-900 group-hover:text-teal-800">
          {tool.shortName}
        </p>
        <p className="mt-1 text-sm text-zinc-600">{tool.description}</p>
      </div>
    </Link>
  );
}
