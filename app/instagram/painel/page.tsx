import type { Metadata } from "next";
import { auth } from "@/auth";
import { listInstagramAccountsForUser } from "@/lib/instagram/backend/instagram-account-repository";
import { LinkButton } from "@/components/ui/Button";
import { SchedulingIntro } from "@/components/instagram/SchedulingIntro";
import { DefaultMusicSettings } from "@/components/instagram/DefaultMusicSettings";
import { ConnectInstagramLink } from "@/components/instagram/ConnectInstagramLink";
import { DisconnectInstagramButton } from "@/components/instagram/DisconnectInstagramButton";
import { MakePrimaryAccountButton } from "@/components/instagram/MakePrimaryAccountButton";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

interface PainelPageProps {
  searchParams: Promise<{ status?: string; mensagem?: string }>;
}

const ERROR_MESSAGES: Record<string, string> = {
  "facebook-login-indisponivel": "O login pela Meta ainda não está configurado neste ambiente.",
  "conta-nao-encontrada": "A conta selecionada não foi encontrada. Atualize a página e tente novamente.",
  "sessao-meta-expirada": "Sua sessão Alilu expirou. Entre novamente para conectar sua conta.",
  "tentativa-oauth-expirada": "A tentativa de conexão expirou. Comece novamente pelo painel.",
  "autorizacao-meta-cancelada": "A autorização foi cancelada. Nenhuma conexão foi alterada.",
  "oauth-meta-falhou": "A Meta não concluiu a autorização ou não concedeu todas as permissões necessárias.",
};

/**
 * Painel do módulo Instagram (Fase 3): mostra se há uma conta conectada,
 * ou o link para conectar uma, e — quando já há conta — o acesso ao
 * calendário editorial (app/instagram/painel/calendario), que é a forma
 * de fato de criar, agendar e publicar posts. O formulário de teste
 * provisório (PublishTestForm) foi aposentado nesta etapa — o calendário
 * o substitui por completo.
 */
export default async function InstagramPainelPage({
  searchParams,
}: PainelPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <SchedulingIntro
          mode="login"
          returnPath="/instagram/painel/calendario"
        />
      </div>
    );
  }

  const { status, mensagem } = await searchParams;
  const errorMessage = mensagem ? ERROR_MESSAGES[mensagem] ?? mensagem : "Não foi possível concluir a conexão com o Instagram.";
  // Multi-conta: todas as contas do usuário. A "principal" é a primeira conectada
  // (mesma regra de getInstagramAccountForUser) — usada por calendário/Posts Virais/Reels.
  const accounts = await listInstagramAccountsForUser(session.user.id);
  const facebookLoginEnabled = Boolean(process.env.INSTAGRAM_FACEBOOK_APP_ID && process.env.INSTAGRAM_FACEBOOK_APP_SECRET && process.env.INSTAGRAM_FACEBOOK_LOGIN_CONFIG_ID);
  const connected = accounts.filter((item) => item.status === "connected");
  const primary = connected[0] ?? null;

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col gap-6 px-4 py-12">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Instagram</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Conecte sua conta profissional do Instagram para publicar pelo ALILU.
        </p>
      </div>

      {status === "conectado" ? (
        <p
          role="status"
          className="rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-800"
        >
          Conta conectada com sucesso.
        </p>
      ) : null}

      {status === "erro" ? (
        <p
          role="alert"
          className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {errorMessage}
        </p>
      ) : null}

      {accounts.length > 0 ? (
        <>
          <ul className="space-y-3">
            {accounts.map((item) => {
              const isConnected = item.status === "connected";
              const isPrimary = primary?.id === item.id;
              const label = item.igUsername
                ? `@${item.igUsername}`
                : item.igUserId;
              return (
                <li
                  key={item.id}
                  className={`rounded-md border px-4 py-3 ${isConnected ? "border-zinc-200" : "border-amber-200 bg-amber-50"}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-zinc-800">
                      <strong>{label}</strong>
                      {isPrimary ? (
                        <span className="ml-2 rounded bg-teal-100 px-2 py-0.5 text-xs text-teal-900">
                          principal
                        </span>
                      ) : null}
                    </p>
                    <span
                      className={`text-xs ${isConnected ? "text-teal-700" : "text-amber-900"}`}
                    >
                      {isConnected
                        ? "Conectado ✓"
                        : item.status === "revoked"
                          ? "Desconectado"
                          : "Precisa reconectar"}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-4">
                    {isConnected ? (
                      <>
                        {!isPrimary ? (
                          <MakePrimaryAccountButton accountId={item.id} />
                        ) : null}
                        <DisconnectInstagramButton
                          accountId={item.id}
                          username={item.igUsername}
                        />
                      </>
                    ) : (
                      <>
                        <ConnectInstagramLink
                          returnTo="/instagram/painel"
                          accountId={item.id}
                          label={`Reconectar ${label}`}
                          className="text-sm font-medium text-teal-800 underline"
                        />
                        {facebookLoginEnabled ? <a className="text-sm font-medium text-blue-800 underline" href={`/api/instagram/facebook-oauth/start?accountId=${encodeURIComponent(item.id)}&returnTo=%2Finstagram%2Fpainel`}>Reconectar pela Meta</a> : null}
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          <ConnectInstagramLink
            returnTo="/instagram/painel"
            addAccount
            label="+ Adicionar outra conta do Instagram"
          />
          {facebookLoginEnabled ? <a className="flex w-full justify-center rounded-md bg-zinc-900 px-4 py-3 text-sm font-semibold text-white" href="/api/instagram/facebook-oauth/start?returnTo=%2Finstagram%2Fpainel">Conectar contas gerenciadas pela Meta</a> : null}
          <p className="-mt-3 text-xs text-zinc-500">
            O Instagram vai pedir login: entre com a conta que quer adicionar
            (ex.: saia da outra conta na tela do Instagram, se ela aparecer já
            logada). Cada automação do Piloto Automático publica na conta
            escolhida nela.
          </p>

          {primary ? (
            <>
              <LinkButton
                href="/instagram/painel/calendario"
                className="w-full justify-center"
              >
                Minhas publicações
              </LinkButton>
              <LinkButton
                href="/instagram/piloto-automatico"
                variant="secondary"
                className="w-full justify-center"
              >
                Piloto Automático
              </LinkButton>
              <LinkButton
                href="/instagram/posts-virais"
                variant="secondary"
                className="w-full justify-center"
              >
                Criar Post Viral
              </LinkButton>
              <DefaultMusicSettings
                key={primary.id}
                initialDefaultMusic={primary.defaultMusic}
              />
            </>
          ) : null}
        </>
      ) : (
        <>
          <ConnectInstagramLink returnTo="/instagram/painel" />
          <p className="text-xs text-zinc-500">
            Você vai para a tela oficial do Instagram, autoriza o Alilu e volta
            para cá automaticamente. É preciso ter uma conta profissional
            (Criador ou Empresa).
          </p>
        </>
      )}
    </div>
  );
}
