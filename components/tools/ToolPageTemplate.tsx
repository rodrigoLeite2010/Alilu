import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { AdSlot } from "@/components/ui/AdSlot";
import { ComingSoonNotice } from "@/components/tools/ComingSoonNotice";
import { ToolGrid } from "@/components/tools/ToolGrid";
import type { Category } from "@/data/categories";
import { getRelatedTools, type Tool } from "@/data/tools";

export interface ToolContentSection {
  title: string;
  body: string;
}

export interface ToolFaqItem {
  question: string;
  answer: string;
}

/**
 * Template reutilizável para a página de uma ferramenta. Qualquer nova
 * ferramenta (mesmo já com cálculo real implementado) deve montar sua página
 * em cima deste template, para não duplicar layout, SEO ou navegação
 * (PROMPT MESTRE, seções 2 e 6).
 *
 * `children`, quando informado, substitui a área principal (formulário +
 * resultado) por uma calculadora real. Sem `children`, é exibido o aviso de
 * "Em breve".
 *
 * `contentSections` e `faq`, quando informados, substituem o texto
 * genérico de "Como funciona"/"Perguntas frequentes" (pensado para
 * ferramentas ainda "em-breve") pelo conteúdo específico da ferramenta já
 * implementada (ETAPA 2, seção 15). Sem eles, o comportamento é
 * exatamente o mesmo de antes.
 *
 * Tudo que não faz parte do documento da ferramenta em si (breadcrumbs,
 * título, AdSlot, conteúdo explicativo, FAQ, ferramentas relacionadas) é
 * ocultado na impressão (`print:hidden`) — só o conteúdo de `children` deve
 * aparecer ao imprimir/salvar em PDF (ETAPA 2, seção 10).
 */
export function ToolPageTemplate({
  tool,
  category,
  children,
  contentSections,
  faq,
  relatedToolsHeading = "Ferramentas relacionadas",
  relatedToolsLimit = 3,
}: {
  tool: Tool;
  category: Category;
  children?: React.ReactNode;
  contentSections?: ToolContentSection[];
  faq?: ToolFaqItem[];
  /**
   * Título da seção de ferramentas relacionadas. Só a Calculadora de
   * Financiamento de Veículo usa um título customizado hoje ("Mais
   * ferramentas para financiamento de veículos", cluster de Financiamento
   * de Veículos — ver app/utilitarios/[categoria]/[ferramenta]/page.tsx) —
   * o padrão ("Ferramentas relacionadas") continua igual para todas as
   * outras páginas.
   */
  relatedToolsHeading?: string;
  /** Quantas ferramentas relacionadas mostrar (padrão: 3, igual a getRelatedTools). */
  relatedToolsLimit?: number;
}) {
  const relatedTools = getRelatedTools(tool, relatedToolsLimit);

  return (
    <div className="py-8 sm:py-10">
      <div className="print:hidden">
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

        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
          {tool.name}
        </h1>
        <p className="mt-2 max-w-2xl text-base text-zinc-600">
          {tool.pageDescription ?? tool.description}
        </p>
      </div>

      <div className="mt-6">{children ?? <ComingSoonNotice toolName={tool.name} />}</div>

      <div className="mt-8 print:hidden">
        <AdSlot />
      </div>

      <div className="print:hidden">
        {contentSections ? (
          contentSections.map((section) => (
            <section key={section.title} className="mt-10">
              <SectionHeading title={section.title} />
              <p className="text-sm leading-relaxed text-zinc-700">
                {section.body}
              </p>
            </section>
          ))
        ) : (
          <section className="mt-10">
            <SectionHeading title="Como funciona" />
            <p className="text-sm leading-relaxed text-zinc-700">
              Assim que estiver disponível, a ferramenta {tool.shortName} vai
              pedir as informações necessárias em um formulário simples,
              calcular o resultado diretamente no seu navegador e mostrar o
              detalhamento completo do cálculo logo abaixo do resultado
              principal.
            </p>
          </section>
        )}

        <section className="mt-8">
          <SectionHeading title="Perguntas frequentes" />
          <dl className="space-y-4">
            {(
              faq ?? [
                {
                  question: "Quando esta ferramenta estará disponível?",
                  answer:
                    "Estamos organizando o catálogo do ALILU Utilitários e implementando as ferramentas por etapas. Volte em breve para conferir.",
                },
                {
                  question: "Vai ser gratuita?",
                  answer:
                    "Sim. Todas as ferramentas do ALILU Utilitários são e continuarão sendo gratuitas para uso.",
                },
                {
                  question: "Preciso me cadastrar para usar?",
                  answer:
                    "Não. As calculadoras do ALILU Utilitários são feitas para uso imediato, sem necessidade de cadastro.",
                },
              ]
            ).map((item) => (
              <div key={item.question}>
                <dt className="font-medium text-zinc-900">{item.question}</dt>
                <dd className="mt-1 text-sm text-zinc-600">{item.answer}</dd>
              </div>
            ))}
          </dl>
        </section>

        {relatedTools.length > 0 ? (
          <section className="mt-10">
            <SectionHeading title={relatedToolsHeading} as="h2" />
            <ToolGrid tools={relatedTools} />
          </section>
        ) : null}
      </div>
    </div>
  );
}
