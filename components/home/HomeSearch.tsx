"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SearchField } from "@/components/forms/SearchField";
import { Icon } from "@/components/ui/Icon";
import { normalizeForSearch } from "@/lib/formatters/text";
import { getSiteSearchIndex } from "@/data/site-search";

const MAX_RESULTS = 8;

/**
 * Busca da Home: client-side, sobre o índice combinado (calculadoras +
 * Instagram, ver data/site-search.ts) — sem chamada de rede e sem backend
 * novo. Mostra os resultados como uma lista compacta abaixo do campo,
 * cada um já um link direto para a ferramenta; nunca navega para uma
 * página de resultados própria.
 */
export function HomeSearch() {
  const [query, setQuery] = useState("");
  const index = useMemo(() => getSiteSearchIndex(), []);

  const results = useMemo(() => {
    const normalizedQuery = normalizeForSearch(query.trim());
    if (!normalizedQuery) {
      return [];
    }

    return index
      .filter((item) => {
        const haystack = normalizeForSearch(
          [item.name, item.shortName, item.description, item.categoryLabel, ...item.keywords].join(" "),
        );
        return haystack.includes(normalizedQuery);
      })
      .slice(0, MAX_RESULTS);
  }, [index, query]);

  const showResults = query.trim().length > 0;

  return (
    <div className="w-full max-w-lg">
      <SearchField
        label="Qual ferramenta você precisa? Ex.: CPF, PDF, Instagram, financiamento..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {showResults ? (
        <div className="mt-2 overflow-hidden rounded-lg border border-brand-primary/15 bg-white shadow-sm" role="region" aria-live="polite">
          {results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-zinc-500">
              Nenhuma ferramenta encontrada para &ldquo;{query.trim()}&rdquo;. Tente outro termo.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {results.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-brand-primary-soft/60 focus-visible:bg-brand-primary-soft/60 focus-visible:outline-none"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-primary-soft text-brand-primary">
                      <Icon name={item.icon} className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-zinc-900">{item.shortName}</span>
                      <span className="block truncate text-xs text-zinc-500">{item.categoryLabel}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
