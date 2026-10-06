"use client";

import Link from "next/link";
import { useHeaderAuth } from "./useHeaderAuth";
import { UserMenu } from "./UserMenu";
import { MobileNavigation } from "@/components/navigation/SiteNav";

/**
 * Dona única do estado de autenticação do cabeçalho: busca a sessão uma
 * vez (useHeaderAuth) e alimenta tanto o botão/menu de desktop quanto o
 * painel mobile (MobileNavigation), para os dois nunca divergirem.
 */
export function HeaderAuthArea() {
  const auth = useHeaderAuth();

  return (
    <>
      <div>
        {auth.status === "loading" ? (
          <div
            aria-hidden
            className="h-9 w-9 animate-pulse rounded-full bg-zinc-100 sm:w-24"
          />
        ) : auth.status === "signed-in" ? (
          <UserMenu user={auth.user} />
        ) : (
          <Link
            href="/entrar"
            className="flex h-11 items-center rounded-md px-3 py-2 text-sm font-medium text-brand-primary transition-colors hover:bg-brand-primary-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
          >
            Entrar
          </Link>
        )}
      </div>
      <MobileNavigation auth={auth} />
    </>
  );
}
