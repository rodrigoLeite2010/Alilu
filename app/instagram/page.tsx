import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { AdSlot } from "@/components/ui/AdSlot";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { INSTAGRAM_CATEGORY, INSTAGRAM_PUBLISHING, instagramTools, plannedInstagramTools } from "@/data/instagram";
import { AutoPublishingCard, HowPublishingWorks } from "@/components/instagram/PublishingPromo";
import { tools } from "@/data/tools";

/** Ferramentas que publicam/agendam de verdade (ver INSTAGRAM_PUBLISHING.supported). */
const PUBLISHING_TOOL_IDS = new Set(["criador-post-instagram", "criador-carrossel-instagram", "criador-reels-instagram"]);

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

      <section className="rounded-lg border border-teal-200 bg-teal-50/50 p-5 sm:p-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">{INSTAGRAM_CATEGORY.title}</h1>
        <p className="mt-2 max-w-2xl text-base text-zinc-600">{INSTAGRAM_CATEGORY.subtitle}</p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Link
            href="/instagram/criar-post"
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800"
          >
            Criar post grátis
          </Link>
          <Link
            href={INSTAGRAM_PUBLISHING.schedulePath}
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 ring-1 ring-inset ring-zinc-300 transition-colors hover:bg-zinc-50"
          >
            Agendar publicação
          </Link>
          <Link
            href={INSTAGRAM_PUBLISHING.connectPath}
            prefetch={false}
            className="inline-flex min-h-11 items-center justify-center rounded-md px-4 py-2.5 text-sm font-semibold text-teal-800 transition-colors hover:bg-teal-100/60"
          >
            Conectar Instagram
          </Link>
        </div>
        <p className="mt-3 text-xs text-zinc-600">
          Criar e baixar é grátis e sem cadastro. Sua conta só é pedida na hora de publicar ou agendar.
        </p>
      </section>

      <section className="mt-8" aria-labelledby="como-funciona">
        <h2 id="como-funciona" className="mb-3 text-lg font-semibold text-zinc-900">
          Como funciona
        </h2>
        <HowPublishingWorks />
      </section>

      <section id="criar-publicacao" className="mt-10 scroll-mt-20">
        <SectionHeading
          title="Criar publicação"
          description="Escolha o formato e comece a criar sem precisar conectar o Instagram antes."
        />
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {instagramTools
            .filter((tool) => tool.id !== "gerador-legendas-instagram")
            .map((tool) => (
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
                {PUBLISHING_TOOL_IDS.has(tool.id) ? (
                  <p className="mt-auto text-xs font-medium text-teal-800">Publica e agenda no Instagram</p>
                ) : null}
              </Link>
            </li>
          ))}
          <li>
            <Link
              href={INSTAGRAM_PUBLISHING.viralPostsPath}
              className="group flex h-full flex-col gap-3 rounded-lg border border-teal-300 bg-teal-50/30 p-4 transition-colors hover:border-teal-700/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white text-zinc-700 transition-colors group-hover:bg-teal-100 group-hover:text-teal-800">
                  <Icon name="sparkles" className="h-5 w-5" />
                </span>
                <Badge tone="brand">Grátis</Badge>
              </div>
              <div>
                <p className="font-semibold text-zinc-900 group-hover:text-teal-800">Posts Virais</p>
                <p className="mt-1 text-sm text-zinc-600">
                  Templates prontos para engajar: escolha, coloque sua foto, ajuste o texto e publique ou agende.
                </p>
              </div>
              <p className="mt-auto text-xs font-medium text-teal-800">Publica e agenda no Instagram</p>
            </Link>
          </li>
        </ul>
      </section>

      <section id="publicacao-automatica" className="mt-10 scroll-mt-20">
        <SectionHeading
          title="Publique e agende sem sair do Alilu"
          description="Nada de baixar a imagem e subir no celular: o Alilu publica por você, pela integração oficial da Meta."
        />
        <AutoPublishingCard />
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {INSTAGRAM_PUBLISHING.supported.map((item) => (
            <div key={item.label} className="rounded-lg bg-zinc-50 p-4">
              <p className="text-sm font-semibold text-zinc-900">{item.label}</p>
              <p className="mt-1 text-xs text-zinc-600">{item.detail}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          Requer uma conta profissional do Instagram (Criador de conteúdo ou Empresa). Ainda não disponível pela
          publicação automática: {INSTAGRAM_PUBLISHING.notYetSupported.join(", ").toLowerCase()}.
        </p>
      </section>

      <section className="mt-10">
        <SectionHeading
          title="Outras ferramentas"
          description="Recursos extras para completar sua publicação."
          as="h2"
        />
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {instagramTools
            .filter((tool) => tool.id === "gerador-legendas-instagram")
            .map((tool) => (
              <li key={tool.id}>
                <Link
                  href={tool.path}
                  className="group flex h-full flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 transition-colors hover:border-teal-700/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-zinc-50 text-zinc-700 transition-colors group-hover:bg-teal-100 group-hover:text-teal-800">
                    <Icon name={tool.icon} className="h-5 w-5" />
                  </span>
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
          <li>
            Escolha a ferramenta: Criador de Posts (imagem única ou capa 9:16), Criador de Carrosséis, Criador de
            Reels, Posts Virais ou Gerador de Legendas.
          </li>
          <li>Selecione o formato e um template; personalize textos, cores e, se quiser, envie uma foto sua.</li>
          <li>Baixe a arte em PNG, JPG ou ZIP — de graça e sem login.</li>
          <li>
            Ou clique em &quot;Publicar no Instagram&quot; ou &quot;Agendar publicação&quot;: entre no Alilu, conecte seu Instagram uma única vez e escolha publicar
            agora ou em um dia e horário. Seu trabalho não se perde durante a conexão.
          </li>
        </ol>
      </section>

      <section className="mt-10">
        <SectionHeading title="Benefícios" as="h2" />
        <ul className="grid grid-cols-1 gap-3 text-sm text-zinc-700 sm:grid-cols-2">
          <li className="rounded-lg bg-zinc-50 p-4">Criar e baixar é 100% gratuito, sem limite e sem cadastro.</li>
          <li className="rounded-lg bg-zinc-50 p-4">Publicação e agendamento direto no Instagram, quando você quiser.</li>
          <li className="rounded-lg bg-zinc-50 p-4">Suas fotos ficam no seu navegador — só são enviadas se você decidir publicar ou agendar.</li>
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
