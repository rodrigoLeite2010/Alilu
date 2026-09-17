import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { ToolCatalogSearch } from "@/components/tools/ToolCatalogSearch";
import { tools } from "@/data/tools";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Todas as ferramentas",
  description:
    "Catálogo completo de calculadoras e utilitários gratuitos do ALILU Utilitários. Busque pela ferramenta que você precisa.",
  path: "/utilitarios",
});

export default function ToolsCatalogPage() {
  return (
    <Container className="py-8 sm:py-10">
      <Breadcrumbs
        items={[
          { name: "Início", path: "/" },
          { name: "Utilitários", path: "/utilitarios" },
        ]}
      />
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
        Todas as ferramentas
      </h1>
      <p className="mt-2 max-w-2xl text-base text-zinc-600">
        {tools.length} ferramentas organizadas por categoria. Use a busca
        abaixo para encontrar rapidamente a calculadora que você precisa.
      </p>

      <div className="mt-6">
        <ToolCatalogSearch tools={tools} />
      </div>
    </Container>
  );
}
