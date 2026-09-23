"use client";

import { useMemo, useState } from "react";
import { ToolCard } from "@/components/tools/ToolCard";
import type { Tool } from "@/data/tools";

const DECODER_IDS = new Set([
  "base64-para-ascii",
  "base64-para-audio",
  "basic-auth-decode",
  "base64-para-arquivo",
  "base64-para-hex",
  "base64-para-imagem",
  "base64-para-pdf",
  "base64-para-texto",
  "base64-para-video",
]);

function matchesSearch(tool: Tool, search: string): boolean {
  const normalized = search.trim().toLowerCase();
  if (!normalized) return true;
  return [tool.name, tool.shortName, tool.description, ...tool.keywords]
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}

function ToolSection({ title, tools }: { title: string; tools: Tool[] }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
      {tools.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-zinc-300 p-5 text-sm text-zinc-500">
          Nenhuma ferramenta encontrada nesta seção.
        </p>
      ) : (
        <ul className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((tool) => (
            <li key={tool.id}>
              <ToolCard tool={tool} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function Base64CategoryTools({ tools }: { tools: Tool[] }) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => tools.filter((tool) => matchesSearch(tool, search)), [search, tools]);
  const decoders = filtered.filter((tool) => DECODER_IDS.has(tool.id));
  const encoders = filtered.filter((tool) => !DECODER_IDS.has(tool.id));

  return (
    <div className="mt-6">
      <label htmlFor="base64-category-search" className="text-sm font-medium text-zinc-800">
        O que você quer converter?
      </label>
      <input
        id="base64-category-search"
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Ex.: imagem, PDF, texto, hexadecimal..."
        className="mt-2 h-11 w-full rounded-md border border-zinc-300 px-3 text-sm text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
      />

      <ToolSection title="Decodificar Base64" tools={decoders} />
      <ToolSection title="Converter para Base64" tools={encoders} />
    </div>
  );
}
