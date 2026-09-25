import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { ToolPageTemplate } from "@/components/tools/ToolPageTemplate";
import { toolComponents } from "@/components/tools/tool-registry";
import { toolContent } from "@/components/tools/tool-content";
import { getCategoryById } from "@/data/categories";
import { getToolBySlug, tools } from "@/data/tools";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { getToolRobotsMeta } from "@/lib/seo/publish";

type ToolPageProps = {
  params: Promise<{ categoria: string; ferramenta: string }>;
};

export function generateStaticParams() {
  return tools.map((tool) => ({
    categoria: tool.category,
    ferramenta: tool.slug,
  }));
}

export async function generateMetadata({
  params,
}: ToolPageProps): Promise<Metadata> {
  const { categoria, ferramenta } = await params;
  const tool = getToolBySlug(categoria, ferramenta);

  if (!tool) {
    return {};
  }

  return buildPageMetadata({
    title: tool.metaTitle ?? tool.name,
    description: tool.metaDescription ?? tool.description,
    path: `/utilitarios/${tool.category}/${tool.slug}`,
    keywords: tool.keywords,
    robots: getToolRobotsMeta(tool),
  });
}

export default async function ToolPage({ params }: ToolPageProps) {
  const { categoria, ferramenta } = await params;
  const tool = getToolBySlug(categoria, ferramenta);
  const category = getCategoryById(categoria);

  if (!tool || !category) {
    notFound();
  }

  const ToolComponent = toolComponents[tool.id];
  const content = toolContent[tool.id];

  // A Calculadora de Financiamento de Veículo é a "porta de entrada" do
  // cluster de Financiamento de Veículos (docs/PROMPT_MESTRE_ALILU.md não
  // documenta isso — ver o comentário em data/tools.ts, campo relatedTools
  // desta ferramenta): sua página, já indexada, ganha uma seção de
  // ferramentas relacionadas com título e quantidade customizados, sem
  // mudar URL, H1, metadata ou qualquer outro dado indexado. Todas as
  // outras páginas continuam com o padrão de ToolPageTemplate.
  const isVehicleFinancingEntryPoint = tool.id === "financiamento-veiculo";

  return (
    <Container>
      <ToolPageTemplate
        tool={tool}
        category={category}
        contentSections={content?.contentSections}
        faq={content?.faq}
        relatedToolsHeading={
          isVehicleFinancingEntryPoint ? "Mais ferramentas para financiamento de veículos" : undefined
        }
        relatedToolsLimit={isVehicleFinancingEntryPoint ? tool.relatedTools.length : undefined}
      >
        {ToolComponent ? <ToolComponent /> : undefined}
      </ToolPageTemplate>
    </Container>
  );
}
