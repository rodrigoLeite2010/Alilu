import type { Metadata } from "next";
import { auth } from "@/auth";
import { getInstagramAccountForUser } from "@/lib/instagram/backend/instagram-account-repository";
import { AuthenticatedPostComposer } from "@/components/instagram/AuthenticatedPostComposer";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Compositor de posts do calendário editorial — mesma ferramenta visual
 * pública (/instagram/criar-post, PostEditorTool) com um painel extra de
 * publicação real (PublishPanel), unidos pelo AuthenticatedPostComposer
 * (Client Component — só ele recebe `userId`, um valor serializável; ver
 * esse arquivo para o porquê da composição não acontecer direto aqui). A
 * ferramenta pública em si não é alterada: quem chega por
 * /instagram/criar-post não vê nem tem acesso a nenhuma ação de
 * publicação, e não precisa de conta nem login.
 */
export default async function CalendarioNovoPostPage() {
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

  const userId = session.user.id;
  const account = await getInstagramAccountForUser(userId);

  if (!account) {
    return (
      <div className="mx-auto flex min-h-[40vh] max-w-md flex-col items-center justify-center gap-4 px-4 py-12 text-center">
        <p className="text-sm text-zinc-600">
          Conecte sua conta do Instagram antes de criar um post para publicar.
        </p>
        <a
          href="/instagram/painel"
          className="text-sm font-medium text-teal-700 underline underline-offset-2"
        >
          Ir para o painel
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-900">Novo post</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Monte sua arte e publique direto na conta{" "}
          <strong>{account.igUsername ? `@${account.igUsername}` : account.igUserId}</strong>, agora ou
          numa data agendada.
        </p>
      </div>

      <AuthenticatedPostComposer userId={userId} />
    </div>
  );
}
