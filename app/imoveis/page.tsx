import { buildPageMetadata } from "@/lib/seo/metadata";
import { PropertySearch } from "@/components/imoveis/PropertySearch";
import { settings } from "@/lib/imoveis/repository";
import { toParams, parseFilters } from "@/lib/imoveis/model";
export const dynamic = "force-dynamic";
type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
export async function generateMetadata({ searchParams }: Props) {
  const p = toParams(await searchParams),
    page = parseFilters(p).page;
  const filtered = [...p.keys()].some((k) => k !== "page");
  return buildPageMetadata({
    title: `Imóveis para venda e aluguel${page > 1 ? ` — Página ${page}` : ""}`,
    description:
      "Encontre seu próximo imóvel na Alilu. Casas, apartamentos e terrenos para venda, aluguel e temporada. Anuncie gratuitamente.",
    path: `/imoveis${page > 1 ? `?page=${page}` : ""}`,
    robots: filtered ? { index: false, follow: true } : undefined,
  });
}
export default async function Page({ searchParams }: Props) {
  return (
    <PropertySearch
      params={toParams(await searchParams)}
      config={await settings()}
    />
  );
}
