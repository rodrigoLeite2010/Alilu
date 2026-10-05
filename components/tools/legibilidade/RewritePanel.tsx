"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { REWRITE_AUDIENCES, REWRITE_GOALS, REWRITE_MAX_CHARACTERS, type RewriteAudience, type RewriteGoal } from "@/lib/text/readability/rewrite-options";

/**
 * Reescrita com IA (Legibilidade, fase 2). Chama SÓ o backend
 * (/api/readability/rewrite) — a IA nunca é chamada do navegador. Sem
 * login, desligada ou com erro, a análise continua funcionando.
 */

interface ScoreSummary {
  score: number | null;
  levelLabel: string | null;
  words: number;
  complexWords: number;
  longSentences: number;
}

interface RewriteResponse {
  text: string;
  parts: { hook: string; body: string; cta: string } | null;
  before: ScoreSummary;
  after: ScoreSummary;
  improved: boolean;
  missingFacts: string[];
  quota: Quota;
}

interface Quota {
  used: number;
  limit: number;
  unlimited: boolean;
}

interface Status {
  enabled: boolean;
  authenticated: boolean;
  quota: Quota | null;
}

function Comparison({ title, summary }: { title: string; summary: ScoreSummary }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{title}</p>
      <dl className="mt-2 space-y-1 text-sm text-zinc-700">
        <div className="flex justify-between gap-2"><dt>Legibilidade</dt><dd className="font-semibold">{summary.levelLabel ?? "—"}</dd></div>
        <div className="flex justify-between gap-2"><dt>Nota</dt><dd className="font-semibold">{summary.score ?? "—"}</dd></div>
        <div className="flex justify-between gap-2"><dt>Palavras complexas</dt><dd>{summary.complexWords}</dd></div>
        <div className="flex justify-between gap-2"><dt>Frases longas</dt><dd>{summary.longSentences}</dd></div>
      </dl>
    </div>
  );
}

