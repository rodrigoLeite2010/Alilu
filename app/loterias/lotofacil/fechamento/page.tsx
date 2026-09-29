import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { AdSlot } from "@/components/ui/AdSlot";
import { FaqJsonLd } from "@/components/seo/FaqJsonLd";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { LOTTERIES_CATEGORY, lotteryModalities } from "@/data/lotteries";
import { LotofacilWheeling } from "@/components/lotteries/LotofacilWheeling";
import { FULL_WHEEL_MAX_NUMBERS, REDUCED_WHEEL_MAX_NUMBERS, WHEEL_MIN_NUMBERS } from "@/lib/lotteries/wheeling";

const modality = lotteryModalities.find((item) => item.id === "lotofacil")!;

export const metadata: Metadata = buildPageMetadata({
  title: "Desdobramento e Fechamento Reduzido da Lotofácil — Grátis | ALILU",
  description:
    "Monte o desdobramento completo (todas as combinações) ou o fechamento reduzido (com garantia matemática comprovada de acerto mínimo) de um grupo de 16 a 20 números da Lotofácil.",
  path: `${modality.path}/fechamento`,
  keywords: [
    "desdobramento lotofácil",
    "fechamento lotofácil",
    "fechamento reduzido lotofácil",
    "wheeling lotofácil",
    "garantia de pontos lotofácil",
  ],
});

const contentSections = [
  {
    title: "Desdobramento completo x fechamento reduzido",
    body: 'O desdobramento completo gera TODAS as combinações de 15 números possíveis dentro do grupo que você escolher (de 16 a 18 números) — é a cobertura total, sem nenhuma garantia "extra" além da cobertura matemática normal (a mesma que já existe ao apostar mais números no gerador comum). O fechamento reduzido usa MUITO menos jogos (de 16 a 20 números), mas com uma garantia matemática real e comprovada: se as 15 dezenas sorteadas estiverem todas entre os números que você escolheu, pelo menos um dos jogos gerados vai acertar uma quantidade mínima de pontos.',
  },
  {
    title: "Como a garantia do fechamento reduzido é comprovada",
    body: "Não é uma estimativa nem uma promessa de marketing: a fórmula que gera os jogos do fechamento reduzido é verificada, nos testes automatizados deste projeto, testando TODOS os sorteios possíveis dentro de cada grupo de números (não uma amostra) — para grupos de 16 a 20 números, cada um dos milhares de sorteios possíveis é conferido individualmente contra os jogos gerados, confirmando que a garantia prometida nunca falha.",
  },
  {
    title: "O que essas ferramentas NÃO fazem",
    body: "Nenhuma das duas aumenta a chance matemática de acertar as 15 dezenas sorteadas — cada combinação de 15 números continua tendo exatamente a mesma chance, sempre 1 em 3.268.760. O desdobramento só muda quantas combinações a sua aposta cobre ao mesmo tempo, e o fechamento reduzido só garante um acerto PARCIAL mínimo, condicionado ao sorteio ter caído inteiro dentro do grupo que você escolheu — o que não é garantido de acontecer.",
  },
];

const faq = [
  {
    question: "Qual a diferença entre o desdobramento completo e o fechamento reduzido?",
    answer:
      "O desdobramento completo gera todas as combinações de 15 números possíveis dentro do grupo escolhido. O fechamento reduzido gera bem menos jogos, mas com uma garantia matemática comprovada de acerto mínimo, caso o sorteio caia inteiro dentro do grupo escolhido.",
  },
  {
    question: "A garantia do fechamento reduzido é real ou só uma estimativa?",
    answer:
      "É real e comprovada por computação: os testes automatizados deste projeto verificam TODOS os sorteios possíveis dentro de cada grupo de números (não uma amostra), confirmando que pelo menos um dos jogos gerados sempre atinge a garantia prometida.",
  },
  {
    question: "Isso aumenta minha chance de ganhar?",
    answer:
      "Não. Nenhuma ferramenta muda a chance matemática de uma combinação de 15 números ser sorteada. O desdobramento e o fechamento reduzido só organizam quantas combinações você cobre (ou qual garantia de acerto parcial você tem) ao apostar em mais de 15 números — não previsão de resultado.",
  },
  {
    question: "Por que o desdobramento completo tem um limite de 18 números?",
    answer:
      "Porque acima disso a quantidade de jogos cresce demais para listar, copiar ou baixar de forma prática (com 19 números já são 3.876 jogos, e com 20, mais de 15 mil). O fechamento reduzido não tem esse problema, porque usa muito menos jogos — por isso vai até 20 números.",
  },
];

export default function LotofacilFechamentoPage() {
  return (
    <Container className="py-8 sm:py-10">
      <div className="print:hidden">
        <FaqJsonLd faq={faq} />
        <Breadcrumbs
          items={[
            { name: "Início", path: "/" },
            { name: LOTTERIES_CATEGORY.shortName, path: LOTTERIES_CATEGORY.path },
            { name: modality.shortName, path: modality.path },
            { name: "Desdobramento e fechamento", path: `${modality.path}/fechamento` },
          ]}
        />

        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
          Desdobramento e Fechamento Reduzido da Lotofácil
        </h1>
        <p className="mt-2 max-w-2xl text-base text-zinc-600">
          Escolha de {WHEEL_MIN_NUMBERS} a {REDUCED_WHEEL_MAX_NUMBERS} números e monte o desdobramento completo (até{" "}
          {FULL_WHEEL_MAX_NUMBERS} números) ou o fechamento reduzido com garantia matemática comprovada — grátis e
          sem cadastro.
        </p>
      </div>

      <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 print:hidden">
        <p className="font-semibold">Importante</p>
        <p className="mt-1">
          Estas ferramentas organizam sua aposta, mas não aumentam a chance matemática de acertar as 15 dezenas
          sorteadas nem preveem resultado. A garantia do fechamento reduzido só vale se o sorteio cair inteiro
          dentro do grupo de números que você escolher — o que não é garantido de acontecer. Jogue com
          responsabilidade.
        </p>
      </div>

      <div className="mt-6">
        <LotofacilWheeling />
      </div>

      <div className="mt-8 print:hidden">
        <AdSlot />
      </div>

      <div className="print:hidden">
        {contentSections.map((section) => (
          <section key={section.title} className="mt-10">
            <SectionHeading title={section.title} />
            <p className="text-sm leading-relaxed text-zinc-700">{section.body}</p>
          </section>
        ))}

        <section className="mt-10">
          <SectionHeading title="Perguntas frequentes" />
          <dl className="space-y-4">
            {faq.map((item) => (
              <div key={item.question}>
                <dt className="font-medium text-zinc-900">{item.question}</dt>
                <dd className="mt-1 text-sm text-zinc-600">{item.answer}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-10">
          <SectionHeading title="Continue explorando" as="h2" />
          <p className="text-sm text-zinc-600">
            Volte para o{" "}
            <Link href={modality.path} className="font-medium text-teal-800 hover:underline">
              gerador normal da Lotofácil
            </Link>{" "}
            ou veja as{" "}
            <Link href={LOTTERIES_CATEGORY.path} className="font-medium text-teal-800 hover:underline">
              outras modalidades de loteria
            </Link>
            .
          </p>
        </section>
      </div>
    </Container>
  );
}
