import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { AdSlot } from "@/components/ui/AdSlot";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { INSTAGRAM_CATEGORY, instagramTools } from "@/data/instagram";
import { PublicCarouselCreator } from "@/components/instagram/PublicCarouselCreator";

const tool = instagramTools.find((item) => item.id === "criador-carrossel-instagram")!;

export const metadata: Metadata = buildPageMetadata({
  title: tool.metaTitle,
  description: tool.metaDescription,
  path: tool.path,
  keywords: tool.keywords,
});

const contentSections = [
  {
    title: "Como criar seu carrossel",
    body: "O carrossel já começa com 5 slides editáveis, no mesmo editor do Criador de Posts. Selecione um slide na lista à esquerda, personalize textos, cores e imagem, e passe para o próximo — cada slide guarda suas próprias alterações, sem afetar os demais. Você pode ter de 1 a 20 slides no mesmo carrossel.",
  },
  {
    title: "Como adicionar, duplicar e excluir slides",
    body: "Use \"Adicionar slide\" para criar um slide em branco, o botão de duplicar para repetir o slide atual (inclusive suas imagens, já com uma cópia independente) ou o ícone de lixeira para excluir — o carrossel sempre precisa ter pelo menos um slide.",
  },
  {
    title: "Como reordenar os slides",
    body: "Arraste um slide para a posição desejada na lista, ou use as setas para cima/baixo em cada miniatura — úteis também no celular e pelo teclado. A ordem exibida é exatamente a ordem em que os slides serão exportados.",
  },
  {
    title: "Como escolher o formato",
    body: "Todos os slides de um mesmo carrossel usam o mesmo formato: quadrado (1080 × 1080) ou vertical (1080 × 1350). Trocar o formato preserva os textos e imagens já personalizados.",
  },
  {
    title: "Como usar os modelos prontos",
    body: "Os 5 modelos de carrossel (Educativo, Dicas, Produtos, Passo a passo e Frases) substituem todos os slides atuais por uma sequência já estruturada, que você pode personalizar normalmente depois. Como isso apaga os slides atuais, a ferramenta sempre pede confirmação antes.",
  },
  {
    title: "Como baixar o carrossel",
    body: "Clique em \"Baixar carrossel em ZIP\" para gerar um arquivo com todas as imagens, numeradas na ordem exibida (slide-01.png, slide-02.png...) e prontas para publicar. O processamento acontece inteiramente no seu navegador — nada é enviado para os servidores do ALILU.",
  },
  {
    title: "Como publicar ou agendar o carrossel no Instagram",
    body: "Com os slides prontos (de 2 a 10 para o Instagram), clique em \"Publicar no Instagram\" ou \"Agendar publicação\". Só então você entra no Alilu e conecta sua conta profissional pela tela oficial da Meta; depois volta para o mesmo carrossel e escolhe publicar agora ou em um dia e horário.",
  },
  {
    title: "Privacidade",
    body: "Enquanto você cria e baixa, as fotos são processadas no seu navegador e não saem do seu dispositivo. Elas só são enviadas ao armazenamento do Alilu se você decidir publicar ou agendar.",
  },
];

const faq = [
  {
    question: "O Criador de Carrosséis é gratuito?",
    answer: "Sim, é totalmente gratuito, sem limite de downloads e sem necessidade de cadastro. A conta só é pedida se você quiser publicar ou agendar no Instagram.",
  },
  {
    question: "Quantos slides posso ter no carrossel?",
    answer: "De 1 a 20 slides por carrossel. O carrossel começa com 5 slides editáveis.",
  },
  {
    question: "Editar um slide afeta os outros?",
    answer:
      "Não. Cada slide guarda seu próprio conteúdo — textos, cores e imagem — de forma independente dos demais slides do carrossel.",
  },
  {
    question: "Duplicar um slide compartilha a mesma imagem entre os dois?",
    answer:
      "Não. Ao duplicar, a imagem do slide original é copiada, então cada slide fica com sua própria cópia e pode ser editado sem afetar o outro.",
  },
  {
    question: "A ordem dos slides na tela é a mesma do arquivo baixado?",
    answer: "Sim. O ZIP exportado segue exatamente a ordem exibida na lista de slides.",
  },
  {
    question: "As imagens que eu envio ficam salvas em algum servidor?",
    answer:
      "Para criar e baixar, não: tudo acontece no seu navegador. Só quando você publica ou agenda os slides são enviados ao armazenamento do Alilu, para o Instagram buscá-los.",
  },
  {
    question: "O editor funciona no celular?",
    answer:
      "Sim. Além do arraste, os slides podem ser reordenados por botões de mover para cima/baixo, pensados especialmente para o celular.",
  },
];

export default function InstagramCarouselCreatorPage() {
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
        <PublicCarouselCreator />
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
            Prefere editar um post só? Use o{" "}
            <Link href="/instagram/criar-post" className="font-medium text-teal-800 hover:underline">
              Criador de Posts
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