export function RewritePanel({ text, onUseVersion }: { text: string; onUseVersion: (text: string) => void }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [audience, setAudience] = useState<RewriteAudience>("general");
  const [lastRequest, setLastRequest] = useState<{ goal: RewriteGoal; audience: RewriteAudience } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RewriteResponse | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/readability/rewrite", { cache: "no-store" })
      .then((response) => (response.ok ? (response.json() as Promise<Status>) : null))
      .then((loaded) => {
        if (!cancelled && loaded) setStatus(loaded);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (!status || !status.enabled) return null;

  async function run(goal: RewriteGoal, chosenAudience: RewriteAudience) {
    setLoading(true);
    setError(null);
    setNotice(null);
    setLastRequest({ goal, audience: chosenAudience });
    try {
      const response = await fetch("/api/readability/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, goal, audience: chosenAudience }),
      });
      const body = (await response.json().catch(() => ({}))) as Partial<RewriteResponse> & { error?: string };
      if (!response.ok || !body.text) {
        setError(body.error ?? "Não conseguimos simplificar o texto agora. Tente novamente.");
        return;
      }
      setResult(body as RewriteResponse);
      setStatus((current) => (current ? { ...current, quota: (body as RewriteResponse).quota } : current));
    } catch {
      setError("Não conseguimos simplificar o texto agora. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice("Texto copiado.");
    } catch {
      setNotice("Não foi possível copiar. Selecione o texto e copie manualmente.");
    }
  }

  const tooLong = text.length > REWRITE_MAX_CHARACTERS;
  const isHook = lastRequest?.goal === "hook";

  return (
    <section className="space-y-4 rounded-lg border border-teal-200 bg-teal-50/50 p-4 sm:p-5" data-testid="rewrite-panel">
      <div>
        <h2 className="text-base font-semibold text-zinc-900">Melhorar com IA</h2>
        <p className="mt-1 text-sm text-zinc-600">A IA reescreve mantendo o sentido, nomes, números e links. Depois, o Alilu mede de novo para mostrar se ficou mais simples.</p>
      </div>

      {!status.authenticated ? (
        <p className="text-sm text-zinc-700">
          <Link href="/entrar" className="font-semibold text-teal-800 underline">
            Entre na sua conta
          </Link>{" "}
          para simplificar o texto com IA. A análise continua grátis e sem cadastro.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <label className="block text-sm">
              <span className="font-medium text-zinc-800">Público</span>
              <select
                value={audience}
                onChange={(event) => setAudience(event.target.value as RewriteAudience)}
                disabled={loading}
                className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 sm:w-56"
              >
                {REWRITE_AUDIENCES.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {status.quota ? (
              <p className="text-xs text-zinc-500" data-testid="rewrite-quota">
                {status.quota.unlimited ? "Administrador — reescritas ilimitadas" : `${status.quota.used} de ${status.quota.limit} reescritas com IA usadas hoje`}
              </p>
            ) : null}
          </div>

          {tooLong ? (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Para reescrever com IA, use até {REWRITE_MAX_CHARACTERS.toLocaleString("pt-BR")} caracteres por vez (a análise aceita textos maiores).
            </p>
          ) : null}

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Button type="button" onClick={() => void run("simplify", audience)} disabled={loading || tooLong} className="justify-center">
              Simplificar
            </Button>
            <Button type="button" variant="secondary" onClick={() => void run("simplify", "child10")} disabled={loading || tooLong} className="justify-center">
              Criança de 10 anos
            </Button>
            {REWRITE_GOALS.filter((goal) => goal.id !== "simplify").map((goal) => (
              <Button key={goal.id} type="button" variant="secondary" onClick={() => void run(goal.id, audience)} disabled={loading || tooLong} className="justify-center">
                {goal.button}
              </Button>
            ))}
          </div>

          {loading ? (
            <p role="status" className="rounded-md bg-white px-3 py-2 text-sm text-teal-800">
              Reescrevendo com IA… pode levar alguns segundos.
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          {result && !loading ? (
            <div className="space-y-4" data-testid="rewrite-result">
              {!isHook && !result.improved ? (
                <div role="alert" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Esta versão não ficou mais simples que o original.{" "}
                  {lastRequest ? (
                    <button type="button" className="font-semibold underline" onClick={() => void run(lastRequest.goal, lastRequest.audience)}>
                      Tentar novamente
                    </button>
                  ) : null}
                </div>
              ) : null}
              {result.missingFacts.length ? (
                <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Confira a nova versão: estes dados do original não aparecem nela — {result.missingFacts.join(", ")}.
                </p>
              ) : null}

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Antes</p>
                  <div className="mt-1 max-h-80 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-zinc-200 bg-white p-3 text-sm text-zinc-700">{text}</div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-teal-800">Depois</p>
                  {result.parts ? (
                    <div className="mt-1 space-y-3 rounded-lg border border-teal-200 bg-white p-3 text-sm text-zinc-800" data-testid="rewrite-text">
                      {(["hook", "body", "cta"] as const).map((key) =>
                        result.parts?.[key] ? (
                          <div key={key}>
                            <p className="text-xs font-bold uppercase text-teal-800">{key === "hook" ? "Gancho" : key === "body" ? "Corpo" : "CTA"}</p>
                            <p className="whitespace-pre-wrap break-words">{result.parts[key]}</p>
                          </div>
                        ) : null,
                      )}
                    </div>
                  ) : (
                    <div className="mt-1 max-h-80 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-teal-200 bg-white p-3 text-sm text-zinc-800" data-testid="rewrite-text">
                      {result.text}
                    </div>
                  )}
                </div>
              </div>

              {!isHook ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Comparison title="Antes" summary={result.before} />
                  <Comparison title="Depois" summary={result.after} />
                </div>
              ) : null}

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="button" onClick={() => void copy(result.text)} className="justify-center">
                  Copiar texto
                </Button>
                {!isHook ? (
                  <Button type="button" variant="secondary" onClick={() => onUseVersion(result.text)} className="justify-center">
                    Usar esta versão e analisar
                  </Button>
                ) : null}
              </div>
              {notice ? (
                <p role="status" className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  {notice}
                </p>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
