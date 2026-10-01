import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { AdSlot } from "@/components/ui/AdSlot";
import { FaqJsonLd } from "@/components/seo/FaqJsonLd";
import type { ToolFaqItem } from "@/components/tools/ToolPageTemplate";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { MAX_OUTPUT_DURATION_SECONDS, MAX_VIDEO_INPUT_BYTES } from "@/lib/videos/config";
import { VIDEOS_CATEGORY, videoTools } from "@/data/videos";
import { VideoSplitScreenEditor } from "@/components/videos/VideoSplitScreenEditor";

const tool = videoTools.find((item) => item.id === "editor-split-screen")!;
const maxInputMegabytes = Math.round(MAX_VIDEO_INPUT_BYTES / (1024 * 1024));

export const metadata: Metadata = buildPageMetadata({
  title: `${tool.name} — Grátis e sem cadastro | ALILU`,
  description:
    "Combine um vídeo principal com um vídeo complementar em split-screen — corte trechos, repita o complementar em loop e escolha o áudio. Exporte pronto para Reels, Shorts e TikTok.",
  path: tool.path,
  keywords: [
    "editor de vídeo split screen",
    "vídeo satisfatório",
    "criar reels split screen",
    "editor de vídeo para tiktok",
    "juntar dois vídeos",
  ],
});

const contentSections = [
  {
    title: "O que este editor faz",
    body: "Combina dois vídeos MP4 em split-screen — um vídeo principal e um vídeo complementar (o clipe \"satisfatório\": slime, limpeza, ASMR ou qualquer outro), um em cima e outro embaixo. Você escolhe o formato de saída, a proporção do split, o trecho de cada vídeo e qual áudio usar. O processamento acontece no servidor (não no seu navegador) para poder gerar o MP4 final pronto para baixar.",
  },
  {
    title: "Como usar",
    body: 'Envie o vídeo principal e o vídeo complementar, escolha o formato (vertical, quadrado ou horizontal) e a proporção do split (50/50, 60/40 ou 40/60). Corte o início e o fim de cada vídeo, escolha se o complementar repete em loop ou se o resultado corta no mais curto dos dois, e escolha a fonte de áudio. Clique em "Gerar vídeo" e aguarde o processamento — depois é só baixar o resultado.',
  },
  {
    title: "Enquadramento manual",
    body: 'Cada vídeo preenche a área que lhe cabe ("cover") sem esticar nem deformar. Depois disso, você pode arrastar o vídeo e ajustar o zoom para escolher exatamente qual parte fica visível no resultado.',
  },
];

const faq: ToolFaqItem[] = [
  {
    question: "Os vídeos enviados ficam salvos?",
    answer:
      "Não. Os dois vídeos que você envia são usados só para gerar o resultado e são apagados do servidor logo depois que o processamento termina — em caso de sucesso ou de erro. Só o vídeo final gerado fica disponível para download.",
  },
  {
    question: "Quais formatos de vídeo são aceitos?",
    answer: "MP4, MOV (QuickTime) e WEBM. O resultado final é sempre exportado em MP4.",
  },
  {
    question: "Existe limite de tamanho ou duração?",
    answer: `Cada vídeo enviado pode ter até ${maxInputMegabytes} MB. O vídeo final gerado tem no máximo ${MAX_OUTPUT_DURATION_SECONDS} segundos de duração.`,
  },
  {
    question: "O resultado tem marca d'água?",
    answer: "Não. O vídeo gerado sai sem nenhuma marca d'água.",
  },
  {
    question: 'O que acontece se eu escolher um áudio de um vídeo sem trilha sonora?',
    answer:
      "O processamento não falha — o resultado simplesmente sai sem áudio nessa faixa. Se você escolher \"Ambos\" e só um dos dois vídeos tiver som, o resultado usa o áudio do que tiver.",
  },
];

export default function VideoSplitScreenEditorPage() {
  return (
    <Container className="py-8 sm:py-10">
      <Breadcrumbs
        items={[
          { name: "Início", path: "/" },
          { name: VIDEOS_CATEGORY.shortName, path: VIDEOS_CATEGORY.path },
          { name: tool.shortName, path: tool.path },
        ]}
      />

      <section className="rounded-lg border border-teal-200 bg-teal-50/50 p-5 sm:p-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">{tool.name}</h1>
        <p className="mt-2 max-w-2xl text-base text-zinc-600">{tool.description}</p>
      </section>

      <section className="mt-8">
        <VideoSplitScreenEditor />
      </section>

      <div className="mt-8">
        <AdSlot />
      </div>

      {contentSections.map((section) => (
        <section key={section.title} className="mt-10">
          <SectionHeading title={section.title} as="h2" />
          <p className="text-sm leading-relaxed text-zinc-700">{section.body}</p>
        </section>
      ))}

      <section className="mt-10">
        <SectionHeading title="Perguntas frequentes" as="h2" />
        <dl className="space-y-4">
          {faq.map((item) => (
            <div key={item.question}>
              <dt className="font-medium text-zinc-900">{item.question}</dt>
              <dd className="mt-1 text-sm text-zinc-600">{item.answer}</dd>
            </div>
          ))}
        </dl>
        <FaqJsonLd faq={faq} />
      </section>
    </Container>
  );
}
