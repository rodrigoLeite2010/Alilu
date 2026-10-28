import { notFound } from "next/navigation";
import { cities, settings } from "@/lib/imoveis/repository";
import { slugify } from "@/lib/imoveis/model";
import { PropertySearch } from "@/components/imoveis/PropertySearch";
import { buildPageMetadata } from "@/lib/seo/metadata";
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ state: string; city: string }> };
async function location(params: Props["params"]) {
  const { state, city } = await params;
  return (await cities()).find(
    (c) => c.state.toLowerCase() === state && slugify(c.city) === city,
  );
}
export async function generateMetadata({ params }: Props) {
  const c = await location(params);
  if (!c) return { robots: { index: false } };
  return buildPageMetadata({
    title: `Imóveis em ${c.city} / ${c.state}`,
    description: `Veja os imóveis anunciados em ${c.city}, ${c.state}, para venda, aluguel e temporada na Alilu.`,
    path: `/imoveis/cidade/${c.state.toLowerCase()}/${slugify(c.city)}`,
  });
}
export default async function Page({ params }: Props) {
  const c = await location(params);
  if (!c) notFound();
  return (
    <PropertySearch
      params={new URLSearchParams({ state: c.state, city: c.city })}
      config={await settings()}
      cityHeading={`Encontre seu imóvel em ${c.city}.`}
    />
  );
}
