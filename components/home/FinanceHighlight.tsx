import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { getToolsByIds } from "@/data/tools";

/**
 * Destaque "Organize melhor suas finanças" — mostra algumas ferramentas
 * reais da categoria "financeiro" (data/tools.ts), na ordem escolhida aqui
 * (não por featureRank), mais o hub de educação financeira já existente em
 * /financeiro/educacao-financeira. Nenhuma ferramenta nova é criada.
 */
const FINANCE_HIGHLIGHT_TOOL_IDS = [
  "financiamento-veiculo",
  "sac-x-price",
  "parcelamento",
  "juros-compostos",
];

export function FinanceHighlight() {
  const highlightTools = getToolsByIds(FINANCE_HIGHLIGHT_TOOL_IDS);

  return (
    <section className="border-b border-brand-primary/10 bg-brand-primary-soft/35">
      <Container className="py-12 sm:py-16">
        <div className="rounded-xl border border-brand-primary/15 bg-white p-6 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-xl">
              <p className="text-sm font-semibold uppercase tracking-wider text-brand-accent-dark">Financeiro</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900">
                Organize melhor suas finanças
              </h2>
              <p className="mt-3 text-zinc-600">
                Simule financiamentos, compare valores e tome decisões com mais informação.
              </p>
              <p className="mt-2 text-sm text-zinc-500">
                Tem também um controle de gastos e calendário financeiro — esses exigem login para salvar seus
                dados, mas nunca pedem senha do banco nem número de cartão.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <LinkButton href="/utilitarios/financeiro">Ver ferramentas financeiras</LinkButton>
                <LinkButton href="/financeiro/educacao-financeira" variant="secondary">
                  Educação financeira
                </LinkButton>
              </div>
            </div>
            <ul className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:w-auto lg:min-w-[19rem]">
              {highlightTools.map((tool) => (
                <li key={tool.id}>
                  <Link
                    href={`/utilitarios/${tool.category}/${tool.slug}`}
                    className="flex h-full items-center gap-2.5 rounded-lg border border-zinc-200 bg-zinc-50/60 px-3 py-2.5 text-sm font-medium text-zinc-800 transition-colors hover:border-brand-primary/40 hover:text-brand-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
                  >
                    <Icon name={tool.icon} className="h-4 w-4 shrink-0 text-brand-primary" />
                    {tool.shortName}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Container>
    </section>
  );
}
