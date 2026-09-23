import type { Metadata } from "next";
import { auth } from "@/auth";
import { listPostsForUser } from "@/lib/instagram/backend/instagram-post-service";
import { LinkButton } from "@/components/ui/Button";
import { PublicationsManager } from "@/components/instagram/PublicationsManager";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Calendário editorial (Fase 3, ETAPA 4) — lista os posts do usuário
 * (rascunhos, agendados, publicados, etc.), com ações de cancelar e
 * publicar agora por post (CalendarPostCard). Substitui o formulário de
 * teste provisório (PublishTestForm, aposentado nesta mesma etapa) como
 * a forma de fato de gerenciar publicações no ALILU.
 *
 * Publicações agendadas são publicadas automaticamente pelo scheduler no
 * servidor (/api/cron/instagram-publish), mesmo com o navegador fechado —
 * ver docs/instagram-scheduler.md.
 */
export default async function CalendarioPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return (
      <div className="mx-auto flex min-h-[40vh] max-w-md flex-col items-center justify-center gap-4 px-4 py-12 text-center">
        <p className="text-sm text-zinc-600">Você precisa entrar para ver esta página.</p>
        <a href="/entrar" className="text-sm font-medium text-teal-700 underline underline-offset-2">
          Entrar
        </a>
      </div>
    );
  }

  const posts = await listPostsForUser(session.user.id);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Minhas publicações</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Seus rascunhos, agendamentos e publicações criados no ALILU. Os agendados são publicados
            automaticamente no horário escolhido, mesmo com o Alilu fechado.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <LinkButton href="/instagram/posts-virais">Post viral</LinkButton>
          <LinkButton href="/instagram/painel/calendario/novo" variant="secondary">
            Novo post
          </LinkButton>
          <LinkButton href="/instagram/painel/calendario/novo-carrossel" variant="secondary">
            Novo carrossel
          </LinkButton>
          <LinkButton href="/instagram/reels" variant="secondary">
            Novo Reel
          </LinkButton>
        </div>
      </div>

      <PublicationsManager initialPosts={posts} userId={session.user.id} />
    </div>
  );
}
