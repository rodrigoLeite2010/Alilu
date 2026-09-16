import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { AdSlot } from "@/components/ui/AdSlot";
import { ComingSoonNotice } from "@/components/tools/ComingSoonNotice";
import { ToolGrid } from "@/components/tools/ToolGrid";
import type { Category } from "@/data/categories";
import { getRelatedTools, type Tool } from "@/data/tools";

/**
 * Template reutilizável para a página de uma ferramenta. Qualquer nova
 * ferramenta (mesmo já com cálculo real implementado) deve montar sua página
 * em cima deste template, para não duplicar layout, SEO ou navegação
 * (PROMPT MESTRE, seções 2 e 6).
 *
 * `children`, quando informado, substitui a área principal (formulário +
 * resultado) por uma calculadora real. Sem `children`, é exibido o aviso de
 * "Em breve".
 */
export function ToolPageTemplate({
  tool,
  category,
  children,
}: {
  tool: Tool;
  category: Category;
  children?: React.ReactNode;
}) {
  const relatedTools = getRelatedTools(tool);

  return (
    <div className="py-8 sm:py-10">
      <Breadcrumbs
        items={[
          { name: "Início", path: "/" },
          { name: "Utilitários", path: "/utilitarios" },
          { name: category.name, path: `/utilitarios/${category.id}` },
          {
            name: tool.shortName,
            path: `/utilitarios/${category.id}/${tool.slug}`,
          },
        ]}
      />

      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-50">
        {tool.name}
      </h1>
      <p className="mt-2 max-w-2xl text-base text-zinc-600 dark:text-zinc-400">
        {tool.description}
      </p>

      <div className="mt-6">{children ?? <ComingSoonNotice toolName={tool.name} />}</div>

      <div className="mt-8">
        <AdSlot />
      </div>

      <section className="mt-10">
        <SectionHeading title="Como funciona" />
        <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
          Assim que estiver disponível, a ferramenta {tool.shortName} vai
          pedir as informações necessárias em um formulário simples,
          calcular o resultado diretamente no seu navegador e mostrar o
          detalhamento completo do cálculo logo abaixo do resultado principal.
        </p>
      </section>

      <section className="mt-8">
        <SectionHeading title="Perguntas frequentes" />
        <dl className="space-y-4">
          <div>
            <dt className="font-medium text-zinc-900 dark:text-zinc-50">
              Quando esta ferramenta estará disponível?
            </dt>
            <dd className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Estamos organizando o catálogo do ALILU Utilitários e
              implementando as ferramentas por etapas. Volte em breve para
              conferir.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-900 dark:text-zinc-50">
              Vai ser gratuita?
            </dt>
            <dd className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Sim. Todas as ferramentas do ALILU Utilitários são e continuarão
              sendo gratuitas para uso.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-900 dark:text-zinc-50">
              Preciso me cadastrar para usar?
            </dt>
            <dd className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Não. As calculadoras do ALILU Utilitários são feitas para uso
              imediato, sem necessidade de cadastro.
            </dd>
          </div>
        </dl>
      </section>

      {relatedTools.length > 0 ? (
        <section className="mt-10">
          <SectionHeading
            title="Ferramentas relacionadas"
            as="h2"
          />
          <ToolGrid tools={relatedTools} />
        </section>
      ) : null}
    </div>
  );
}
