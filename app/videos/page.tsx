import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { AdSlot } from "@/components/ui/AdSlot";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { FaqJsonLd } from "@/components/seo/FaqJsonLd";
import type { ToolFaqItem } from "@/components/tools/ToolPageTemplate";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { MAX_OUTPUT_DURATION_SECONDS, MAX_VIDEO_INPUT_BYTES } from "@/lib/videos/config";
import { VIDEOS_CATEGORY, videoTools } from "@/data/videos";

export const metadata: Metadata = buildPageMetadata({
  title: VIDEOS_CATEGORY.metaTitle,
  description: VIDEOS_CATEGORY.metaDescription,
  path: VIDEOS_CATEGORY.path,
});

const activeTools = videoTools.filter((tool) => tool.status === "ativo");
const plannedTools = videoTools.filter((tool) => tool.status === "em-breve");
const maxInputMegabytes = Math.round(MAX_VIDEO_INPUT_BYTES / (1024 * 1024));

const faq: ToolFaqItem[] = [
  {
    question: "Os vídeos enviados ficam salvos?",
    answer:
      "Não. Os dois vídeos que você envia são usados só para gerar o resultado e são apagados do servidor logo depois que o processamento termina — em caso de sucesso ou de erro. Só o vídeo final gerado fica disponível para download.",
  },
  {
    question: "Quais formatos de vídeo são aceitos?",
    answer: "MP4, MOV (QuickTime) e WEBM. O resultado final é sempre exportado em MP4, pronto para redes sociais.",
  },
  {
    question: "Existe limite de tamanho ou duração?",
    answer: `Cada vídeo enviado pode ter até ${maxInputMegabytes} MB. O vídeo final gerado tem no máximo ${MAX_OUTPUT_DURATION_SECONDS} segundos de duração — o suficiente para a maioria dos Reels, Shorts e vídeos curtos de TikTok.`,
  },
  {
    question: "O resultado tem marca d'água?",
    answer:
      "Não. O vídeo gerado sai sem nenhuma marca d'água. (Uma marca d'água opcional pode vir a ser oferecida no futuro, mas nunca é aplicada sem você escolher.)",
  },
  {
    question: "Preciso fazer login para usar?",
    answer: "Não. O editor de vídeo é gratuito e não pede cadastro nem login para gerar e baixar o resultado.",
  },
];

export default function VideosCategoryPage() {
  return (
    <Container className="py-8 sm:py-10">
      <Breadcrumbs
        items={[
          { name: "Início", path: "/" },
          { name: VIDEOS_CATEGORY.shortName, path: VIDEOS_CATEGORY.path },
        ]}
      />

      <section className="rounded-lg border border-teal-200 bg-teal-50/50 p-5 sm:p-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">{VIDEOS_CATEGORY.title}</h1>
        <p className="mt-2 max-w-2xl text-base text-zinc-600">{VIDEOS_CATEGORY.subtitle}</p>
      </section>

      <section className="mt-10">
        <SectionHeading
          title="O que dá para fazer"
          description="Monte vídeos verticais combinando dois clipes em split-screen — o formato clássico de vídeo de 'satisfação' que viralizou no TikTok e nos Reels."
        />
        <ul className="grid grid-cols-1 gap-3 text-sm text-zinc-700 sm:grid-cols-2">
          <li className="rounded-lg bg-zinc-50 p-4">
            Envie um vídeo principal (o conteúdo que importa) e um vídeo complementar — tipo slime, limpeza ou
            qualquer clipe &quot;satisfatório&quot; — um em cima e outro embaixo.
          </li>
          <li className="rounded-lg bg-zinc-50 p-4">
            Corte o trecho exato de cada vídeo e escolha se o complementar repete em loop ou se o resultado corta no
            mais curto dos dois.
          </li>
          <li className="rounded-lg bg-zinc-50 p-4">
            Escolha qual áudio usar: só o principal, só o complementar, ou os dois juntos com volume ajustável.
          </li>
          <li className="rounded-lg bg-zinc-50 p-4">
            Exporte em vertical (9:16), quadrado (1:1) ou horizontal (16:9) — pronto para Reels, Shorts e TikTok.
          </li>
        </ul>
      </section>

      <section className="mt-10">
        <SectionHeading
          title="Ferramentas"
          description="Grátis e sem cadastro para gerar e baixar o resultado."
        />
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {activeTools.map((tool) => (
            <li key={tool.id}>
              <Link
                href={tool.path}
                className="group flex h-full flex-col gap-3 rounded-lg border border-teal-300 bg-teal-50/30 p-4 transition-colors hover:border-teal-700/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white text-zinc-700 transition-colors group-hover:bg-teal-100 group-hover:text-teal-800">
                    <Icon name={tool.icon} className="h-5 w-5" />
                  </span>
                  <Badge tone="brand">Grátis</Badge>
                </div>
                <div>
                  <p className="font-semibold text-zinc-900 group-hover:text-teal-800">{tool.shortName}</p>
                  <p className="mt-1 text-sm text-zinc-600">{tool.description}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-8">
        <AdSlot />
      </div>

      <section className="mt-10">
        <SectionHeading title="Como funciona" as="h2" />
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-zinc-700">
          <li>Envie o vídeo principal e o vídeo complementar (MP4, MOV ou WEBM).</li>
          <li>Escolha o formato de saída, a proporção do split e corte o trecho de cada vídeo.</li>
          <li>Escolha a fonte de áudio e clique em &quot;Gerar vídeo&quot; — o processamento acontece no servidor.</li>
          <li>Baixe o resultado em MP4, pronto para publicar.</li>
        </ol>
      </section>

      <section className="mt-10">
        <SectionHeading title="Importante" as="h2" />
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p>
            Diferente das outras ferramentas do site (que processam tudo no seu navegador), esta envia os dois
            vídeos para o servidor para gerar o resultado. Os arquivos enviados são apagados logo depois do
            processamento — só o vídeo final gerado fica disponível para download. Cada vídeo enviado pode ter até{" "}
            {maxInputMegabytes} MB, e o resultado final tem no máximo {MAX_OUTPUT_DURATION_SECONDS} segundos.
          </p>
        </div>
      </section>

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

      {plannedTools.length > 0 ? (
        <section className="mt-10">
          <SectionHeading
            title="O que vem por aí"
            description="Outros recursos planejados para esta categoria — ainda em desenvolvimento, sem previsão exata de lançamento."
            as="h2"
          />
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {plannedTools.map((tool) => (
              <li
                key={tool.id}
                className="flex items-start gap-3 rounded-lg border border-dashed border-zinc-300 bg-zinc-50/70 p-4"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-500">
                  <Icon name={tool.icon} className="h-4 w-4" />
                </span>
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold text-zinc-800">
                    {tool.shortName}
                    <Badge tone="neutral">Em breve</Badge>
                  </p>
                  <p className="mt-1 text-xs text-zinc-600">{tool.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </Container>
  );
}
