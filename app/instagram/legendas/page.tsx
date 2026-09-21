import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { AdSlot } from "@/components/ui/AdSlot";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { INSTAGRAM_CATEGORY, instagramTools } from "@/data/instagram";
import { CaptionGeneratorTool } from "@/components/tools/instagram-caption-generator/CaptionGeneratorTool";

const tool = instagramTools.find((item) => item.id === "gerador-legendas-instagram")!;

export const metadata: Metadata = buildPageMetadata({
  title: tool.metaTitle,
  description: tool.metaDescription,
  path: tool.path,
  keywords: tool.keywords,
});

const contentSections = [
  {
    title: "Como gerar sua legenda",
    body: "Digite o assunto do post — o único campo obrigatório —, escolha o tipo de conteúdo, o estilo e o tamanho da legenda, e clique em \"Gerar legendas\". Você recebe 3 opções prontas, já com diferenças reais de redação entre elas, para escolher a que combina mais com o seu post.",
  },
  {
    title: "Sobre o público-alvo e a chamada para ação",
    body: "Os campos de público-alvo e chamada para ação são opcionais. Quando preenchidos, entram exatamente como você escreveu — a ferramenta nunca inventa uma chamada para ação, preço, data ou informação que você não informou.",
  },
  {
    title: "Como editar e copiar",
    body: "Cada opção tem seu próprio botão \"Editar\", para ajustar o texto antes de copiar, e um contador de caracteres. O botão \"Copiar\" copia exatamente o texto mostrado no card, preservando quebras de linha, emojis e hashtags. Editar uma opção nunca altera as outras.",
  },
  {
    title: "Sobre os emojis e as hashtags",
    body: "Você pode ligar ou desligar os emojis e as hashtags sugeridas. As hashtags são sempre relacionadas ao tipo de conteúdo escolhido e ao assunto que você digitou — nunca uma lista aleatória, e nunca com promessa de aumento de alcance ou engajamento.",
  },
  {
    title: "Sobre a geração por inteligência artificial",
    body: "Esta ferramenta não usa nenhuma inteligência artificial paga ou gratuita. As legendas são montadas a partir de modelos de texto prontos e editáveis, combinados com os dados que você preenche no formulário — e o texto final nunca é apresentado como \"gerado por IA\".",
  },
];

const faq = [
  {
    question: "O Gerador de Legendas é gratuito?",
    answer: "Sim, é totalmente gratuito e sem necessidade de cadastro.",
  },
  {
    question: "As legendas são geradas por inteligência artificial?",
    answer:
      "Não. As legendas são montadas a partir de modelos de texto prontos, combinados com os dados que você preenche — sem nenhuma IA paga ou gratuita.",
  },
  {
    question: "Preciso criar uma conta para usar?",
    answer: "Não. Você pode gerar, editar e copiar suas legendas sem fazer login.",
  },
  {
    question: "As hashtags sugeridas garantem mais alcance?",
    answer:
      "Não. As hashtags sugeridas só têm relação com o tipo de conteúdo e o assunto que você informou — a ferramenta nunca promete aumento de alcance ou engajamento.",
  },
  {
    question: "Posso editar o texto antes de copiar?",
    answer: "Sim. Cada opção tem seu próprio botão \"Editar\", e editar uma não afeta as outras.",
  },
  {
    question: "Clicar em \"Gerar novas opções\" muda completamente o texto?",
    answer:
      "As novas opções variam dentro dos mesmos modelos — o assunto, o tipo de conteúdo e o estilo escolhidos continuam sendo respeitados, sem inventar informações novas.",
  },
];

export default function InstagramCaptionGeneratorPage() {
  return (
    <Container className="py-8 sm:py-10">
      <div className="print:hidden">
        <Breadcrumbs
          items={[
            { name: "Início", path: "/" },
            { name: INSTAGRAM_CATEGORY.shortName, path: INSTAGRAM_CATEGORY.path },
            { name: tool.shortName, path: tool.path },
          ]}
        />

        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">{tool.name}</h1>
        <p className="mt-2 max-w-2xl text-base text-zinc-600">{tool.pageDescription}</p>
      </div>

      <div className="mt-6">
        <CaptionGeneratorTool />
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

        <section className="mt-8">
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
            Já tem um assunto em mente? Use-o também para{" "}
            <Link href="/instagram/criar-post" className="font-medium text-teal-800 hover:underline">
              criar um post
            </Link>{" "}
            ou{" "}
            <Link href="/instagram/carrossel" className="font-medium text-teal-800 hover:underline">
              montar um carrossel
            </Link>
            . Veja também as{" "}
            <Link href={INSTAGRAM_CATEGORY.path} className="font-medium text-teal-800 hover:underline">
              outras ferramentas da categoria {INSTAGRAM_CATEGORY.shortName}
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
