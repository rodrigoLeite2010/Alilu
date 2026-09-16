"use client";

import { useMemo, useState } from "react";
import { SearchField } from "@/components/forms/SearchField";
import { ToolGrid } from "@/components/tools/ToolGrid";
import { normalizeForSearch } from "@/lib/formatters/text";
import type { Tool } from "@/data/tools";

/**
 * Busca client-side sobre o catálogo de ferramentas. Recebe a lista completa
 * de ferramentas do servidor (Server Component pai) e filtra localmente —
 * sem chamadas de rede — por nome, descrição e palavras-chave.
 */
export function ToolCatalogSearch({ tools }: { tools: Tool[] }) {
  const [query, setQuery] = useState("");

  const filteredTools = useMemo(() => {
    const normalizedQuery = normalizeForSearch(query.trim());
    if (!normalizedQuery) {
      return tools;
    }

    return tools.filter((tool) => {
      const haystack = normalizeForSearch(
        [tool.name, tool.shortName, tool.description, ...tool.keywords].join(
          " "
        )
      );
      return haystack.includes(normalizedQuery);
    });
  }, [tools, query]);

  return (
    <div>
      <div className="mb-6 max-w-lg">
        <SearchField
          label="Buscar ferramenta por nome, ex.: juros compostos"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400" aria-live="polite">
        {filteredTools.length}{" "}
        {filteredTools.length === 1
          ? "ferramenta encontrada"
          : "ferramentas encontradas"}
      </p>
      <ToolGrid
        tools={filteredTools}
        emptyMessage="Nenhuma ferramenta encontrada para essa busca. Tente outro termo."
      />
    </div>
  );
}
