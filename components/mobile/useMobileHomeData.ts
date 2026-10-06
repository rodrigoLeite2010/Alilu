"use client";

import { useEffect, useState } from "react";

export interface MobilePostItem {
  id: string;
  postType: "image" | "carousel" | "reels" | "story";
  status: "DRAFT" | "SCHEDULED" | "PROCESSING" | "PUBLISHED" | "FAILED" | "CANCELLED" | "NEEDS_REVIEW";
  caption: string;
  scheduledAtUtc: string | null;
  publishedAt: string | null;
  createdAt: string;
  timezone: string;
}

export interface MobileAutomationItem {
  id: string;
  name: string;
  status: "ACTIVE" | "PAUSED" | "ARCHIVED" | "ERROR";
  timezone: string;
  nextRunAt: string | null;
}

interface Result {
  automations: MobileAutomationItem[] | null;
  posts: MobilePostItem[] | null;
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
 * Dados da home mobile: automações e últimas publicações do usuário, pelas
 * mesmas APIs que o painel do Instagram já usa (nenhuma API nova). Só busca
 * quando `enabled` (logado + tela mobile) — no desktop nada é carregado.
 * Falha em qualquer chamada vira `null` e a tela cai no estado genérico.
 */
export function useMobileHomeData(enabled: boolean): { loading: boolean } & Result {
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();

    Promise.all([
      getJson<{ automations?: MobileAutomationItem[] }>("/api/content-automation/automations", controller.signal),
      getJson<{ posts?: MobilePostItem[] }>("/api/instagram/posts", controller.signal),
    ]).then(([automations, posts]) => {
      if (controller.signal.aborted) return;
      setResult({ automations: automations?.automations ?? null, posts: posts?.posts ?? null });
    });

    return () => controller.abort();
  }, [enabled]);

  return {
    loading: enabled && result === null,
    automations: result?.automations ?? null,
    posts: result?.posts ?? null,
  };
}
