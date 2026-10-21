import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { Icon } from "@/components/ui/Icon";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { travelTools, travelGuides, VIAGENS_CATEGORY } from "@/data/viagens";
export const metadata = buildPageMetadata({ title: "Viagens: planejamento, combustível e checklist", description: VIAGENS_CATEGORY.description, path: VIAGENS_CATEGORY.path });
export default function TravelCategory() {
  return <Container className="py-8 sm:py-10"><Breadcrumbs items={[{ name: "Início", path: "/" }, { name: VIAGENS_CATEGORY.name, path: VIAGENS_CATEGORY.path }]} /><h1 className="text-3xl font-bold text-zinc-900">Viagens</h1><p className="mt-3 max-w-2xl text-zinc-600">Da primeira conta à mala pronta: organize os custos e os dias da sua próxima viagem usando os seus valores. Você pode começar sem cadastro.</p><div className="mt-6 grid gap-4 sm:grid-cols-2">{travelTools.map(t => <Link key={t.id} href={t.path} className="rounded-xl border border-brand-primary/20 bg-white p-6 transition hover:bg-brand-primary-soft"><Icon name={t.icon} className="mb-3 h-7 w-7 text-brand-primary" /><h2 className="text-xl font-semibold text-brand-primary">{t.name}</h2><p className="mt-2 text-sm text-zinc-600">{t.description}</p><p className="mt-4 font-semibold text-brand-primary">Planejar minha viagem →</p></Link>)}</div><section className="mt-10"><h2 className="text-xl font-semibold">Guias para planejar melhor</h2><ul className="mt-4 grid gap-3 sm:grid-cols-2">{travelGuides.map(g => <li key={g.slug}><Link href={`/viagens/${g.slug}`} className="block rounded-lg border bg-white p-4"><h3 className="font-semibold text-brand-primary">{g.title}</h3><p className="mt-2 text-sm text-zinc-600">{g.description}</p></Link></li>)}</ul></section></Container>;
}
