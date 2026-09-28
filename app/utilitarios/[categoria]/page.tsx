import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { ToolGrid } from "@/components/tools/ToolGrid";
import { Base64CategoryTools } from "@/components/tools/base64/Base64CategoryTools";
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
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
        {category.name}
      </h1>
      <p className="mt-2 max-w-2xl text-base text-zinc-600">
        {category.description}
      </p>

      {category.id === "financeiro" ? (
        // Central de Educação Financeira: controle mensal, calendário de
        // contas, metas e simuladores — vive fora do catálogo de
        // calculadoras (área privada, dados do usuário), então ganha um
        // banner de destaque em vez de um ToolCard comum.
        <Link
          href="/financeiro/educacao-financeira"
          className="mt-6 flex flex-col gap-1 rounded-lg border border-teal-200 bg-teal-50 p-4 transition-colors hover:bg-teal-100 sm:flex-row sm:items-center sm:justify-between"
        >
          <span>
            <span className="block text-base font-semibold text-teal-900">Novo: Central de Educação Financeira</span>
            <span className="block text-sm text-teal-800">
              Orçamento mensal, calendário de contas, metas e simuladores — descubra quanto ainda pode gastar no mês.
            </span>
          </span>
          <span className="mt-2 inline-flex shrink-0 items-center text-sm font-semibold text-teal-900 sm:mt-0">Abrir →</span>
        </Link>
      ) : null}

      {category.id === "conversor-base64" ? (
        // Com 19 conversores, a categoria ganha busca e divisão entre
        // "Decodificar" e "Converter para" Base64.
        <Base64CategoryTools tools={toolsInCategory} />
      ) : (
        <div className="mt-6">
          <ToolGrid tools={toolsInCategory} />
        </div>
      )}
    </Container>
  );
}
