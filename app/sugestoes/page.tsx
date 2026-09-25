import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { listSuggestions } from "@/lib/suggestions/suggestion-repository";

export const metadata: Metadata = {
  title: "Sugestões | ALILU",
  description: "Sugestões de novas ferramentas enviadas por visitantes do ALILU Utilitários.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function SugestoesPage() {
  const suggestions = await listSuggestions();

  return (
    <Container className="py-8 sm:py-10">
      <Breadcrumbs
        items={[
          { name: "Início", path: "/" },
          { name: "Sugestões", path: "/sugestoes" },
        ]}
      />

      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
          Sugestões recebidas
        </h1>
        <p className="mt-2 text-base text-zinc-600">
          Ideias enviadas por visitantes, listadas das mais recentes para as mais antigas.
        </p>
      </div>

      {suggestions.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-zinc-300 px-4 py-10 text-center">
          <p className="text-sm text-zinc-600">Nenhuma sugestão recebida ainda.</p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {suggestions.map((suggestion) => (
            <li key={suggestion.id} className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <time dateTime={suggestion.createdAt} className="text-xs font-medium text-zinc-500">
                  {formatDate(suggestion.createdAt)}
                </time>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                  {suggestion.status}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-800">
                {suggestion.message}
              </p>
              {suggestion.pagePath ? (
                <p className="mt-2 text-xs text-zinc-500">Enviada em: {suggestion.pagePath}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
