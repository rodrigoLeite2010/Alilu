import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { AdSlot } from "@/components/ui/AdSlot";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { CONTENT_AUTOMATION, INSTAGRAM_CATEGORY, INSTAGRAM_PUBLISHING, plannedInstagramTools } from "@/data/instagram";
import { tools } from "@/data/tools";


export const metadata: Metadata = buildPageMetadata({
  title: INSTAGRAM_CATEGORY.metaTitle,
  description: INSTAGRAM_CATEGORY.metaDescription,
  path: INSTAGRAM_CATEGORY.path,
});

// Links para ferramentas relacionadas já existentes no catálogo principal
// (ETAPA 1.3), resolvidos pelo id para nunca gerar um link quebrado mesmo
// que a categoria/slug dessas ferramentas mude no futuro.
const RELATED_EXISTING_TOOL_IDS = ["gerador-imagem", "qr-code", "gerador-orcamento"];
const relatedExistingTools = RELATED_EXISTING_TOOL_IDS
  .map((id) => tools.find((tool) => tool.id === id))
  .filter((tool): tool is NonNullable<typeof tool> => Boolean(tool));

export default function InstagramCategoryPage() {
  return (
    <Container className="py-8 sm:py-10">
      <Breadcrumbs
        items={[
          { name: "Início", path: "/" },
          { name: INSTAGRAM_CATEGORY.shortName, path: INSTAGRAM_CATEGORY.path },
        ]}
      />

      <section className="rounded-lg border border-teal-200 bg-teal-50/50 p-5 sm:p-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">{INSTAGRAM_CATEGORY.title}</h1>
        <p className="mt-2 max-w-2xl text-base text-zinc-600">{INSTAGRAM_CATEGORY.subtitle}</p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Link
            href="/instagram/radar/novo"
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800"
          >
            Criar Radar Instagram
          </Link>
          <Link
            href="/instagram/radar"
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 ring-1 ring-inset ring-zinc-300 transition-colors hover:bg-zinc-50"
          >
            Meus radares
          </Link>
          <Link
            href={INSTAGRAM_PUBLISHING.connectPath}
            prefetch={false}
            className="inline-flex min-h-11 items-center justify-center rounded-md px-4 py-2.5 text-sm font-semibold text-teal-800 transition-colors hover:bg-teal-100/60"
          >
            Conectar Instagram
          </Link>
        </div>
        <p className="mt-3 text-xs text-zinc-600">
          Escolha a conta, cole os links dos vídeos autorizados e defina quantas publicações por dia: o Alilu publica sozinho, só na conta escolhida.
        </p>
      </section>

      <section className="mt-8" aria-labelledby="como-funciona">
        <h2 id="como-funciona" className="mb-3 text-lg font-semibold text-zinc-900">
          Como funciona
        </h2>
        <ol className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            ["1. Escolha a conta", "Cada radar publica numa única conta do Instagram conectada, escolhida por você."],
            ["2. Cole os links", "Dezenas ou centenas de links (ou um TXT). Repetidos e inválidos são separados na hora."],
            ["3. Defina a frequência", "De 1 a 10 publicações por dia, intervalo mínimo e janela de horário. O Alilu publica sozinho."],
          ].map(([title, body]) => (
            <li key={title} className="rounded-lg border border-zinc-200 bg-white p-4">
              <p className="text-sm font-semibold text-zinc-900">{title}</p>
              <p className="mt-0.5 text-sm text-zinc-600">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="radar-instagram" className="mt-10 scroll-mt-20">
        <SectionHeading
          title="Radar Instagram"
          description="Vários links de uma vez, uma conta de destino, de 1 a 10 publicações por dia com o intervalo que você escolher."
        />
        <div className="rounded-lg border border-teal-300 bg-teal-50/30 p-5 sm:p-6">
          <p className="max-w-xl text-sm text-zinc-600">
            Ex.: Radar GTA 6 → Instagram World GTA, 5 publicações por dia a cada 2 horas a partir das 9h. Cada radar publica somente na conta escolhida —
            nunca em outra conta e nunca no Facebook. Só para vídeos próprios ou com autorização do autor.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/instagram/radar/novo" className="inline-flex min-h-11 items-center justify-center rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800">
              Criar radar
            </Link>
            <Link href="/instagram/radar" className="inline-flex min-h-11 items-center justify-center rounded-md bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 ring-1 ring-inset ring-zinc-300 transition-colors hover:bg-zinc-50">
              Meus radares
            </Link>
          </div>
        </div>
      </section>

      <section id="publicacao-automatica" className="mt-10 scroll-mt-20">
        <SectionHeading
          title="Publique e agende sem sair do Alilu"
          description="Nada de baixar a imagem e subir no celular: o Alilu publica por você, pela integração oficial da Meta."
        />
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {INSTAGRAM_PUBLISHING.supported.map((item) => (
            <div key={item.label} className="rounded-lg bg-zinc-50 p-4">
              <p className="text-sm font-semibold text-zinc-900">{item.label}</p>
              <p className="mt-1 text-xs text-zinc-600">{item.detail}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          Requer uma conta profissional do Instagram (Criador de conteúdo ou Empresa). Ainda não disponível pela
          publicação automática: {INSTAGRAM_PUBLISHING.notYetSupported.join(", ").toLowerCase()}.
        </p>
      </section>

      <section id="carrossel-inteligente" className="mt-10 scroll-mt-20">
        <SectionHeading
          title="Carrossel Inteligente"
          description="Do tema ao carrossel pronto: pesquisa com fontes, gancho, roteiro, visual e legenda — para publicar ou agendar."
        />
        <div className="rounded-lg border border-brand-accent/40 bg-brand-accent-soft/60 p-5 sm:p-6">
          <p className="max-w-xl text-sm text-zinc-700">
            Seu primeiro carrossel é grátis. Depois, planos a partir de R$ 29,90 por mês — com 10% de desconto para quem já é cliente Alilu.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/instagram/carrossel-inteligente"
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-primary-dark"
            >
              Criar carrossel inteligente
            </Link>
            <Link
              href="/instagram/carrossel-inteligente/planos"
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-white px-4 py-2.5 text-sm font-semibold text-brand-primary ring-1 ring-inset ring-brand-primary/25 transition-colors hover:bg-brand-primary-soft"
            >
              Ver planos
            </Link>
          </div>
        </div>
      </section>

      <section id="piloto-automatico" className="mt-10 scroll-mt-20">
        <SectionHeading
          title="Piloto Automático"
          description="Planeje sua semana uma vez e deixe o Alilu criar e publicar seus conteúdos automaticamente."
        />
        <div className="rounded-lg border border-teal-300 bg-teal-50/30 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white text-teal-800">
              <Icon name="sparkles" className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold text-zinc-900">Piloto Automático de Conteúdo</p>
              <p className="mt-1 max-w-xl text-sm text-zinc-600">
                Você define o que publicar em cada dia da semana — Post ou Reel, horário e conta — e o Alilu gera,
                agenda e publica sozinho na sua conta Instagram conectada.
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={CONTENT_AUTOMATION.newAutomationPath}
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800"
            >
              Criar automação
            </Link>
            <Link
              href={CONTENT_AUTOMATION.dashboardPath}
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 ring-1 ring-inset ring-zinc-300 transition-colors hover:bg-zinc-50"
            >
              Minhas automações
            </Link>
          </div>
        </div>
      </section>

      <section id="filas-de-videos" className="mt-10 scroll-mt-20">
        <SectionHeading
          title="Filas de vídeos (Games)"
          description="Cole vários links de vídeos de uma vez e deixe o Alilu importar e publicar um por horário, nas contas que você escolher."
        />
        <div className="rounded-lg border border-zinc-200 bg-white p-5 sm:p-6">
          <p className="max-w-xl text-sm text-zinc-600">
            Ex.: Games › GTA 6 — 3 vídeos por dia às 9h, 15h e 20h no Instagram e na Página do Facebook escolhidos. Só para
            vídeos próprios ou com autorização.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/instagram/filas?categoria=games"
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800"
            >
              Abrir Games
            </Link>
          </div>
        </div>
      </section>

      <div className="mt-8">
        <AdSlot />
      </div>

      <section className="mt-10">
        <SectionHeading title="Como usar" as="h2" />
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-zinc-700">
          <li>Entre no Alilu e conecte suas contas profissionais do Instagram (uma vez só).</li>
          <li>Em Instagram › Radar Instagram, crie um radar e escolha a conta de destino.</li>
          <li>Cole os links dos vídeos (ou importe um arquivo TXT) e confirme que tem autorização para republicá-los.</li>
          <li>Escolha quantas publicações por dia (1 a 10), o intervalo mínimo e a janela de horário; confira a prévia e ative.</li>
        </ol>
      </section>

      <section className="mt-10">
        <SectionHeading title="Benefícios" as="h2" />
        <ul className="grid grid-cols-1 gap-3 text-sm text-zinc-700 sm:grid-cols-2">
          <li className="rounded-lg bg-zinc-50 p-4">Vários radares ao mesmo tempo, cada um com a sua conta de destino.</li>
          <li className="rounded-lg bg-zinc-50 p-4">Publicação e agendamento direto no Instagram, quando você quiser.</li>
          <li className="rounded-lg bg-zinc-50 p-4">Publicação só na conta escolhida: nunca em outra conta e nunca no Facebook sem você pedir.</li>
          <li className="rounded-lg bg-zinc-50 p-4">Funciona bem tanto no computador quanto no celular.</li>
        </ul>
      </section>

      {relatedExistingTools.length > 0 ? (
        <section className="mt-10">
          <SectionHeading title="Outras ferramentas do ALILU que podem ajudar" as="h2" />
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {relatedExistingTools.map((tool) => (
              <li key={tool.id}>
                <Link
                  href={`/utilitarios/${tool.category}/${tool.slug}`}
                  className="group flex h-full flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-4 transition-colors hover:border-teal-700/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                >
                  <p className="font-semibold text-zinc-900 group-hover:text-teal-800">{tool.shortName}</p>
                  <p className="text-sm text-zinc-600">{tool.description}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-10">
        <SectionHeading
          title="O que vem por aí"
          description="Ferramentas planejadas para esta categoria — ainda em desenvolvimento, sem previsão exata de lançamento."
          as="h2"
        />
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {plannedInstagramTools.map((tool) => (
            <li
              key={tool.name}
              className="flex items-start gap-3 rounded-lg border border-dashed border-zinc-300 bg-zinc-50/70 p-4"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-500">
                <Icon name={tool.icon} className="h-4 w-4" />
              </span>
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold text-zinc-800">
                  {tool.name}
                  <Badge tone="neutral">Em breve</Badge>
                </p>
                <p className="mt-1 text-xs text-zinc-600">{tool.description}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </Container>
  );
}
