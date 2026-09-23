import type { Metadata } from "next";
import { auth } from "@/auth";
import { getInstagramAccountForUser } from "@/lib/instagram/backend/instagram-account-repository";
import { LinkButton } from "@/components/ui/Button";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

interface PainelPageProps {
  searchParams: Promise<{ status?: string; mensagem?: string }>;
}

/**
 * Painel do módulo Instagram (Fase 3): mostra se há uma conta conectada,
 * ou o link para conectar uma, e — quando já há conta — o acesso ao
 * calendário editorial (app/instagram/painel/calendario), que é a forma
 * de fato de criar, agendar e publicar posts. O formulário de teste
 * provisório (PublishTestForm) foi aposentado nesta etapa — o calendário
 * o substitui por completo.
 */
export default async function InstagramPainelPage({ searchParams }: PainelPageProps) {
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

  const { status, mensagem } = await searchParams;
  const account = await getInstagramAccountForUser(session.user.id);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col gap-6 px-4 py-12">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Instagram</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Conecte sua conta profissional do Instagram para publicar pelo ALILU.
        </p>
      </div>

      {status === "conectado" ? (
        <p role="status" className="rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-800">
          Conta conectada com sucesso.
        </p>
      ) : null}

      {status === "erro" ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {mensagem ?? "Não foi possível concluir a conexão com o Instagram."}
        </p>
      ) : null}

      {account ? (
        <>
          <div className="rounded-md border border-zinc-200 px-4 py-3">
            <p className="text-sm text-zinc-800">
              Conectado como{" "}
              <strong>{account.igUsername ? `@${account.igUsername}` : account.igUserId}</strong>
            </p>
            <p className="mt-1 text-xs text-zinc-500">Status: {account.status}</p>
          </div>
          <LinkButton href="/instagram/painel/calendario" className="w-full justify-center">
            Minhas publicações
          </LinkButton>
          <LinkButton href="/instagram/posts-virais" variant="secondary" className="w-full justify-center">
            Criar Post Viral
          </LinkButton>
        </>
      ) : (
        <a
          href="/api/instagram/oauth/start"
          className="flex h-11 items-center justify-center rounded-md bg-zinc-900 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
        >
          Conectar Instagram
        </a>
      )}
    </div>
  );
}
