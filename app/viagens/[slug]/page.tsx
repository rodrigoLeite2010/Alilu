import { notFound } from "next/navigation";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { LinkButton } from "@/components/ui/Button";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { travelGuides } from "@/data/viagens";
export const dynamicParams = false;
export function generateStaticParams() { return travelGuides.map(g => ({ slug: g.slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params, guide = travelGuides.find(g => g.slug === slug); if (!guide) notFound();
  return buildPageMetadata({ title: guide.title, description: guide.description, path: `/viagens/${slug}` });
}
export default async function TravelGuide({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params, guide = travelGuides.find(g => g.slug === slug); if (!guide) notFound();
  return <Container className="py-8 sm:py-10"><Breadcrumbs items={[{ name: "Início", path: "/" }, { name: "Viagens", path: "/viagens" }, { name: guide.title, path: `/viagens/${slug}` }]} /><article className="max-w-3xl"><h1 className="text-3xl font-bold">{guide.title}</h1><p className="mt-3 text-lg text-zinc-600">{guide.description}</p><div className="my-6"><LinkButton href={`/viagens/planejador-de-viagem?aba=${guide.tab}`}>Usar o planejador gratuito</LinkButton></div>{guide.paragraphs.map(p => <p key={p} className="mt-5 leading-relaxed text-zinc-700">{p}</p>)}<h2 className="mt-8 text-xl font-semibold">Continue organizando sua viagem</h2><ul className="mt-4 space-y-3">{travelGuides.filter(g => g.slug !== slug).map(g => <li key={g.slug}><Link href={`/viagens/${g.slug}`} className="text-brand-primary underline">{g.title}</Link></li>)}</ul></article></Container>;
}
