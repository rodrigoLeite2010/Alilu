"use client";

import { useEffect, useState } from "react";

interface Candidate {
  pageId: string;
  pageName: string;
  canPublish: boolean;
  linkedIgUsername: string | null;
  linkedToMyInstagram: boolean;
}

/**
 * Escolha EXPLÍCITA das Páginas a conectar depois do login na Meta.
 * Nada é pré-selecionado: com várias Páginas, a pessoa marca a certa.
 */
export function FacebookPagePicker({ attemptId }: { attemptId: string }) {
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/facebook/pages/oauth/attempt?attempt=${encodeURIComponent(attemptId)}`, { cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json().catch(() => ({}))) as { pages?: Candidate[]; error?: string };
        if (cancelled) return;
        if (!response.ok) {
          setError(body.error ?? "Não foi possível consultar suas Páginas.");
          setCandidates([]);
          return;
        }
        setCandidates(body.pages ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Não foi possível consultar suas Páginas.");
          setCandidates([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [attemptId]);

  async function submit() {
    if (selected.length === 0) {
      setError("Marque a Página onde o Alilu vai publicar.");
      return;
    }
    setBusy(true);
    setError(null);
    const response = await fetch("/api/facebook/pages/oauth/select", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ attemptId, pageIds: selected }),
    });
    const body = (await response.json().catch(() => ({}))) as { error?: string; redirect?: string };
    if (!response.ok || !body.redirect) {
      setError(body.error ?? "Não foi possível conectar as Páginas.");
      setBusy(false);
      return;
    }
    window.location.assign(body.redirect);
  }

  if (candidates === null) return <p className="mt-6 text-sm text-zinc-600">Consultando suas Páginas na Meta…</p>;
  if (candidates.length === 0) {
    return (
      <div className="mt-5 rounded border p-4 text-sm">
        {error ?? "A Meta não disponibilizou nenhuma Página para este login. Confira se você administra a Página e se ela foi marcada na autorização."}{" "}
        <a className="font-medium underline" href="/instagram/painel">
          Voltar ao painel
        </a>
      </div>
    );
  }
  return (
    <div className="mt-6 space-y-3">
      {candidates.map((candidate) => (
        <label key={candidate.pageId} className={`flex items-start gap-3 rounded border p-4 ${candidate.canPublish ? "" : "opacity-60"}`}>
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-blue-700"
            disabled={!candidate.canPublish || busy}
            checked={selected.includes(candidate.pageId)}
            onChange={(event) =>
              setSelected((current) => (event.target.checked ? [...current, candidate.pageId] : current.filter((id) => id !== candidate.pageId)))
            }
          />
          <span>
            <span className="block font-semibold">{candidate.pageName}</span>
            <span className="block text-sm text-zinc-600">
              {candidate.linkedIgUsername ? `Instagram vinculado: @${candidate.linkedIgUsername}` : "Sem Instagram vinculado"}
              {candidate.linkedToMyInstagram ? " · conta conectada no Alilu" : ""}
            </span>
            {!candidate.canPublish ? <span className="block text-xs text-amber-800">Você não tem permissão para criar conteúdo nesta Página.</span> : null}
          </span>
        </label>
      ))}
      {error ? (
        <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <button type="button" disabled={busy} onClick={() => void submit()} className="rounded bg-blue-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
        {busy ? "Conectando…" : "Conectar Páginas selecionadas"}
      </button>
      <a className="ml-4 inline-block text-sm underline" href="/instagram/painel">
        Cancelar
      </a>
    </div>
  );
}
