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
    "Organize combinações da Lotofácil. O fechamento reduzido só garante acerto parcial se as 15 dezenas sorteadas estiverem no grupo escolhido. Não prevê prêmios.",
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
    title: "Exemplo: o que significa a garantia condicional",
    body: "Com um grupo de 18 dezenas, o fechamento reduzido gera 6 jogos de 15 dezenas e assegura pelo menos 13 acertos em um deles somente se todas as 15 dezenas sorteadas estiverem nas 18 escolhidas. Se alguma dezena sorteada ficar fora do grupo, essa garantia deixa de valer. Confira a quantidade de jogos e a condição exibida no resultado antes de usar as combinações. A ferramenta não faz apostas nem garante lucro.",
  },
  {
    title: "O que essas ferramentas NÃO fazem",
    body: "Cada combinação de 15 números continua tendo a mesma chance: 1 em 3.268.760. Cobrir mais combinações distintas aumenta a chance total e também o custo das apostas; o algoritmo não torna uma combinação mais provável. O fechamento reduzido só oferece uma cobertura parcial, condicionada a todas as dezenas sorteadas estarem no grupo escolhido. Essa condição não é garantida.",
  },
];

const faq = [
  {
    question: "Qual a diferença entre o desdobramento completo e o fechamento reduzido?",
    answer:
      "O desdobramento completo gera todas as combinações de 15 números possíveis dentro do grupo escolhido. O fechamento reduzido gera bem menos jogos, mas com uma garantia matemática comprovada de acerto mínimo, caso o sorteio caia inteiro dentro do grupo escolhido.",
  },
  {
    question: "Quando a garantia do fechamento reduzido vale?",
    answer:
      "Somente quando todas as 15 dezenas sorteadas estiverem no grupo escolhido. O resultado informa a cobertura parcial mínima para o tamanho do grupo. Se o sorteio sair desse grupo, a garantia não se aplica. Isso não garante prêmio ou retorno financeiro.",
  },
  {
    question: "Isso aumenta minha chance de ganhar?",
    answer:
      "A ferramenta não prevê o sorteio nem muda a chance de cada combinação. Mais combinações distintas dão maior cobertura, com maior custo. No fechamento reduzido, a cobertura parcial depende de todas as dezenas sorteadas estarem no seu grupo.",
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
          Estas ferramentas organizam combinações e não preveem resultados. Cobrir mais combinações distintas
          aumenta a chance total e o custo, sem melhorar a chance de cada combinação. A garantia do fechamento reduzido só vale se o sorteio cair inteiro
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
