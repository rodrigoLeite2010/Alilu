"use client";

import { useState } from "react";

interface Candidate { pageId: string; pageName: string; igUserId: string; username: string | null; }

export function FacebookInstagramAccountPicker({ attemptId, targetIgUserId, accounts }: { attemptId: string; targetIgUserId: string | null; accounts: Candidate[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function choose(candidate: Candidate, connectAsNew: boolean) {
    setBusy(candidate.pageId); setError(null);
    const response = await fetch("/api/instagram/facebook-oauth/select", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ attemptId, pageId: candidate.pageId, connectAsNew }) });
    const result = await response.json().catch(() => ({})) as { error?: string; redirect?: string };
    if (!response.ok || !result.redirect) { setError(result.error ?? "Não foi possível conectar essa conta."); setBusy(null); return; }
    window.location.assign(result.redirect);
  }
  if (accounts.length === 0) return <div className="mt-5 rounded border p-4 text-sm">A Meta não disponibilizou Páginas com contas profissionais vinculadas. Confira os vínculos e permissões no Meta Business Suite. <a className="font-medium underline" href="/instagram/painel">Voltar ao painel</a></div>;
  return <div className="mt-6 space-y-3">
    {accounts.map((account) => <article key={account.pageId} className="rounded border p-4">
      <p className="font-semibold">@{account.username ?? account.igUserId}</p><p className="text-sm text-zinc-600">Página: {account.pageName}</p>
      <button disabled={busy !== null} onClick={() => void choose(account, false)} className="mt-3 rounded bg-teal-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{busy === account.pageId ? "Conectando…" : targetIgUserId === account.igUserId ? "Reconectar esta conta" : "Conectar esta conta"}</button>
      {targetIgUserId && targetIgUserId !== account.igUserId ? <button disabled={busy !== null} onClick={() => void choose(account, true)} className="ml-3 mt-3 rounded border px-4 py-2 text-sm font-medium disabled:opacity-50">Adicionar como nova conta</button> : null}
    </article>)}
    {error ? <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
    <a className="inline-block pt-3 text-sm underline" href="/instagram/painel">Cancelar e voltar</a>
  </div>;
}
