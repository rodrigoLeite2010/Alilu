"use client";

import { useCallback, useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/instagram/ConfirmDialog";

interface PageRow {
  id: string;
  pageName: string;
  status: "connected" | "needs_reconnect" | "revoked";
  linkedIgUsername: string | null;
  scopes: string[];
  lastErrorSanitized: string | null;
  lastCheckedAt: string | null;
}

const STATUS_LABEL: Record<PageRow["status"], string> = {
  connected: "Página conectada ✓",
  needs_reconnect: "Precisa reconectar",
  revoked: "Desconectada",
};

const CONNECT_HREF = "/api/facebook/pages/oauth/start?returnTo=%2Finstagram%2Fpainel";

async function fetchPages(): Promise<{ pages: PageRow[]; configured: boolean; requiredPermissions: string[] } | null> {
  try {
    const response = await fetch("/api/facebook/pages", { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as { pages: PageRow[]; configured: boolean; requiredPermissions: string[] };
  } catch {
    return null;
  }
}

/**
 * "Contas conectadas → Facebook": Páginas onde o Alilu pode publicar.
 * Conectar / verificar status / reconectar / desconectar. Nenhum token
 * chega ao navegador.
 */
export function FacebookPagesSection() {
  const [pages, setPages] = useState<PageRow[] | null>(null);
  const [configured, setConfigured] = useState(true);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<PageRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback((body: { pages: PageRow[]; configured: boolean; requiredPermissions: string[] } | null) => {
    if (!body) {
      setPages([]);
      setError("Não foi possível carregar as Páginas do Facebook.");
      return;
    }
    setPages(body.pages);
    setConfigured(body.configured);
    setPermissions(body.requiredPermissions ?? []);
  }, []);

  const load = useCallback(async () => apply(await fetchPages()), [apply]);

  useEffect(() => {
    let cancelled = false;
    fetchPages().then((body) => {
      if (!cancelled) apply(body);
    });
    return () => {
      cancelled = true;
    };
  }, [apply]);

  async function verify(page: PageRow) {
    setBusy(page.id);
    try {
      const response = await fetch(`/api/facebook/pages/${page.id}/verify`, { method: "POST" });
      const body = (await response.json().catch(() => ({}))) as { status?: PageRow["status"]; message?: string | null; error?: string };
      setMessage((current) => ({
        ...current,
        [page.id]: !response.ok ? body.error ?? "Falha ao verificar." : body.status === "connected" ? "Conexão válida." : body.message ?? "Precisa reconectar.",
      }));
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function disconnect(page: PageRow) {
    setBusy(page.id);
    try {
      const response = await fetch(`/api/facebook/pages/${page.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      setConfirm(null);
      await load();
    } catch {
      setMessage((current) => ({ ...current, [page.id]: "Não foi possível desconectar agora." }));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="space-y-3" aria-labelledby="facebook-pages-title">
      <h2 id="facebook-pages-title" className="text-sm font-semibold text-zinc-900">Facebook</h2>
      {!configured ? (
        <p className="text-xs text-zinc-500">A publicação em Páginas do Facebook ainda não está habilitada neste ambiente.</p>
      ) : null}
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
      {pages === null ? <p className="text-xs text-zinc-500">Carregando…</p> : null}
      {pages && pages.length > 0 ? (
        <ul className="space-y-3">
          {pages.map((page) => (
            <li key={page.id} className={`rounded-md border px-4 py-3 ${page.status === "connected" ? "border-zinc-200" : "border-amber-200 bg-amber-50"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-zinc-800">
                  <strong>{page.pageName}</strong>
                </p>
                <span className={`text-xs ${page.status === "connected" ? "text-teal-700" : "text-amber-900"}`}>{STATUS_LABEL[page.status]}</span>
              </div>
              <p className="mt-1 text-xs text-zinc-600">
                {page.linkedIgUsername ? `Instagram vinculado: @${page.linkedIgUsername}` : "Nenhum Instagram vinculado a esta Página."}
              </p>
              {page.status !== "connected" && page.lastErrorSanitized ? <p className="mt-1 text-xs text-amber-900">{page.lastErrorSanitized}</p> : null}
              {message[page.id] ? <p role="status" className="mt-1 text-xs text-zinc-700">{message[page.id]}</p> : null}
              <div className="mt-2 flex flex-wrap items-center gap-4">
                {page.status === "connected" ? (
                  <>
                    <button type="button" className="text-sm font-medium text-teal-800 underline" disabled={busy !== null} onClick={() => void verify(page)}>
                      {busy === page.id ? "Verificando…" : "Verificar status"}
                    </button>
                    <button type="button" className="text-sm font-medium text-red-700 underline" disabled={busy !== null} onClick={() => setConfirm(page)}>
                      Desconectar
                    </button>
                  </>
                ) : configured ? (
                  <a className="text-sm font-medium text-blue-800 underline" href={CONNECT_HREF}>
                    Reconectar Página
                  </a>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {configured ? (
        <a className="flex w-full justify-center rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-900" href={CONNECT_HREF}>
          {pages && pages.length > 0 ? "+ Conectar outra Página do Facebook" : "Conectar Página do Facebook"}
        </a>
      ) : null}
      {configured ? (
        <details className="text-xs text-zinc-500">
          <summary className="cursor-pointer">Permissões necessárias</summary>
          <p className="mt-1">
            O Facebook vai pedir: {permissions.join(", ")}. O Alilu publica somente na Página que você escolher — nunca no seu perfil pessoal.
          </p>
        </details>
      ) : null}
      <ConfirmDialog
        open={confirm !== null}
        title={`Desconectar a Página ${confirm?.pageName ?? ""}?`}
        description="Agendamentos para esta Página vão pedir reconexão. O que já foi publicado continua no Facebook."
        confirmLabel="Desconectar"
        destructive
        busy={busy !== null}
        onConfirm={() => confirm && void disconnect(confirm)}
        onClose={() => setConfirm(null)}
      />
    </section>
  );
}
