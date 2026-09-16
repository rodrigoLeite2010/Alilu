import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { LinkButton } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { AdSlot } from "@/components/ui/AdSlot";
import { CategoryCard } from "@/components/tools/CategoryCard";
import { ToolGrid } from "@/components/tools/ToolGrid";
import { categories } from "@/data/categories";
import { tools } from "@/data/tools";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "ALILU Utilitários — Calculadoras e ferramentas online gratuitas",
  description:
    "Caixa de ferramentas online gratuita e em português: calculadoras de trabalho, financeiro, empresa e utilidades do dia a dia.",
  path: "/",
});

const featuredTools = tools.slice(0, 6);

export default function HomePage() {
  return (
    <>
      <section className="border-b border-zinc-200 bg-gradient-to-b from-blue-50/60 to-white dark:border-zinc-800 dark:from-blue-950/20 dark:to-zinc-950">
        <Container className="py-14 sm:py-20">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-5xl dark:text-zinc-50">
              Sua caixa de ferramentas online
            </h1>
            <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
              Calculadoras e utilitários gratuitos para trabalho, finanças e
              empresa — rápidos, em português e prontos para usar direto do
              seu celular.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <LinkButton href="/utilitarios">
                Ver todas as ferramentas
              </LinkButton>
              <LinkButton href="#categorias" variant="secondary">
                Explorar categorias
              </LinkButton>
            </div>
          </div>
        </Container>
      </section>

      <Container className="py-12 sm:py-16" id="categorias">
        <SectionHeading
          title="Categorias"
          description="Escolha uma área e encontre a ferramenta certa para o seu problema."
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((category) => (
            <CategoryCard key={category.id} category={category} />
          ))}
        </div>
      </Container>

      <Container className="pb-12">
        <AdSlot />
      </Container>

      <Container className="pb-16">
        <SectionHeading
          title="Ferramentas em destaque"
          description="Um recorte do catálogo. Novas calculadoras são adicionadas por etapas."
        />
        <ToolGrid tools={featuredTools} />
      </Container>
    </>
  );
}
