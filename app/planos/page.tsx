import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { PlansPanel } from "@/components/billing/PlansPanel";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { SITE_NAME } from "@/lib/seo/site";
import { LinkButton } from "@/components/ui/Button";
import { CAROUSEL_FREE_TRIAL, EXISTING_CUSTOMER_DISCOUNT_PERCENT, listCarouselPlans } from "@/lib/carousel/carousel-plans";

const brl = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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
        cobrem a IA mais cara, como vídeo. O Carrossel Inteligente é uma assinatura separada, explicada mais abaixo.
      </p>
      <div className="mt-6">
        <PlansPanel />
      </div>

      <section id="carrossel-inteligente" aria-labelledby="carrossel-planos" className="mt-10 rounded-xl border border-zinc-200 p-4 sm:p-6">
        <h2 id="carrossel-planos" className="text-lg font-semibold text-zinc-900">
          Carrossel Inteligente (assinatura separada)
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-zinc-600">
          Cria carrosséis completos com IA: tema, texto com pesquisa, fotos, modelo visual, legenda e publicação. Funciona de forma manual e também
          dentro do Piloto Automático (formato &quot;Carrossel Inteligente&quot;). A cota do Carrossel Inteligente é independente da cota do Piloto.
        </p>
        <ul className="mt-3 space-y-1 text-sm text-zinc-700">
          <li>
            <strong>{CAROUSEL_FREE_TRIAL.carousels === 1 ? "1 carrossel grátis" : `${CAROUSEL_FREE_TRIAL.carousels} carrosséis grátis`}</strong> para experimentar, sem
            cartão.
          </li>
          <li>
            <strong>{EXISTING_CUSTOMER_DISCOUNT_PERCENT}% de desconto</strong> para quem já assina o Piloto Automático (aplicado automaticamente).
          </li>
        </ul>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {listCarouselPlans().map((plan) => (
            <li key={plan.code} className="rounded-lg border border-zinc-200 p-3 text-sm">
              <p className="font-semibold text-zinc-900">{plan.name}</p>
              <p className="mt-1 text-zinc-800">{brl(plan.priceCents)}/mês</p>
              <p className="mt-1 text-zinc-600">
                {plan.carouselsPerCycle} carrosséis por ciclo · {plan.maxProfiles} {plan.maxProfiles === 1 ? "perfil" : "perfis"} do Instagram
              </p>
            </li>
          ))}
        </ul>
        <LinkButton href="/instagram/carrossel-inteligente/planos" className="mt-4">
          Ver planos do Carrossel Inteligente
        </LinkButton>
      </section>
    </Container>
  );
}
