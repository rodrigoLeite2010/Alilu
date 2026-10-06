"use client";

import { useEffect, useState } from "react";
import type { HeaderAuthState } from "./auth-state";

interface SessionResponse {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    isAdmin?: boolean;
  };
}

/**
 * Busca a sessão atual via GET /api/auth/session (rota padrão do
 * Auth.js/NextAuth, já exposta por app/api/auth/[...nextauth]/route.ts) no
 * navegador. Cada componente que chama este hook faz sua própria busca —
 * hoje só HeaderAuthArea usa, então isso não duplica chamadas na prática.
 * Ver Header.tsx para o porquê de não resolver isso no servidor.
 */
export function useHeaderAuth(): HeaderAuthState {
  const [state, setState] = useState<HeaderAuthState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    fetch("/api/auth/session")
      .then((response) => (response.ok ? (response.json() as Promise<SessionResponse>) : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.user?.email) {
          setState({
            status: "signed-in",
            user: {
              name: data.user.name ?? null,
              email: data.user.email,
              image: data.user.image ?? null,
              isAdmin: data.user.isAdmin === true,
            },
          });
        } else {
          setState({ status: "signed-out" });
        }
      })
      .catch(() => {
        if (!cancelled) setState({ status: "signed-out" });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
