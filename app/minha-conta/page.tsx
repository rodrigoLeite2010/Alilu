import type { Metadata } from "next";
import { auth } from "@/auth";
import { getUserById } from "@/lib/instagram/backend/users-store";
import { Container } from "@/components/ui/Container";
import { LinkButton } from "@/components/ui/Button";
import { AccountLoginGate } from "@/components/conta/AccountLoginGate";
import { SignOutButton } from "@/components/conta/SignOutButton";

// Página com dados da própria conta: nunca indexar (ver também app/robots.ts).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * "Minha conta": nome, e-mail, como a pessoa entra (Google ou código por
 * e-mail) e atalhos para as áreas privadas que usam a conta — junto do
 * botão "Sair" (que já existe também no menu do cabeçalho e no menu
 * mobile; aqui é só mais um lugar óbvio de encontrar). Sem sessão, mostra
 * o mesmo padrão de "entrada amigável" usado em Financeiro e Instagram,
 * em vez de redirecionar de cara — ver AccountLoginGate.
 */
export default async function MinhaContaPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return (
      <Container className="py-10 sm:py-14">
        <AccountLoginGate returnPath="/minha-conta" />
      </Container>
    );
  }

  const appUser = await getUserById(session.user.id);
  const displayName = appUser?.name?.trim() || session.user.name?.trim() || "Sem nome cadastrado";
  const email = appUser?.email ?? session.user.email ?? "";
  const loginMethod = appUser?.googleId ? "Conectado com Google" : "Conectado por código de e-mail";

  return (
    <Container className="max-w-2xl py-10 sm:py-14">
      <h1 className="text-2xl font-semibold text-zinc-900">Minha conta</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Seus dados de acesso e os atalhos para tudo que fica salvo na sua conta.
      </p>

      <section className="mt-6 rounded-lg border border-zinc-200 p-5 sm:p-6">
        <div className="flex items-center gap-4">
          {session.user.image ? (
            // eslint-disable-next-line @next/next/no-img-element -- avatar externo (Google), mesmo padrão do UserMenu.
            <img
              src={session.user.image}
              alt=""
              width={56}
              height={56}
              className="h-14 w-14 shrink-0 rounded-full"
              referrerPolicy="no-referrer"
            />
          ) : null}
          <div className="min-w-0">
            <p className="truncate text-lg font-medium text-zinc-900">{displayName}</p>
            <p className="truncate text-sm text-zinc-500">{email}</p>
          </div>
        </div>
        <p className="mt-4 text-sm text-zinc-600">{loginMethod}</p>

        <div className="mt-5 border-t border-zinc-100 pt-5">
          <SignOutButton />
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Suas áreas</h2>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <LinkButton href="/financeiro/educacao-financeira" variant="secondary" className="sm:flex-1">
            Controle financeiro
          </LinkButton>
          <LinkButton href="/instagram/painel" variant="secondary" className="sm:flex-1">
            Instagram / Automações
          </LinkButton>
          <LinkButton href="/planos" variant="secondary" className="sm:flex-1">
            Planos e assinatura
          </LinkButton>
          <LinkButton href="/minha-conta/creditos-ia" variant="secondary" className="sm:flex-1">
            Créditos de IA
          </LinkButton>
          <LinkButton href="/minha-conta/midias" variant="secondary" className="sm:flex-1">
            Minhas mídias
          </LinkButton>
          <LinkButton href="/minha-conta/midia-final" variant="secondary" className="sm:flex-1">
            Mídia final padrão
          </LinkButton>
        </div>
      </section>
    </Container>
  );
}
