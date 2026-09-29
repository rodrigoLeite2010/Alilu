import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { getToolsByIds } from "@/data/tools";

/**
 * Destaque "Resolva tarefas com PDF em segundos" — mostra algumas das 18
 * ferramentas reais da categoria "pdf" (data/tools.ts). Nenhuma ferramenta
 * nova é criada; a lista completa continua em /utilitarios/pdf.
 */
const PDF_HIGHLIGHT_TOOL_IDS = ["unir-pdf", "dividir-pdf", "comprimir-pdf", "pdf-para-word"];

export function PdfHighlight() {
  const highlightTools = getToolsByIds(PDF_HIGHLIGHT_TOOL_IDS);

  return (
    <section className="border-b border-zinc-200 bg-white">
      <Container className="py-12 sm:py-16">
        <div className="rounded-xl border border-zinc-200 bg-white p-6 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-xl">
              <p className="text-sm font-semibold uppercase tracking-wider text-teal-800">PDF</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900">
                Resolva tarefas com PDF em segundos
              </h2>
              <p className="mt-3 text-zinc-600">
                Una, divida, converta e organize seus arquivos PDF — direto no navegador, sem instalar programas.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <LinkButton href="/utilitarios/pdf">Ver ferramentas PDF</LinkButton>
              </div>
            </div>
            <ul className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:w-auto lg:min-w-[19rem]">
              {highlightTools.map((tool) => (
                <li key={tool.id}>
                  <Link
                    href={`/utilitarios/${tool.category}/${tool.slug}`}
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
