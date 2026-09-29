import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Container } from "@/components/ui/Container";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { AdSlot } from "@/components/ui/AdSlot";
import { FaqJsonLd } from "@/components/seo/FaqJsonLd";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { LOTTERIES_CATEGORY, lotteryModalities } from "@/data/lotteries";
import { LotomaniaGenerator } from "@/components/lotteries/LotomaniaGenerator";
import { LotomaniaProbabilityInfo } from "@/components/lotteries/LotomaniaProbabilityInfo";

const modality = lotteryModalities.find((item) => item.id === "lotomania")!;

export const metadata: Metadata = buildPageMetadata({
  title: `${modality.name} — Grátis e sem cadastro | ALILU`,
  description:
    "Gere jogos da Lotomania (aposta fixa de 50 números, de 00 a 99) com filtros de pares/ímpares, primos e distribuição no volante. Ferramenta estatística e organizacional — não prevê resultado de sorteio.",
  path: modality.path,
  keywords: [
    "gerador lotomania",
    "gerador de jogos lotomania",
    "estratégia lotomania",
    "jogos lotomania",
    "probabilidade lotomania",
  ],
});

const contentSections = [
  {
    title: "O que este gerador faz",
    body: "O Gerador Estatístico da Lotomania organiza suas apostas com base em critérios matemáticos de composição — como o equilíbrio entre números pares e ímpares, a quantidade de números primos e a distribuição pelo volante. Ele NÃO prevê o resultado do próximo sorteio, não usa nenhum \"algoritmo secreto\" e não garante prêmio: cada combinação de 50 números na Lotomania tem exatamente a mesma chance matemática de ser sorteada.",
  },
  {
    title: "Como usar",
    body: "Escolha um modo — Aleatório (números totalmente aleatórios), Equilibrado (aplica filtros de pares/ímpares, primos e distribuição) ou Personalizado (você escolhe números que precisam entrar e números que não podem entrar) — e quantos jogos gerar de uma vez (1, 5, 10, 20 ou 50). Diferente das outras modalidades, não há quantidade de dezenas para escolher: a aposta da Lotomania é sempre fixa em 50 números. Depois é só copiar os números ou baixar tudo em um arquivo CSV.",
  },
  {
    title: "Por que a aposta é sempre de 50 números",
    body: "Ao contrário da Lotofácil, da Mega-Sena e da Quina — onde você escolhe quantos números marcar dentro de uma faixa, e o preço muda conforme a quantidade —, a Lotomania tem um formato fixo: toda aposta simples marca exatamente 50 números, metade do volante de 00 a 99. Não existe aposta \"maior\" ou \"menor\" aqui, nem preço que varia por quantidade de dezenas escolhidas — o valor da aposta é único, mas consulte sempre o valor atual no site oficial da loteria antes de apostar, já que a Caixa pode reajustá-lo a qualquer momento.",
  },
];

const faq = [
  {
    question: "Esse gerador prevê os números do próximo sorteio?",
    answer:
      "Não. Nenhuma ferramenta é capaz de prever o resultado de um sorteio da Lotomania, porque cada sorteio é um evento aleatório e independente dos anteriores. Este gerador apenas organiza suas apostas com base em critérios estatísticos de composição, como equilíbrio de pares/ímpares e números primos.",
  },
  {
    question: "Por que eu marco sempre 50 números, sem escolher a quantidade?",
    answer:
      "Porque essa é a regra da Lotomania: diferente da Lotofácil, da Mega-Sena e da Quina, aqui não existe faixa de escolha — toda aposta simples marca exatamente 50 dos 100 números do volante (00 a 99), sempre a metade. Por isso este gerador não tem um seletor de \"quantidade de dezenas\": não há o que escolher.",
  },
  {
    question: "Quantos números são sorteados?",
    answer:
      "20 números, entre 00 e 99, em cada concurso.",
  },
  {
    question: "Por que ganhar acertando ZERO números também é um prêmio?",
    answer:
      "É uma simetria matemática real, não um bônus arbitrário. Como você marca exatamente metade do volante (50 de 100 números), os 20 números sorteados caem ou majoritariamente entre os seus marcados, ou majoritariamente entre os 50 que você deixou de fora — e a chance de acertar os 20 sorteados é exatamente igual à chance de não acertar nenhum deles (1 em 11.372.635 nos dois casos). É uma curiosidade honesta da combinatória do jogo, explicada em detalhe na seção de probabilidade desta página — não uma dica para \"prever\" nada.",
  },
  {
    question: "Quanto custa a aposta da Lotomania?",
    answer:
      "R$ 3,00, valor fixo por aposta (sem variar por quantidade de números, já que a aposta é sempre de 50 números) — mas confira sempre o valor atualizado no site oficial da loteria antes de apostar, já que a Caixa pode reajustá-lo a qualquer momento.",
  },
  {
    question: "Quais faixas de premiação existem na Lotomania?",
    answer:
      "Ganha quem acerta 15, 16, 17, 18, 19 ou as 20 dezenas sorteadas — e também quem não acerta nenhuma das 20 dezenas sorteadas (a \"faixa espelho\"). Acertar de 1 a 14 números não premia.",
  },
  {
    question: "Números que saíram mais vezes no passado têm mais chance de sair de novo?",
    answer:
      "Não. Cada sorteio da Lotomania é independente dos anteriores, então a frequência histórica de uma dezena não muda a probabilidade matemática dela ser sorteada no próximo concurso. Filtros de composição (como pares/ímpares e primos) organizam o jogo, mas não alteram essa probabilidade.",
  },
];

export default function LotomaniaGeneratorPage() {
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
          Este é um Gerador Estatístico de Jogos da Lotomania, não um previsor de resultados. Nenhuma combinação tem
          mais chance matemática de ser sorteada do que outra. Jogue com responsabilidade.
        </p>
      </div>

      <div className="mt-6">
        <Suspense fallback={<p className="text-sm text-zinc-500">Carregando gerador...</p>}>
          <LotomaniaGenerator />
        </Suspense>
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
          <LotomaniaProbabilityInfo />
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
            <Link href="/loterias/mega-sena" className="font-medium text-teal-800 hover:underline">
              Mega-Sena
            </Link>{" "}
            ou na{" "}
            <Link href="/loterias/quina" className="font-medium text-teal-800 hover:underline">
              Quina
            </Link>
            ? Veja o gerador estatístico delas também, grátis e sem cadastro. Veja também as{" "}
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
