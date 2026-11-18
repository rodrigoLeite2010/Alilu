import type { Metadata } from "next";
import { auth } from "@/auth";
import { listPostsForUser } from "@/lib/instagram/backend/instagram-post-service";
import { LinkButton } from "@/components/ui/Button";
import { PublicationsManager } from "@/components/instagram/PublicationsManager";
import { SchedulingIntro } from "@/components/instagram/SchedulingIntro";
import { getInstagramAccountForUser } from "@/lib/instagram/backend/instagram-account-repository";

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
      <div className="mx-auto max-w-2xl px-4 py-10">
        <SchedulingIntro mode="login" returnPath="/instagram/painel/calendario" />
      </div>
    );
  }

  const [posts, account] = await Promise.all([
    listPostsForUser(session.user.id),
    getInstagramAccountForUser(session.user.id),
  ]);

  if (!account && posts.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <SchedulingIntro mode="connect" returnPath="/instagram/painel/calendario" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Minhas publicações</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Histórico, agendamentos e publicações do ALILU (Radar Instagram, automações e publicações antigas). Os
            agendados são publicados automaticamente no horário escolhido, mesmo com o Alilu fechado.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* A criação manual saiu desta tela: novas publicações vêm do Radar Instagram e das automações. */}
          <LinkButton href="/instagram/radar">Radar Instagram</LinkButton>
          <LinkButton href="/instagram/piloto-automatico" variant="secondary">
            Piloto Automático
          </LinkButton>
        </div>
      </div>

      <PublicationsManager initialPosts={posts} userId={session.user.id} />
    </div>
  );
}
