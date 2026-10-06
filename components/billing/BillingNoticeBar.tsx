"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useHeaderAuth } from "@/components/layout/useHeaderAuth";
import type { MobileBillingNotice } from "@/components/mobile/useMobileBilling";

const HIDE_ON = ["/instagram/piloto-automatico"]; // o Piloto já mostra os avisos por conta própria.

function dismissKey(code: string) {
  return `alilu:billing-notice:${code}`;
}

function wasDismissed(code: string): boolean {
  try {
    return window.sessionStorage.getItem(dismissKey(code)) === "1";
  } catch {
    return false;
  }
}

/**
 * Faixa de aviso de plano/limite para as telas do Instagram (criar post,
 * carrossel, reels, painel). Só aparece para quem está logado e só quando
 * há aviso de verdade (80% da franquia, limite atingido, teste acabando,
 * pagamento em atraso). Avisos leves podem ser dispensados na sessão;
 * bloqueios ficam até serem resolvidos. Sem aviso, não renderiza nada.
 */
export function BillingNoticeBar() {
  const auth = useHeaderAuth();
  const pathname = usePathname();
  const [notice, setNotice] = useState<MobileBillingNotice | null>(null);
  const signedIn = auth.status === "signed-in";
  const hidden = HIDE_ON.some((path) => pathname.startsWith(path));

  useEffect(() => {
    if (!signedIn || hidden) return;
    let active = true;
    fetch("/api/billing/summary", { cache: "no-store" })
      .then((response) => (response.ok ? (response.json() as Promise<{ summary: { notices: MobileBillingNotice[] } | null }>) : null))
      .then((body) => {
        if (!active || !body?.summary) return;
        const top = body.summary.notices.find((item) => (item.level === "blocked" || item.level === "warning") && (item.level === "blocked" || !wasDismissed(item.code)));
        setNotice(top ?? null);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [signedIn, hidden]);

  if (!notice || hidden) return null;
  const blocked = notice.level === "blocked";

  return (
    <div
      role="status"
      className={`mx-auto mt-3 flex max-w-5xl flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-4 py-3 text-sm ${
        blocked ? "border-red-200 bg-red-50 text-red-900" : "border-amber-200 bg-amber-50 text-amber-900"
      }`}
    >
      <span className="min-w-0 flex-1">{notice.message}</span>
      <Link href="/planos" className="font-semibold underline">
        Ver planos
      </Link>
      {!blocked ? (
        <button
          type="button"
          className="font-medium underline"
          onClick={() => {
            try {
              window.sessionStorage.setItem(dismissKey(notice.code), "1");
            } catch {
              // sem sessionStorage: some só desta vez
            }
            setNotice(null);
          }}
        >
          Dispensar
        </button>
      ) : null}
    </div>
  );
}
