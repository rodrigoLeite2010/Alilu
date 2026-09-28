"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/ui/Icon";

/**
 * Aviso curto "Você saiu da sua conta.", mostrado uma única vez logo após
 * o logout (redirecionamento de página inteira com ?saiu=1 — ver
 * UserMenu.handleSignOut / MobileAccountSection). O signOut() do NextAuth
 * sempre recarrega a página inteira, então este componente sempre monta
 * do zero quando ?saiu=1 aparece — por isso o estado inicial já lê o
 * parâmetro direto (useState com inicializador), em vez de setState
 * dentro do efeito. Depois de montado, o aviso fica de pé sozinho por
 * alguns segundos e a URL é limpa, sem depender mais do parâmetro.
 */
export function LogoutNotice() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [visible, setVisible] = useState(() => searchParams.get("saiu") === "1");

  useEffect(() => {
    if (!visible) return;

    router.replace("/", { scroll: false });

    const timeout = setTimeout(() => setVisible(false), 5000);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deve rodar só uma vez, ao montar já visível (ver comentário acima); não a cada re-render do router
  }, []);

  if (!visible) return null;

  return (
    <div role="status" className="border-b border-teal-200 bg-teal-50 print:hidden">
      <div className="mx-auto flex max-w-[90rem] items-center justify-between gap-3 px-4 py-2 text-sm text-teal-900 sm:px-6 lg:px-8">
        <span>Você saiu da sua conta.</span>
        <button
          type="button"
          onClick={() => setVisible(false)}
          aria-label="Fechar aviso"
          className="rounded p-1 text-teal-700 hover:bg-teal-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
        >
          <Icon name="close" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
