import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { LinkButton } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { AdSlot } from "@/components/ui/AdSlot";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { CategoryCard } from "@/components/tools/CategoryCard";
import { ToolGrid } from "@/components/tools/ToolGrid";
import { categories } from "@/data/categories";
import { getFeaturedTools } from "@/data/tools";
import { INSTAGRAM_CATEGORY, instagramTools } from "@/data/instagram";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { HomePublishingPromo } from "@/components/instagram/PublishingPromo";

export const metadata: Metadata = buildPageMetadata({
  title: "ALILU Utilitários — Calculadoras e ferramentas online gratuitas",
  description:
    "Caixa de ferramentas online gratuita e em português: calculadoras de trabalho, financeiro, empresa e utilidades do dia a dia.",
  path: "/",
});

const featuredTools = getFeaturedTools();

export default function HomePage() {
  return (
    <>
      <section className="border-b border-zinc-200 bg-white">
        <Container className="py-16 sm:py-24">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-wider text-teal-800">
              Grátis e em português
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-balance text-zinc-900 sm:text-5xl">
              Sua caixa de ferramentas online
            </h1>
            <p className="mt-4 text-lg text-zinc-600">
              Calculadoras e utilitários para trabalho, finanças e empresa —
              rápidos, sem cadastro e prontos para usar direto do seu celular.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
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

      {featuredTools.length > 0 ? (
        <section className="border-b border-zinc-200 bg-zinc-50/70">
          <Container className="py-10 sm:py-12">
            <SectionHeading
              title="Em destaque"
              description="Atalhos para ferramentas selecionadas do catálogo."
            />
            <ToolGrid tools={featuredTools} />
          </Container>
        </section>
      ) : null}

      <Container className="pt-10 sm:pt-12">
        <HomePublishingPromo />
      </Container>

      <Container className="py-12 sm:py-16" id="categorias">
        <SectionHeading
          title="Categorias"
          description="Escolha uma área e encontre a ferramenta certa para o seu problema."
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Categoria "Instagram e Redes Sociais": vive em /instagram (fora
              de /utilitarios/[categoria], ver data/instagram.ts), então usa
              o mesmo visual do CategoryCard só que montado aqui à mão.
              Aparece primeiro na lista de categorias. */}
          <Link
            href={INSTAGRAM_CATEGORY.path}
            className="group flex h-full flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-5 transition-colors hover:border-teal-700/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-md bg-zinc-100 text-zinc-700 transition-colors group-hover:bg-teal-50 group-hover:text-teal-800">
              <Icon name={INSTAGRAM_CATEGORY.icon} className="h-5 w-5" />
            </span>
            <div>
              <p className="text-lg font-semibold text-zinc-900 group-hover:text-teal-800">
                {INSTAGRAM_CATEGORY.name}
              </p>
              <p className="mt-1 text-sm text-zinc-600">{INSTAGRAM_CATEGORY.description}</p>
            </div>
            <p className="mt-auto text-xs font-medium text-zinc-500">
              {instagramTools.length} {instagramTools.length === 1 ? "ferramenta" : "ferramentas"}
            </p>
          </Link>
          {categories.map((category) => (
            <CategoryCard key={category.id} category={category} />
          ))}
        </div>
      </Container>

      <Container className="pb-12">
        <AdSlot />
      </Container>
    </>
  );
}
