import type { Metadata } from "next";
import { auth } from "@/auth";
import { getInstagramAccountForUser } from "@/lib/instagram/backend/instagram-account-repository";
import { LinkButton } from "@/components/ui/Button";
import { SchedulingIntro } from "@/components/instagram/SchedulingIntro";
import { DefaultMusicSettings } from "@/components/instagram/DefaultMusicSettings";
import { ConnectInstagramLink } from "@/components/instagram/ConnectInstagramLink";
import { DisconnectInstagramButton } from "@/components/instagram/DisconnectInstagramButton";

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
      <div className="mx-auto max-w-2xl px-4 py-10">
        <SchedulingIntro mode="login" returnPath="/instagram/painel/calendario" />
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

      {account && account.status !== "connected" ? (
        <>
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {account.status === "revoked"
              ? "Seu Instagram está desconectado."
              : "Sua conexão com o Instagram precisa ser renovada."}{" "}
            {account.igUsername ? <strong>@{account.igUsername}</strong> : null}
          </div>
          <ConnectInstagramLink returnTo="/instagram/painel" label="Conectar Instagram" />
        </>
      ) : account ? (
        <>
          <div className="rounded-md border border-zinc-200 px-4 py-3">
            <p className="text-sm text-zinc-800">
              Conectado como{" "}
              <strong>{account.igUsername ? `@${account.igUsername}` : account.igUserId}</strong>
            </p>
            <p className="mt-1 text-xs text-teal-700">Conectado ✓</p>
          </div>
          <LinkButton href="/instagram/painel/calendario" className="w-full justify-center">
            Minhas publicações
          </LinkButton>
          <LinkButton href="/instagram/posts-virais" variant="secondary" className="w-full justify-center">
            Criar Post Viral
          </LinkButton>
          <DefaultMusicSettings initialDefaultMusic={account.defaultMusic} />
          <div className="text-center">
            <DisconnectInstagramButton />
          </div>
        </>
      ) : (
        <>
          <ConnectInstagramLink returnTo="/instagram/painel" />
          <p className="text-xs text-zinc-500">
            Você vai para a tela oficial do Instagram, autoriza o Alilu e volta para cá automaticamente. É preciso ter uma conta profissional
            (Criador ou Empresa).
          </p>
        </>
      )}
    </div>
  );
}
