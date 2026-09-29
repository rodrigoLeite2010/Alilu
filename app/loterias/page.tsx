import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { AdSlot } from "@/components/ui/AdSlot";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { LOTTERIES_CATEGORY, lotteryModalities } from "@/data/lotteries";

export const metadata: Metadata = buildPageMetadata({
  title: LOTTERIES_CATEGORY.metaTitle,
  description: LOTTERIES_CATEGORY.metaDescription,
  path: LOTTERIES_CATEGORY.path,
});

const activeModalities = lotteryModalities.filter((modality) => modality.status === "ativo");
const plannedModalities = lotteryModalities.filter((modality) => modality.status === "em-breve");

export default function LotteriesCategoryPage() {
  return (
    <Container className="py-8 sm:py-10">
      <Breadcrumbs
        items={[
          { name: "Início", path: "/" },
          { name: LOTTERIES_CATEGORY.shortName, path: LOTTERIES_CATEGORY.path },
        ]}
      />

      <section className="rounded-lg border border-teal-200 bg-teal-50/50 p-5 sm:p-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">{LOTTERIES_CATEGORY.title}</h1>
        <p className="mt-2 max-w-2xl text-base text-zinc-600">{LOTTERIES_CATEGORY.subtitle}</p>
      </section>

      <section className="mt-10">
        <SectionHeading
          title="Gerador estatístico por modalidade"
          description="Grátis, sem cadastro e sem baixar nada. Nenhuma ferramenta aqui prevê resultado de sorteio nem garante prêmio."
        />
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {activeModalities.map((modality) => (
            <li key={modality.id}>
              <Link
                href={modality.path}
                className="group flex h-full flex-col gap-3 rounded-lg border border-teal-300 bg-teal-50/30 p-4 transition-colors hover:border-teal-700/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white text-zinc-700 transition-colors group-hover:bg-teal-100 group-hover:text-teal-800">
                    <Icon name={modality.icon} className="h-5 w-5" />
                  </span>
                  <Badge tone="brand">Grátis</Badge>
                </div>
                <div>
                  <p className="font-semibold text-zinc-900 group-hover:text-teal-800">{modality.shortName}</p>
                  <p className="mt-1 text-sm text-zinc-600">{modality.description}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-8">
        <AdSlot />
      </div>

      <section className="mt-10">
        <SectionHeading title="Como funciona" as="h2" />
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-zinc-700">
          <li>Escolha a modalidade de loteria — por enquanto, a Lotofácil está disponível.</li>
          <li>
            Escolha um modo de geração (Aleatório, Equilibrado ou Personalizado), quantos números marcar na aposta
            e quantos jogos gerar de uma vez.
          </li>
          <li>Copie os números gerados ou baixe todos em um arquivo CSV — de graça e sem login.</li>
        </ol>
      </section>

      <section className="mt-10">
        <SectionHeading title="Importante" as="h2" />
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p>
            As ferramentas desta categoria são geradores estatísticos e organizacionais de jogos — não previsores
            de resultado. Nenhuma combinação de números tem mais chance matemática de ser sorteada do que outra.
            Jogue com responsabilidade.
          </p>
        </div>
      </section>

      {plannedModalities.length > 0 ? (
        <section className="mt-10">
          <SectionHeading
            title="O que vem por aí"
            description="Outras modalidades planejadas para esta categoria — ainda em desenvolvimento, sem previsão exata de lançamento."
            as="h2"
          />
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {plannedModalities.map((modality) => (
              <li
                key={modality.id}
                className="flex items-start gap-3 rounded-lg border border-dashed border-zinc-300 bg-zinc-50/70 p-4"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-500">
                  <Icon name={modality.icon} className="h-4 w-4" />
                </span>
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold text-zinc-800">
                    {modality.shortName}
                    <Badge tone="neutral">Em breve</Badge>
                  </p>
                  <p className="mt-1 text-xs text-zinc-600">{modality.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </Container>
  );
}
