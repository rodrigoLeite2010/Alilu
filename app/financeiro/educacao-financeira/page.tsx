import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { LinkButton } from "@/components/ui/Button";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Educação Financeira: organize seu dinheiro e veja quanto sobra no mês",
  description:
    "Controle de gastos, calendário de contas e previsão de saldo em um só lugar. Cadastre o que você ganha e o que paga e descubra quanto ainda pode gastar até o fim do mês.",
  path: "/financeiro/educacao-financeira",
  keywords: ["educação financeira", "controle de gastos", "orçamento mensal", "calendário financeiro", "contas a pagar"],
});

interface HubCard {
  title: string;
  description: string;
  href?: string;
}

const CARDS: HubCard[] = [
  { title: "Meu orçamento mensal", description: "Renda, contas pagas, contas a vencer e a previsão de saldo no fim do mês.", href: "/financeiro/meu-orcamento" },
  { title: "Calendário financeiro", description: "Cada dia do mês com o que entra e o que vence, para não ser pego de surpresa.", href: "/financeiro/calendario" },
  { title: "Controle de gastos", description: "Cadastre despesas fixas e variáveis, únicas ou recorrentes.", href: "/financeiro/despesas" },
  { title: "Contas a pagar", description: "Próximas contas por dia, com botão para marcar como paga.", href: "/financeiro/meu-orcamento" },
  { title: "Metas financeiras", description: "Quanto guardar por mês para chegar lá.", href: "/financeiro/metas" },
  { title: "Controle de dívidas", description: "Saldo devedor, parcelas e previsão de término.", href: "/financeiro/dividas" },
  { title: "Assinaturas mensais", description: "Quanto você paga por mês e por ano em assinaturas.", href: "/financeiro/assinaturas" },
  { title: "Planejamento anual", description: "Receitas, despesas e saldo mês a mês.", href: "/financeiro/planejamento-anual" },
  { title: "Método 50/30/20", description: "Referência de divisão da renda entre necessidades, desejos e economia.", href: "/financeiro/metodo-50-30-20" },
  { title: "Método dos envelopes", description: "Limites por categoria com barra de progresso.", href: "/financeiro/metodo-envelopes" },
  { title: "Reserva de emergência", description: "Quanto guardar para 3, 6, 9 ou 12 meses de despesas essenciais.", href: "/financeiro/reserva-de-emergencia" },
  { title: "Planilhas financeiras", description: "Modelos para baixar em CSV e XLSX." },
];

const FAQ = [
  {
    q: "Preciso informar senha do banco ou número do cartão?",
    a: "Não. Você digita manualmente quanto ganha e quanto paga. O Alilu não pede senha, não se conecta ao seu banco e não guarda dados de cartão.",
  },
  {
    q: "Outras pessoas veem meus dados?",
    a: "Não. Seus lançamentos ficam ligados à sua conta e só você os acessa depois de entrar. As páginas de orçamento não são indexadas por buscadores.",
  },
  {
    q: "O que significa “quanto posso gastar”?",
    a: "É uma conta simples: seu saldo de hoje, mais o que ainda vai entrar, menos as contas que ainda vencem e a meta de economia. O resultado é uma referência matemática, não uma recomendação financeira.",
  },
  {
    q: "É gratuito?",
    a: "Sim.",
  },
];

export default function EducacaoFinanceiraPage() {
  return (
    <Container className="py-10">
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Educação Financeira</h1>
      <p className="mt-2 max-w-2xl text-base text-zinc-600">
        Organize seu dinheiro, acompanhe suas contas e descubra quanto realmente sobra no fim do mês.
      </p>
      <div className="mt-5">
        <LinkButton href="/financeiro/meu-orcamento">Abrir meu orçamento</LinkButton>
        <p className="mt-2 text-xs text-zinc-500">
          Grátis. Entre com sua conta Google ou receba um código por e-mail — sem cartão, sem senha de banco.
        </p>
      </div>

      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((card) => (
          <li key={card.title} className="rounded-lg border border-zinc-200 bg-white p-4">
            <h2 className="text-base font-semibold text-zinc-900">
              {card.href ? (
                <Link href={card.href} className="hover:text-teal-800 hover:underline">
                  {card.title}
                </Link>
              ) : (
                card.title
              )}
            </h2>
            <p className="mt-1 text-sm text-zinc-600">{card.description}</p>
            {!card.href ? (
              <span className="mt-3 inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">Em breve</span>
            ) : null}
          </li>
        ))}
      </ul>

      <section className="mt-12 max-w-3xl">
        <h2 className="text-xl font-semibold text-zinc-900">Para onde está indo meu dinheiro e quanto ainda posso gastar?</h2>
        <p className="mt-2 text-sm text-zinc-600">
          Cadastre sua renda e suas contas fixas uma única vez: o que se repete todo mês aparece sozinho no painel e no calendário. Em segundos você vê
          o que já recebeu, o que já gastou, o que ainda vence e o valor por dia que sobra até o fim do mês.
        </p>
      </section>

      <section className="mt-10 max-w-3xl">
        <h2 className="text-xl font-semibold text-zinc-900">Perguntas frequentes</h2>
        <dl className="mt-3 space-y-4">
          {FAQ.map((item) => (
            <div key={item.q}>
              <dt className="text-sm font-semibold text-zinc-900">{item.q}</dt>
              <dd className="mt-1 text-sm text-zinc-600">{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </Container>
  );
}
