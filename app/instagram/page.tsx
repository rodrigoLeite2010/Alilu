import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { AdSlot } from "@/components/ui/AdSlot";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { INSTAGRAM_CATEGORY, instagramTools, plannedInstagramTools } from "@/data/instagram";
import { tools } from "@/data/tools";

export const metadata: Metadata = buildPageMetadata({
  title: INSTAGRAM_CATEGORY.metaTitle,
  description: INSTAGRAM_CATEGORY.metaDescription,
  path: INSTAGRAM_CATEGORY.path,
});

// Links para ferramentas relacionadas já existentes no catálogo principal
// (ETAPA 1.3), resolvidos pelo id para nunca gerar um link quebrado mesmo
// que a categoria/slug dessas ferramentas mude no futuro.
const RELATED_EXISTING_TOOL_IDS = ["gerador-imagem", "qr-code", "gerador-orcamento"];
const relatedExistingTools = RELATED_EXISTING_TOOL_IDS
  .map((id) => tools.find((tool) => tool.id === id))
  .filter((tool): tool is NonNullable<typeof tool> => Boolean(tool));

export default function InstagramCategoryPage() {
  return (
    <Container className="py-8 sm:py-10">
      <Breadcrumbs
        items={[
          { name: "Início", path: "/" },
          { name: INSTAGRAM_CATEGORY.shortName, path: INSTAGRAM_CATEGORY.path },
        ]}
      />

      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
        {INSTAGRAM_CATEGORY.title}
      </h1>
      <p className="mt-2 max-w-2xl text-base text-zinc-600">{INSTAGRAM_CATEGORY.subtitle}</p>

      <section className="mt-6">
        <p className="max-w-3xl text-sm leading-relaxed text-zinc-700">
          O ALILU Utilitários está criando uma caixa de ferramentas gratuita para quem
          produz conteúdo no Instagram: nada de cadastro, mensalidade ou marca d&apos;água
          obrigatória. Tudo roda direto no seu navegador, então suas imagens e textos não
          precisam ser enviados a nenhum servidor para você montar um post.
        </p>
      </section>

      <section className="mt-10">
        <SectionHeading
          title="Ferramentas disponíveis"
          description="Comece por aqui — novas ferramentas da categoria aparecem automaticamente nesta lista assim que forem publicadas."
        />
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {instagramTools.map((tool) => (
            <li key={tool.id}>
              <Link
                href={tool.path}
                className="group flex h-full flex-col gap-3 rounded-lg border border-teal-300 bg-teal-50/30 p-4 transition-colors hover:border-teal-700/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white text-zinc-700 transition-colors group-hover:bg-teal-100 group-hover:text-teal-800">
                    <Icon name={tool.icon} className="h-5 w-5" />
                  </span>
                  <Badge tone="brand">Grátis</Badge>
                </div>
                <div>
                  <p className="font-semibold text-zinc-900 group-hover:text-teal-800">{tool.shortName}</p>
                  <p className="mt-1 text-sm text-zinc-600">{tool.description}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-8">
        <AdSlot />
      </div>

      <section className="mt-10">
        <SectionHeading title="Como usar" as="h2" />
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-zinc-700">
          <li>Escolha a ferramenta desejada — por enquanto, o Criador de Posts.</li>
          <li>Selecione o formato (post quadrado, vertical ou Stories/Reels) e um dos templates prontos.</li>
          <li>Personalize os textos, as cores e, se quiser, envie uma foto sua.</li>
          <li>Baixe a arte em PNG ou JPG e publique direto no Instagram.</li>
        </ol>
      </section>

      <section className="mt-10">
        <SectionHeading title="Benefícios" as="h2" />
        <ul className="grid grid-cols-1 gap-3 text-sm text-zinc-700 sm:grid-cols-2">
          <li className="rounded-lg bg-zinc-50 p-4">100% gratuito, sem limite de downloads.</li>
          <li className="rounded-lg bg-zinc-50 p-4">Sem necessidade de cadastro ou login.</li>
          <li className="rounded-lg bg-zinc-50 p-4">Processamento local: suas imagens não saem do seu navegador.</li>
          <li className="rounded-lg bg-zinc-50 p-4">Funciona bem tanto no computador quanto no celular.</li>
        </ul>
      </section>

      {relatedExistingTools.length > 0 ? (
        <section className="mt-10">
          <SectionHeading title="Outras ferramentas do ALILU que podem ajudar" as="h2" />
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {relatedExistingTools.map((tool) => (
              <li key={tool.id}>
                <Link
                  href={`/utilitarios/${tool.category}/${tool.slug}`}
                  className="group flex h-full flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-4 transition-colors hover:border-teal-700/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                >
                  <p className="font-semibold text-zinc-900 group-hover:text-teal-800">{tool.shortName}</p>
                  <p className="text-sm text-zinc-600">{tool.description}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-10">
        <SectionHeading
          title="O que vem por aí"
          description="Ferramentas planejadas para esta categoria — ainda em desenvolvimento, sem previsão exata de lançamento."
          as="h2"
        />
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {plannedInstagramTools.map((tool) => (
            <li
              key={tool.name}
              className="flex items-start gap-3 rounded-lg border border-dashed border-zinc-300 bg-zinc-50/70 p-4"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-500">
                <Icon name={tool.icon} className="h-4 w-4" />
              </span>
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold text-zinc-800">
                  {tool.name}
                  <Badge tone="neutral">Em breve</Badge>
                </p>
                <p className="mt-1 text-xs text-zinc-600">{tool.description}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </Container>
  );
}
