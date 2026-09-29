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
import { DiaDeSorteGenerator } from "@/components/lotteries/DiaDeSorteGenerator";
import { DiaDeSorteProbabilityInfo } from "@/components/lotteries/DiaDeSorteProbabilityInfo";

const modality = lotteryModalities.find((item) => item.id === "dia-de-sorte")!;

export const metadata: Metadata = buildPageMetadata({
  title: `${modality.name} — Grátis e sem cadastro | ALILU`,
  description:
    "Gere jogos do Dia de Sorte (números de 1 a 31 + Mês da Sorte) com filtros de pares/ímpares, primos e distribuição no volante. Ferramenta estatística e organizacional — não prevê resultado de sorteio.",
  path: modality.path,
  keywords: [
    "gerador dia de sorte",
    "gerador de jogos dia de sorte",
    "mês da sorte",
    "estratégia dia de sorte",
    "jogos dia de sorte",
    "probabilidade dia de sorte",
  ],
});

const contentSections = [
  {
    title: "O que este gerador faz",
    body: 'O Gerador Estatístico do Dia de Sorte organiza suas apostas com base em critérios matemáticos de composição — como o equilíbrio entre números pares e ímpares, a quantidade de números primos e a distribuição pelo volante. Ele NÃO prevê o resultado do próximo sorteio, não usa nenhum "algoritmo secreto" e não garante prêmio: cada combinação de números tem exatamente a mesma chance matemática de ser sorteada, e o Mês da Sorte é sempre 1 chance em 12, não importa qual mês você escolher.',
  },
  {
    title: "Como usar",
    body: "Escolha um modo — Aleatório (números totalmente aleatórios), Equilibrado (aplica filtros de pares/ímpares, primos e distribuição) ou Personalizado (você escolhe números que precisam entrar e números que não podem entrar) —, quantos números marcar na aposta (de 7 a 15) e quantos jogos gerar de uma vez (1, 5, 10, 20 ou 50). O Mês da Sorte vem sempre preenchido com um valor aleatório — clique em um dos 12 meses para travá-lo em todos os próximos jogos gerados, ou em \"Sortear outro mês\" para voltar a sortear um mês independente por jogo. Depois é só copiar os números (com o mês) ou baixar tudo em um arquivo CSV.",
  },
  {
    title: "Por que o Dia de Sorte é diferente das outras loterias",
    body: 'Em toda outra modalidade da Caixa, uma aposta é só "escolher números". No Dia de Sorte, toda aposta simples tem DUAS partes obrigatórias e independentes: de 7 a 15 números entre 1 e 31 (os dias do mês), e exatamente 1 mês entre os 12 do calendário (o "Mês da Sorte"). São dois sorteios separados no mesmo concurso, com faixas de premiação próprias — e, se a mesma aposta acertar as duas coisas, os dois prêmios se somam. Veja os detalhes completos na seção de probabilidade desta página.',
  },
];

const faq = [
  {
    question: "Esse gerador prevê os números ou o mês do próximo sorteio?",
    answer:
      "Não. Nenhuma ferramenta é capaz de prever o resultado de um sorteio do Dia de Sorte, porque cada sorteio (tanto dos números quanto do mês) é um evento aleatório e independente dos anteriores. Este gerador apenas organiza suas apostas com base em critérios estatísticos de composição, como equilíbrio de pares/ímpares e números primos.",
  },
  {
    question: "O que é o Mês da Sorte e por que preciso escolher um?",
    answer:
      'É a segunda parte, obrigatória, de toda aposta do Dia de Sorte: além dos números, você também marca 1 mês entre os 12 do calendário (Janeiro a Dezembro). O concurso sorteia um mês separadamente dos números, e quem acerta só o mês (sem bater nenhuma faixa de premiação pelos números) já ganha um prêmio fixo — sem essa escolha, a aposta simplesmente não é válida.',
  },
  {
    question: "Quantos números eu marco?",
    answer:
      "De 7 a 15 números, entre 1 e 31. Quanto mais números você marca, mais combinações de 7 dezenas a sua aposta cobre ao mesmo tempo — e mais cara fica a aposta, já que cada combinação extra é paga separadamente pela Caixa.",
  },
  {
    question: "Quanto custa a aposta do Dia de Sorte?",
    answer:
      "A aposta mínima (7 números + 1 mês) custa R$ 2,50 — mas confira sempre o valor atualizado no site oficial da loteria antes de apostar, já que a Caixa pode reajustá-lo a qualquer momento. Apostas com mais números custam mais, proporcionalmente à quantidade de combinações de 7 dezenas que passam a cobrir.",
  },
  {
    question: "O gerador aumenta minha chance de ganhar?",
    answer:
      "Não. Os filtros de composição (pares/ímpares, primos, distribuição no volante) só organizam como os números do seu jogo se distribuem — eles não mudam a chance matemática da combinação específica gerada, nem a chance do Mês da Sorte, que é sempre exatamente 1 em 12, qualquer que seja o mês escolhido.",
  },
  {
    question: "Os prêmios dos números e do mês se somam na mesma aposta?",
    answer:
      "Sim. Se a mesma aposta acertar tanto uma das faixas de premiação pelos números (4, 5, 6 ou as 7 dezenas sorteadas) quanto o Mês da Sorte sorteado, ela recebe as duas premiações juntas — são dois prêmios independentes pagos sobre a mesma aposta, não apenas o maior dos dois.",
  },
];

export default function DiaDeSorteGeneratorPage() {
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
          Este é um Gerador Estatístico de Jogos do Dia de Sorte, não um previsor de resultados. Nenhuma combinação
          de números tem mais chance matemática de ser sorteada do que outra, e o Mês da Sorte é sempre 1 chance em
          12. Jogue com responsabilidade.
        </p>
      </div>

      <div className="mt-6">
        <Suspense fallback={<p className="text-sm text-zinc-500">Carregando gerador...</p>}>
          <DiaDeSorteGenerator />
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
          <DiaDeSorteProbabilityInfo />
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
            <Link href="/loterias/lotomania" className="font-medium text-teal-800 hover:underline">
              Lotomania
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
