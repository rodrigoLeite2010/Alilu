import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { ToolGrid } from "@/components/tools/ToolGrid";
import { categories, getCategoryById } from "@/data/categories";
import { getToolsByCategory } from "@/data/tools";
import { buildPageMetadata } from "@/lib/seo/metadata";

type CategoryPageProps = {
  params: Promise<{ categoria: string }>;
};

export function generateStaticParams() {
  return categories.map((category) => ({ categoria: category.id }));
}

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { categoria } = await params;
  const category = getCategoryById(categoria);

  if (!category) {
    return {};
  }

  return buildPageMetadata({
    title: category.name,
    description: category.description,
    path: `/utilitarios/${category.id}`,
  });
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { categoria } = await params;
  const category = getCategoryById(categoria);

  if (!category) {
    notFound();
  }

  const toolsInCategory = getToolsByCategory(category.id);

  return (
    <Container className="py-8 sm:py-10">
      <Breadcrumbs
        items={[
          { name: "Início", path: "/" },
          { name: "Utilitários", path: "/utilitarios" },
          { name: category.name, path: `/utilitarios/${category.id}` },
        ]}
      />
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-50">
        {category.name}
      </h1>
      <p className="mt-2 max-w-2xl text-base text-zinc-600 dark:text-zinc-400">
        {category.description}
      </p>

      <div className="mt-6">
        <ToolGrid tools={toolsInCategory} />
      </div>
    </Container>
  );
}
