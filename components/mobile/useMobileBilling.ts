"use client";

import { useEffect, useState } from "react";

export interface MobileBillingNotice {
  code: string;
  level: "blocked" | "warning" | "info";
  message: string;
}

export interface MobileBillingSummary {
  access: { allowed: boolean; status: string; remainingToday: number | null; currentPeriodEndsAt: string | null };
  plan: { code: string; name: string; priceCents: number; complimentary?: boolean } | null;
  pendingPlan: { code: string; name: string } | null;
  aiUsage: { used: number; limit: number; remaining: number } | null;
  notices: MobileBillingNotice[];
}

interface Result {
  summary: MobileBillingSummary | null;
  /** Créditos de IA disponíveis; `null` = ainda não carregou ou indisponível. */
  credits: number | null;
}

async function getJson<T>(url: string, signal: AbortSignal): Promise<T | null> {
  try {
    const response = await fetch(url, { cache: "no-store", signal });
    return response.ok ? ((await response.json()) as T) : null;
  } catch {
    return null;
  }
}

/**
 * Plano, uso da franquia de IA, avisos e saldo de créditos do usuário
 * logado — mesmas APIs das telas de desktop (/api/billing/summary e
 * /api/ai-video/wallet), nenhuma nova. Só busca quando `enabled`
 * (logado + celular); falha vira `null` e a tela cai no estado genérico.
 */
export function useMobileBilling(enabled: boolean): { loading: boolean } & Result {
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    Promise.all([
      getJson<{ summary: MobileBillingSummary | null }>("/api/billing/summary", controller.signal),
      getJson<{ wallet?: { available?: number } }>("/api/ai-video/wallet", controller.signal),
    ]).then(([billing, wallet]) => {
      if (controller.signal.aborted) return;
      setResult({
        summary: billing?.summary ?? null,
        credits: typeof wallet?.wallet?.available === "number" ? wallet.wallet.available : null,
      });
    });
    return () => controller.abort();
  }, [enabled]);

  return { loading: enabled && result === null, summary: result?.summary ?? null, credits: result?.credits ?? null };
}
