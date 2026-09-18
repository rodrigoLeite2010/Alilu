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
    title: tool.name,
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

  return (
    <Container>
      <ToolPageTemplate
        tool={tool}
        category={category}
        contentSections={content?.contentSections}
        faq={content?.faq}
      >
        {ToolComponent ? <ToolComponent /> : undefined}
      </ToolPageTemplate>
    </Container>
  );
}
