"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  DESTINATION_STATUS_CLASS,
  DESTINATION_STATUS_LABEL,
  type PublicationDestinationView,
} from "@/lib/facebook/destination-view";
import { describePublishOutcome, retryPublicationDestination } from "@/lib/instagram/client/publication-api";

const SMALL = "min-h-8 px-2.5 py-1 text-xs";

interface AttemptRow {
  attemptedAt: string;
  outcome: string;
  errorSanitized: string | null;
}

const OUTCOME_LABEL: Record<string, string> = {
  success: "Publicado",
  failure: "Falhou",
  pending: "Aguardando a Meta",
  reconciled: "Verificado na Página",
};

/**
 * Resultado de CADA rede de uma publicação ("Instagram: Publicado —
 * Facebook: Falha — Reconectar Página"), com "Tentar novamente" que
 * reprocessa SOMENTE aquele destino (nunca o Instagram).
 */
export function PublicationDestinationsStatus({
  instagram,
  destinations,
  onDestinationChange,
}: {
  /** null = publicação sem Instagram ("somente Facebook"). */
  instagram: { label: string; className: string; username: string | null } | null;
  destinations: PublicationDestinationView[];
  onDestinationChange?: (destination: PublicationDestinationView) => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notices, setNotices] = useState<Record<string, { kind: "ok" | "error"; text: string }>>({});
  const [attempts, setAttempts] = useState<Record<string, AttemptRow[] | "loading">>({});

  async function retry(destination: PublicationDestinationView) {
    setBusyId(destination.id);
    setNotices((current) => ({ ...current, [destination.id]: { kind: "ok", text: "Verificando a Página e tentando de novo…" } }));
    try {
      const outcome = await retryPublicationDestination(destination.id);
      const next: PublicationDestinationView = {
        ...destination,
        status: outcome === "PUBLISHED" ? "PUBLISHED" : outcome === "PROCESSING" ? "PROCESSING" : "SCHEDULED",
        error: outcome === "PUBLISHED" ? null : destination.error,
        needsReconnect: false,
      };
      onDestinationChange?.(next);
      setNotices((current) => ({ ...current, [destination.id]: { kind: "ok", text: describePublishOutcome(outcome).replace("Instagram", "Facebook") } }));
    } catch (error) {
      setNotices((current) => ({
        ...current,
        [destination.id]: { kind: "error", text: error instanceof Error ? error.message : "Não foi possível publicar no Facebook." },
      }));
    } finally {
      setBusyId(null);
    }
  }

  async function toggleAttempts(destinationId: string) {
    if (attempts[destinationId]) {
      setAttempts((current) => {
        const next = { ...current };
        delete next[destinationId];
        return next;
      });
      return;
    }
    setAttempts((current) => ({ ...current, [destinationId]: "loading" }));
    try {
      const response = await fetch(`/api/social/destinations/${destinationId}/attempts`, { cache: "no-store" });
      const body = response.ok ? ((await response.json()) as { attempts?: AttemptRow[] }) : { attempts: [] };
      setAttempts((current) => ({ ...current, [destinationId]: body.attempts ?? [] }));
    } catch {
      setAttempts((current) => ({ ...current, [destinationId]: [] }));
    }
  }

  return (
    <ul className="space-y-1 rounded-md bg-zinc-50 px-2 py-1.5 text-xs" aria-label="Resultado por rede social">
      {instagram ? (
        <li className="flex flex-wrap items-center gap-1">
          <span className="font-medium text-zinc-700">Instagram{instagram.username ? ` (@${instagram.username})` : ""}:</span>
          <span className={instagram.className}>{instagram.label}</span>
        </li>
      ) : null}
      {destinations.map((destination) => {
        const notice = notices[destination.id];
        const list = attempts[destination.id];
        const canRetry = destination.status === "FAILED" || destination.status === "NEEDS_REVIEW";
        return (
          <li key={destination.id} className="space-y-1">
            <div className="flex flex-wrap items-center gap-1">
              <span className="font-medium text-zinc-700">Facebook{destination.accountName ? ` (${destination.accountName})` : ""}:</span>
              <span className={DESTINATION_STATUS_CLASS[destination.status]}>
                {DESTINATION_STATUS_LABEL[destination.status]}
                {destination.status === "PROCESSING" ? "…" : ""}
              </span>
              {destination.status === "PUBLISHED" && destination.externalUrl ? (
                <a href={destination.externalUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-800 underline">
                  Ver publicação
                </a>
              ) : null}
            </div>
            {destination.error && destination.status !== "PUBLISHED" ? (
              <p className={destination.status === "SCHEDULED" ? "text-amber-700" : "text-red-700"}>{destination.error}</p>
            ) : null}
            <div className="flex flex-wrap gap-1.5">
              {destination.needsReconnect ? (
                <Button
                  type="button"
                  variant="secondary"
                  className={`${SMALL} border-amber-300 bg-amber-50 text-amber-900`}
                  onClick={() => window.location.assign("/api/facebook/pages/oauth/start?returnTo=%2Finstagram%2Fpainel%2Fcalendario")}
                >
                  Reconectar Página
                </Button>
              ) : null}
              {canRetry ? (
                <Button type="button" variant="secondary" className={SMALL} disabled={busyId !== null} onClick={() => void retry(destination)}>
                  {busyId === destination.id ? "Tentando…" : "Tentar novamente"}
                </Button>
              ) : null}
              {destination.attemptsCount > 0 || destination.status !== "SCHEDULED" ? (
                <Button type="button" variant="ghost" className={SMALL} onClick={() => void toggleAttempts(destination.id)}>
                  {list ? "Ocultar tentativas" : "Tentativas"}
                </Button>
              ) : null}
            </div>
            {notice ? (
              <p role={notice.kind === "error" ? "alert" : "status"} className={notice.kind === "error" ? "text-red-700" : "text-teal-700"}>
                {notice.text}
              </p>
            ) : null}
            {list === "loading" ? <p className="text-zinc-500">Carregando…</p> : null}
            {Array.isArray(list) ? (
              list.length === 0 ? (
                <p className="text-zinc-500">Nenhuma tentativa registrada.</p>
              ) : (
                <ol className="space-y-0.5 pl-3 text-zinc-600">
                  {list.map((attempt, index) => (
                    <li key={`${attempt.attemptedAt}-${index}`}>
                      {new Date(attempt.attemptedAt).toLocaleString("pt-BR")} — {OUTCOME_LABEL[attempt.outcome] ?? attempt.outcome}
                      {attempt.errorSanitized ? `: ${attempt.errorSanitized}` : ""}
                    </li>
                  ))}
                </ol>
              )
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
