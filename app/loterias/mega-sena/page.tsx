import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { AdSlot } from "@/components/ui/AdSlot";
import { FaqJsonLd } from "@/components/seo/FaqJsonLd";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { LOTTERIES_CATEGORY, lotteryModalities } from "@/data/lotteries";
import { MegaSenaGenerator } from "@/components/lotteries/MegaSenaGenerator";
import { MegaSenaProbabilityInfo } from "@/components/lotteries/MegaSenaProbabilityInfo";

const modality = lotteryModalities.find((item) => item.id === "mega-sena")!;

export const metadata: Metadata = buildPageMetadata({
  title: `${modality.name} — Grátis e sem cadastro | ALILU`,
  description:
    "Gere jogos da Mega-Sena com filtros de pares/ímpares, números primos e distribuição no volante. Ferramenta estatística e organizacional — não prevê resultado de sorteio.",
  path: modality.path,
  keywords: [
    "gerador mega-sena",
    "gerador de jogos mega-sena",
    "estratégia mega-sena",
    "jogos mega-sena",
    "probabilidade mega-sena",
  ],
});

const contentSections = [
  {
    title: "O que este gerador faz",
    body: "O Gerador Estatístico da Mega-Sena organiza suas apostas com base em critérios matemáticos de composição — como o equilíbrio entre números pares e ímpares, a quantidade de números primos e a distribuição pelo volante. Ele NÃO prevê o resultado do próximo sorteio, não usa nenhum \"algoritmo secreto\" e não garante prêmio: cada combinação de 6 números na Mega-Sena tem exatamente a mesma chance matemática de ser sorteada.",
  },
  {
    title: "Como usar",
    body: "Escolha um modo — Aleatório (números totalmente aleatórios), Equilibrado (aplica filtros de pares/ímpares, primos e distribuição) ou Personalizado (você escolhe números que precisam entrar e números que não podem entrar) —, escolha quantos números marcar na aposta (de 6 a 20) e quantos jogos gerar de uma vez (1, 5, 10, 20 ou 50). Depois é só copiar os números ou baixar tudo em um arquivo CSV.",
  },
  {
    title: "Por que apostar com mais números aumenta a cobertura",
    body: "Marcar mais números não muda a chance de uma combinação específica ser sorteada — mas aumenta quantas combinações de 6 números a sua aposta cobre ao mesmo tempo. Uma aposta com 6 números equivale a 1 combinação; com 7 números, a 7 combinações; com 20 números, a 38.760 combinações simultâneas. É por isso que apostas maiores custam mais: você está comprando mais combinações, não uma combinação \"melhor\".",
  },
];

const faq = [
  {
    question: "Esse gerador prevê os números do próximo sorteio?",
    answer:
      "Não. Nenhuma ferramenta é capaz de prever o resultado de um sorteio da Mega-Sena, porque cada sorteio é um evento aleatório e independente dos anteriores. Este gerador apenas organiza suas apostas com base em critérios estatísticos de composição, como equilíbrio de pares/ímpares e números primos.",
  },
  {
    question: "Quantos números eu posso marcar na aposta?",
    answer:
      "De 6 a 20 números. Quanto mais números você marca, mais combinações de 6 dezenas a sua aposta cobre ao mesmo tempo — e mais cara fica a aposta, já que cada combinação extra é paga separadamente pela Caixa.",
  },
  {
    question: "Qual é a chance de acertar as 6 dezenas com uma aposta simples?",
    answer:
      "1 em 50.063.860, para qualquer combinação de 6 números — inclusive a gerada por esta ferramenta. Esse número vem da combinatória (C(60,6)) e é o mesmo para toda aposta simples de 6 números, sem exceção.",
  },
  {
    question: "Quanto custa uma aposta da Mega-Sena?",
    answer:
      "O valor oficial de uma aposta simples (6 números) é de R$ 6,00. Apostas com mais números custam mais, proporcionalmente à quantidade de combinações de 6 dezenas que passam a cobrir — os valores exatos para cada quantidade de números são definidos pela Caixa e podem mudar, então consulte sempre o valor atual no site oficial da loteria antes de apostar.",
  },
  {
    question: "Números que saíram mais vezes no passado têm mais chance de sair de novo?",
    answer:
      "Não. Cada sorteio da Mega-Sena é independente dos anteriores, então a frequência histórica de uma dezena não muda a probabilidade matemática dela ser sorteada no próximo concurso. Filtros de composição (como pares/ímpares e primos) organizam o jogo, mas não alteram essa probabilidade.",
  },
  {
    question: "O que são os \"números primos\" usados no filtro?",
    answer:
      "São os números que só podem ser divididos por 1 e por eles mesmos. Entre 1 e 60, existem 17 números primos: 2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53 e 59. O filtro de primos é apenas um critério de composição do jogo, sem relação com a chance matemática da combinação sorteada.",
  },
];

export default function MegaSenaGeneratorPage() {
  return (
    <Container className="py-8 sm:py-10">
      <div className="print:hidden">
        <FaqJsonLd faq={faq} />
        <Breadcrumbs
          items={[
            { name: "Início", path: "/" },
            { name: LOTTERIES_CATEGORY.shortName, path: LOTTERIES_CATEGORY.path },
            { name: modality.shortName, path: modality.path },
          ]}
        />

        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">{modality.name}</h1>
        <p className="mt-2 max-w-2xl text-base text-zinc-600">
          Monte jogos organizados por critérios estatísticos — grátis, sem cadastro e sem baixar nada. Esta
          ferramenta não prevê resultados de sorteio nem garante prêmios.
        </p>
      </div>

      <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 print:hidden">
        <p className="font-semibold">Importante</p>
        <p className="mt-1">
          Este é um Gerador Estatístico de Jogos da Mega-Sena, não um previsor de resultados. Nenhuma combinação
          tem mais chance matemática de ser sorteada do que outra. Jogue com responsabilidade.
        </p>
      </div>

      <div className="mt-6">
        <MegaSenaGenerator />
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
          <SectionHeading title="Probabilidade e combinatória" />
          <MegaSenaProbabilityInfo />
        </section>

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
            Também apostando na{" "}
            <Link href="/loterias/lotofacil" className="font-medium text-teal-800 hover:underline">
              Lotofácil
            </Link>
            ? Veja o gerador estatístico dela também, grátis e sem cadastro. Veja também as{" "}
            <Link href={LOTTERIES_CATEGORY.path} className="font-medium text-teal-800 hover:underline">
              outras modalidades de loteria
            </Link>{" "}
            ou volte para o{" "}
            <Link href="/utilitarios" className="font-medium text-teal-800 hover:underline">
              catálogo completo do ALILU Utilitários
            </Link>
            .
          </p>
        </section>
      </div>
    </Container>
  );
}
