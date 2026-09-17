import type { Tool } from "@/data/tools";
import { ToolCard } from "@/components/tools/ToolCard";

export function ToolGrid({
  tools,
  emptyMessage = "Nenhuma ferramenta encontrada.",
}: {
  tools: Tool[];
  emptyMessage?: string;
}) {
  if (tools.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">
        {emptyMessage}
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tools.map((tool) => (
        <li key={tool.id}>
          <ToolCard tool={tool} />
        </li>
      ))}
    </ul>
  );
}
