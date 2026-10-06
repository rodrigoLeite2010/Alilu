import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { PlansPanel } from "@/components/billing/PlansPanel";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { SITE_NAME } from "@/lib/seo/site";

export const metadata: Metadata = buildPageMetadata({
  title: "Planos e assinatura",
  description: `Veja os planos do ${SITE_NAME}: Piloto Automático do Instagram a partir de R$ 19/mês, com ou sem IA, e créditos para recursos de IA avançados. As ferramentas continuam grátis.`,
  path: "/planos",
});

/** Planos e assinatura — pública: quem não entrou vê tudo e é convidado a entrar para assinar. */
export default function PlansPage() {
  return (
    <Container className="max-w-5xl py-8 sm:py-10">
      <Breadcrumbs
        items={[
          { name: "Início", path: "/" },
          { name: "Planos", path: "/planos" },
        ]}
      />
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">Planos e assinatura</h1>
      <p className="mt-2 max-w-2xl text-sm text-zinc-600 sm:text-base">
        As ferramentas do {SITE_NAME} são grátis. A assinatura é para quem quer o Piloto Automático publicando no Instagram por você; os créditos
        cobrem a IA mais cara, como vídeo.
      </p>
      <div className="mt-6">
        <PlansPanel />
      </div>
    </Container>
  );
}
