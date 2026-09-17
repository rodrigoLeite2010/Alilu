"use client";

import { useState } from "react";
import { SearchField } from "@/components/forms/SearchField";
import { SYMBOL_CATEGORIES, getSymbolsByCategory, searchSymbols } from "@/lib/data/symbols";

/**
 * Componente principal do Gerador de Símbolos para Copiar (categoria
 * Geradores). É um catálogo estático e pesquisável — nada é gerado
 * aleatoriamente aqui. Toda a busca acontece 100% no navegador do
 * usuário.
 */
export function SymbolPickerTool() {
  const [query, setQuery] = useState("");
  const [copiedChar, setCopiedChar] = useState<string | null>(null);

  const results = query.trim().length > 0 ? searchSymbols(query) : null;

  async function copySymbol(char: string) {
    try {
      await navigator.clipboard.writeText(char);
      setCopiedChar(char);
      setTimeout(() => setCopiedChar((current) => (current === char ? null : current)), 2000);
    } catch {
      setCopiedChar(null);
    }
  }

  function renderGrid(symbols: { char: string; name: string }[], keyPrefix: string) {
    return (
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
        {symbols.map((symbol) => (
          <button
            key={`${keyPrefix}-${symbol.char}`}
            type="button"
            title={symbol.name}
            onClick={() => copySymbol(symbol.char)}
            className="flex flex-col items-center gap-1 rounded-lg border border-zinc-200 p-3 text-center hover:border-teal-700 hover:bg-teal-50"
          >
            <span className="text-2xl text-zinc-900">{symbol.char}</span>
            <span className="text-[11px] text-zinc-500">
              {copiedChar === symbol.char ? "Copiado!" : "Copiar"}
            </span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div>
      <SearchField
        label="Buscar símbolo (ex.: seta, coração, copyright)"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <p role="status" className="sr-only">
        {copiedChar ? `Símbolo ${copiedChar} copiado!` : ""}
      </p>

      <div className="mt-6 space-y-8">
        {results ? (
          results.length > 0 ? (
            renderGrid(results, "search")
          ) : (
            <p className="text-sm text-zinc-500">Nenhum símbolo encontrado para &quot;{query}&quot;.</p>
          )
        ) : (
          SYMBOL_CATEGORIES.map((category) => (
            <div key={category}>
              <h3 className="mb-3 text-sm font-semibold text-zinc-700">{category}</h3>
              {renderGrid(getSymbolsByCategory(category), category)}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
