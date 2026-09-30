import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { VIDEOS_CATEGORY, videoTools } from "@/data/videos";

/**
 * Destaque "Monte vídeos split-screen para Reels e Shorts" — lê os dados
 * reais de data/videos.ts (nenhuma ferramenta ou rota inventada aqui).
 * Mesmo padrão de components/home/PdfHighlight.tsx (uma categoria com
 * poucas ferramentas, sem sub-links de publicação como o Instagram).
 * Deixa claro, sem esconder, que — diferente das outras categorias — esta
 * envia os vídeos ao servidor para gerar o resultado (ver data/videos.ts).
 */
export function VideoHighlight() {
  const activeTools = videoTools.filter((tool) => tool.status === "ativo");

  return (
    <section className="border-b border-zinc-200 bg-white">
      <Container className="py-12 sm:py-16">
        <div className="rounded-xl border border-zinc-200 bg-white p-6 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-xl">
              <p className="text-sm font-semibold uppercase tracking-wider text-teal-800">{VIDEOS_CATEGORY.name}</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900">
                Monte vídeos split-screen para Reels e Shorts
              </h2>
              <p className="mt-3 text-zinc-600">{VIDEOS_CATEGORY.description}</p>
              <p className="mt-2 text-sm text-zinc-500">
                Grátis e sem cadastro. Diferente das outras ferramentas do site, esta envia os vídeos ao servidor
                para gerar o resultado — os arquivos enviados são apagados logo depois do processamento.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <LinkButton href={VIDEOS_CATEGORY.path}>Conhecer o editor de vídeo</LinkButton>
              </div>
            </div>
            <ul className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:w-auto lg:min-w-[19rem]">
              {activeTools.map((tool) => (
                <li key={tool.id}>
                  <Link
                    href={tool.path}
                    className="flex h-full items-center gap-2.5 rounded-lg border border-zinc-200 bg-zinc-50/60 px-3 py-2.5 text-sm font-medium text-zinc-800 transition-colors hover:border-teal-700/40 hover:text-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                  >
                    <Icon name={tool.icon} className="h-4 w-4 shrink-0 text-teal-700" />
                    {tool.shortName}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Container>
    </section>
  );
}
