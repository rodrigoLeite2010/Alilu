import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { AdSlot } from "@/components/ui/AdSlot";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { HomeHero } from "@/components/home/HomeHero";
import { CategoryGrid } from "@/components/home/CategoryGrid";
import { FeaturedTools } from "@/components/home/FeaturedTools";
import { InstagramHighlight } from "@/components/home/InstagramHighlight";
import { FinanceHighlight } from "@/components/home/FinanceHighlight";
import { PdfHighlight } from "@/components/home/PdfHighlight";
import { BenefitsSection } from "@/components/home/BenefitsSection";
import { HomeCTA } from "@/components/home/HomeCTA";

export const metadata: Metadata = buildPageMetadata({
  title: "Alilu — Ferramentas Online Grátis: PDF, Financeiro e Instagram",
  description:
    "Ferramentas online gratuitas para PDF, finanças, Instagram, geradores, validadores e utilidades do dia a dia. Use direto pelo navegador.",
  path: "/",
  keywords: [
    "ferramentas online gratuitas",
    "pdf online",
    "calculadora financeira",
    "criar post instagram",
    "gerador de cpf",
  ],
});

/**
 * Home reformulada (ver claude/nova-home-relatorio.md no projeto): em vez
 * de só listar categorias, a página responde em poucos segundos "o que é
 * o Alilu, o que dá pra fazer aqui e por onde começar" — Hero + busca,
 * categorias, ferramentas populares e destaques dedicados a Instagram,
 * Financeiro e PDF, nessa ordem (Utilidades em primeiro plano, antes dos
 * destaques específicos). Todo o conteúdo vem dos catálogos já existentes
 * (data/tools.ts, data/categories.ts, data/instagram.ts) — nada é
 * inventado aqui.
 */
export default function HomePage() {
  return (
    <>
      <HomeHero />

      <Container className="py-12 sm:py-16" id="categorias">
        <SectionHeading
          title="Categorias"
          description="Escolha uma área e encontre a ferramenta certa para o seu problema."
        />
        <CategoryGrid />
      </Container>

      <FeaturedTools />
      <InstagramHighlight />
      <FinanceHighlight />
      <PdfHighlight />
      <BenefitsSection />

      <Container className="py-10">
        <AdSlot />
      </Container>

      <HomeCTA />
    </>
  );
}
