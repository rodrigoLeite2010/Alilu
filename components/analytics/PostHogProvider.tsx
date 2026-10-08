"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { identifyUser, resetIfIdentified, trackPageView } from "@/lib/analytics/posthog-client";

interface SessionResponse {
  user?: { id?: string | null; isAdmin?: boolean };
}

/**
 * Analytics (PostHog) — montado UMA vez no layout raiz. Não renderiza nada.
 * - pageview a cada mudança de rota (App Router), sem duplicar a mesma rota;
 * - identifica o usuário logado pelo id interno (busca /api/auth/session uma vez);
 * - qualquer erro é ignorado: o site nunca depende do analytics.
 */
export function PostHogProvider() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || lastPath.current === pathname) return;
    lastPath.current = pathname;
    void trackPageView(pathname);
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session")
      .then((response) => (response.ok ? (response.json() as Promise<SessionResponse>) : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.user?.id) void identifyUser({ id: data.user.id, isAdmin: data.user.isAdmin === true });
        else void resetIfIdentified();
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
