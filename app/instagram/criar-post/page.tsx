import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { AdSlot } from "@/components/ui/AdSlot";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { INSTAGRAM_CATEGORY, instagramTools } from "@/data/instagram";
import { PublicPostCreator } from "@/components/instagram/PublicPostCreator";

const tool = instagramTools[0];

export const metadata: Metadata = buildPageMetadata({
  title: tool.metaTitle,
  description: tool.metaDescription,
  path: tool.path,
  keywords: tool.keywords,
});

const contentSections = [
  {
    title: "Como criar seu post",
    body: "Escolha um formato e um template prontos, personalize os textos, as cores e — se quiser — envie uma foto sua. A prévia mostra exatamente como a arte vai ficar, em tempo real. Quando estiver pronta, baixe em PNG ou JPG, ou publique e agende direto no Instagram.",
  },
  {
    title: "Como escolher o formato",
    body: "Use o post quadrado (1080 × 1080) para o feed tradicional, o vertical (1080 × 1350) quando quiser ocupar mais espaço na tela, ou o formato de Stories/Reels (1080 × 1920) para conteúdo em tela cheia. Trocar de formato não apaga o que você já escreveu.",
  },
  {
    title: "Como personalizar um template",
    body: "Cada template já vem com cores, fontes e posições pensadas para ficar profissional — mas você pode trocar qualquer texto, cor, fonte e alinhamento, além de arrastar os textos na prévia para reposicioná-los. Trocar de template também preserva os textos que você já personalizou.",
  },
  {
    title: "Como baixar a imagem",
    body: "Clique em \"Baixar PNG\" ou \"Baixar JPG\" na coluna de exportação. O arquivo é gerado na resolução exata do formato escolhido e baixado direto no seu dispositivo — nada é enviado para os servidores do ALILU.",
  },
  {
    title: "Como publicar ou agendar no Instagram",
    body: "Com a arte pronta, clique em \"Publicar no Instagram\" ou \"Agendar publicação\". Só nesse momento você entra no Alilu e conecta sua conta profissional do Instagram pela tela oficial da Meta. Depois disso você volta para a mesma arte, escolhe publicar agora ou em um dia e horário, e o Alilu publica sozinho — mesmo com o site fechado.",
  },
  {
    title: "Privacidade",
    body: "Enquanto você cria e baixa, as fotos são processadas no seu navegador e não saem do seu dispositivo. Elas só são enviadas ao armazenamento do Alilu se você decidir publicar ou agendar — é daí que o Instagram busca a imagem.",
  },
];

const faq = [
  {
    question: "O Criador de Posts é gratuito?",
    answer: "Sim, é totalmente gratuito, sem limite de downloads e sem necessidade de cadastro.",
  },
  {
    question: "Preciso criar uma conta para usar?",
    answer: "Não. Você pode usar o editor e baixar suas artes sem fazer login. A conta só é pedida se você quiser publicar ou agendar direto no Instagram.",
  },
  {
    question: "As imagens que eu envio ficam salvas em algum servidor?",
    answer:
      "Para criar e baixar, não: tudo acontece no seu navegador. Só quando você publica ou agenda a arte é enviada ao armazenamento do Alilu, para o Instagram conseguir buscá-la.",
  },
  {
    question: "Posso publicar ou agendar direto no Instagram?",
    answer:
      "Sim. Conecte uma conta profissional do Instagram (Criador de conteúdo ou Empresa) e publique na hora ou escolha data e horário — a publicação acontece automaticamente.",
  },
  {
    question: "Posso usar a imagem gerada em outras redes sociais, além do Instagram?",
    answer: "Sim. Os arquivos PNG e JPG gerados podem ser usados em qualquer rede social ou aplicativo.",
  },
  {
    question: "A imagem exportada fica com marca d'água?",
    answer: "Não. Nenhuma marca d'água é adicionada automaticamente à sua arte.",
  },
  {
    question: "O editor funciona no celular?",
    answer:
      "Sim. A interface se adapta a telas pequenas, com a prévia em destaque e os controles organizados em seções que você pode abrir e fechar.",
  },
];

export default function InstagramPostCreatorPage() {
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
        <PublicPostCreator />
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
            Veja também as{" "}
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
