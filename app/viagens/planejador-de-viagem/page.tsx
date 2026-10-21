import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { FaqJsonLd } from "@/components/seo/FaqJsonLd";
import { TravelPlanner } from "@/components/viagens/TravelPlanner";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { SITE_URL } from "@/lib/seo/site";
import { travelTools, travelFaq, travelGuides } from "@/data/viagens";
const tool = travelTools[0];
const title = "Planejador de Viagem Grátis | Calcule Combustível, Pedágios e Gastos — Alilu";
export const metadata = { ...buildPageMetadata({ title, description: tool.description, path: tool.path, keywords: [...tool.keywords] }), title: { absolute: title } };
export default function PlannerPage() {
  return <Container className="py-6 sm:py-8"><div className="print:hidden"><Breadcrumbs items={[{ name: "Início", path: "/" }, { name: "Viagens", path: "/viagens" }, { name: tool.shortName, path: tool.path }]} /><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{tool.name}</h1><p className="mb-6 mt-2 max-w-3xl text-zinc-600">Calcule combustível, informe pedágios e despesas, organize o checklist e monte um roteiro por dia. Os resultados mudam conforme você preenche.</p></div><TravelPlanner /><section className="mt-10 space-y-4 print:hidden"><h2 className="text-xl font-semibold">Perguntas frequentes</h2><dl className="space-y-5">{travelFaq.map(f => <div key={f.question}><dt className="font-semibold text-zinc-900">{f.question}</dt><dd className="mt-1 text-sm leading-relaxed text-zinc-600">{f.answer}</dd></div>)}</dl><FaqJsonLd faq={travelFaq} /><h2 className="pt-5 text-xl font-semibold">Aprofunde seu planejamento</h2><ul className="grid gap-3 sm:grid-cols-2">{travelGuides.map(g => <li key={g.slug}><Link className="text-sm text-brand-primary underline" href={`/viagens/${g.slug}`}>{g.title}</Link></li>)}</ul></section><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "WebApplication", name: tool.name, url: `${SITE_URL}${tool.path}`, applicationCategory: "TravelApplication", operatingSystem: "Web browser", inLanguage: "pt-BR", offers: { "@type": "Offer", price: "0", priceCurrency: "BRL" } }) }} /></Container>;
}
