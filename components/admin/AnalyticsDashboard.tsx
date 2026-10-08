"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Summary {
  onlineNow: number;
  visitorsToday: number;
  sessionsToday: number;
  pageViewsToday: number;
  onlineWindowMinutes: number;
  generatedAt: string;
}
interface TopPage {
  path: string;
  views: number;
}
interface RecentVisit {
  time: string;
  path: string;
  userType: "logged" | "anonymous";
}
interface ApiResult<T> {
  configured?: boolean;
  data?: T;
  error?: string;
}

const REFRESH_MS = 60_000;
const number = new Intl.NumberFormat("pt-BR");

async function load<T>(url: string): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, { cache: "no-store" });
    const body = (await response.json()) as ApiResult<T>;
    if (!response.ok && !body.error) return { error: "Não foi possível carregar." };
    return body;
  } catch {
    return { error: "Não foi possível carregar." };
  }
}

function Card({ label, value, hint, highlight }: { label: string; value: number | null; hint?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 ${highlight ? "border-teal-700 bg-teal-50/60" : "border-zinc-200"}`}>
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-zinc-900">{value === null ? "—" : number.format(value)}</p>
      {hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}

/** Painel de acessos (PostHog). Mobile first: cards em grade 2×2 e listas em linhas, sem tabela larga. */
export function AnalyticsDashboard() {
  const [summary, setSummary] = useState<ApiResult<Summary> | null>(null);
  const [pages, setPages] = useState<ApiResult<TopPage[]> | null>(null);
  const [recent, setRecent] = useState<ApiResult<RecentVisit[]> | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    const [s, p, r] = await Promise.all([
      load<Summary>("/api/admin/analytics/summary"),
      load<TopPage[]>("/api/admin/analytics/pages"),
      load<RecentVisit[]>("/api/admin/analytics/recent"),
    ]);
    setSummary(s);
    setPages(p);
    setRecent(r);
  }, []);

  useEffect(() => {
    const first = setTimeout(() => void refresh(), 0);
    // Atualiza a cada 60 s, só com a aba visível.
    timer.current = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, REFRESH_MS);
    return () => {
      clearTimeout(first);
      if (timer.current) clearInterval(timer.current);
    };
  }, [refresh]);

  if (summary && summary.configured === false) {
    return (
      <p className="rounded-md border border-dashed border-zinc-300 p-4 text-sm text-zinc-700">
        Analytics ainda não configurado. Defina <code>POSTHOG_PERSONAL_API_KEY</code> e <code>POSTHOG_PROJECT_ID</code> no servidor (veja docs/analytics.md).
      </p>
    );
  }

  const s = summary?.data;
  const topPages = pages?.data ?? [];
  const visits = recent?.data ?? [];
  const failed = summary?.error || pages?.error || recent?.error;

  return (
    <div className="space-y-6">
      {failed ? (
        <p role="alert" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {summary?.error ?? pages?.error ?? recent?.error}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card label="Online agora" value={s?.onlineNow ?? null} hint={`últimos ${s?.onlineWindowMinutes ?? 5} min`} highlight />
        <Card label="Visitantes hoje" value={s?.visitorsToday ?? null} />
        <Card label="Sessões hoje" value={s?.sessionsToday ?? null} />
        <Card label="Visualizações hoje" value={s?.pageViewsToday ?? null} />
      </div>
      <p className="text-xs text-zinc-500">Atualiza sozinho a cada 60 segundos. Dados do PostHog (cache de até 1 minuto).</p>

      <section className="rounded-lg border border-zinc-200 p-4">
        <h2 className="text-base font-semibold text-zinc-900">Páginas mais acessadas hoje</h2>
        {topPages.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">{pages ? "Sem acessos registrados hoje." : "Carregando…"}</p>
        ) : (
          <ol className="mt-3 divide-y divide-zinc-100 text-sm">
            {topPages.map((page, index) => (
              <li key={page.path} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 truncate text-zinc-800">
                  <span className="mr-2 text-zinc-400">{index + 1}.</span>
                  {page.path}
                </span>
                <span className="shrink-0 font-semibold text-zinc-900">{number.format(page.views)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="rounded-lg border border-zinc-200 p-4">
        <h2 className="text-base font-semibold text-zinc-900">Últimos acessos</h2>
        {visits.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">{recent ? "Nenhum acesso recente." : "Carregando…"}</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-100 text-sm">
            {visits.map((visit, index) => (
              <li key={`${visit.time}-${index}`} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 truncate text-zinc-800">{visit.path}</span>
                <span className="shrink-0 text-xs text-zinc-500">
                  {visit.userType === "logged" ? "logado" : "anônimo"} ·{" "}
                  {new Date(visit.time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
