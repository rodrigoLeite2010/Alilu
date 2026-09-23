"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/instagram/ConfirmDialog";
import { formatInTimeZone } from "@/lib/instagram/schedule-time";
import type { AutomationStatus } from "@/lib/content-automation/backend/automation-types";

export interface AutomationListItemDto {
  id: string;
  name: string;
  status: AutomationStatus;
  timezone: string;
  autoPublish: boolean;
  requireApproval: boolean;
  activeDaysCount: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
}

const STATUS_TONE: Record<AutomationStatus, "neutral" | "brand" | "warning"> = {
  ACTIVE: "brand",
  PAUSED: "neutral",
  ARCHIVED: "neutral",
  ERROR: "warning",
};

const STATUS_LABEL: Record<AutomationStatus, string> = {
  ACTIVE: "Ativa",
  PAUSED: "Pausada",
  ARCHIVED: "Arquivada",
  ERROR: "Erro",
};

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === "string" && body.error ? body.error : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Dashboard + "Minhas automações" (seções 28/29/30 do briefing) em um só
 * componente client, sobre a lista já carregada pelo servidor — mesmo
 * padrão de PublicationsManager.
 */
export function AutomationsOverview({ initialAutomations }: { initialAutomations: AutomationListItemDto[] }) {
  const [automations, setAutomations] = useState(initialAutomations);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pauseTarget, setPauseTarget] = useState<AutomationListItemDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AutomationListItemDto | null>(null);

  const stats = useMemo(() => {
    const active = automations.filter((item) => item.status === "ACTIVE").length;
    const next = automations
      .filter((item) => item.nextRunAt)
      .sort((a, b) => (a.nextRunAt! < b.nextRunAt! ? -1 : 1))[0];
    return { total: automations.length, active, next };
  }, [automations]);

  async function runAction(id: string, body: Record<string, unknown>): Promise<boolean> {
    setBusyId(id);
    setError(null);
    try {
      const response = await fetch(`/api/content-automation/automations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Não foi possível concluir a ação."));
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível concluir a ação.");
      return false;
    } finally {
      setBusyId(null);
    }
  }

  async function handleActivate(item: AutomationListItemDto) {
    const ok = await runAction(item.id, { action: "activate" });
    if (ok) setAutomations((list) => list.map((a) => (a.id === item.id ? { ...a, status: "ACTIVE" } : a)));
  }

  async function handlePauseConfirmed(cancelScheduledRuns: boolean) {
    if (!pauseTarget) return;
    const target = pauseTarget;
    const ok = await runAction(target.id, { action: "pause", cancelScheduledRuns });
    if (ok) setAutomations((list) => list.map((a) => (a.id === target.id ? { ...a, status: "PAUSED" } : a)));
    if (ok) setPauseTarget(null);
  }

  async function handleDuplicate(item: AutomationListItemDto) {
    setBusyId(item.id);
    setError(null);
    try {
      const response = await fetch(`/api/content-automation/automations/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "duplicate" }),
      });
      if (!response.ok) throw new Error(await readErrorMessage(response, "Não foi possível duplicar a automação."));
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível duplicar a automação.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteConfirmed() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setBusyId(target.id);
    setError(null);
    try {
      const response = await fetch(`/api/content-automation/automations/${target.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await readErrorMessage(response, "Não foi possível excluir a automação."));
      setAutomations((list) => list.filter((a) => a.id !== target.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível excluir a automação.");
    } finally {
      setBusyId(null);
      setDeleteTarget(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-md border border-zinc-200 p-3">
          <p className="text-xs text-zinc-500">Automações</p>
          <p className="text-xl font-semibold text-zinc-900">{stats.total}</p>
        </div>
        <div className="rounded-md border border-zinc-200 p-3">
          <p className="text-xs text-zinc-500">Ativas</p>
          <p className="text-xl font-semibold text-teal-800">{stats.active}</p>
        </div>
        <div className="col-span-2 rounded-md border border-zinc-200 p-3 sm:col-span-2">
          <p className="text-xs text-zinc-500">Próxima publicação</p>
          <p className="text-sm font-medium text-zinc-900">
            {stats.next ? formatInTimeZone(stats.next.nextRunAt, stats.next.timezone) : "Nenhuma agendada"}
          </p>
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {automations.length === 0 ? (
        <p className="rounded-md border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-600">
          Você ainda não criou nenhuma automação.
        </p>
      ) : (
        <ul className="space-y-3">
          {automations.map((item) => (
            <li key={item.id} className="rounded-lg border border-zinc-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Link href={`/instagram/piloto-automatico/automacoes/${item.id}`} className="font-semibold text-zinc-900 hover:underline">
                    {item.name}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                    <Badge tone={STATUS_TONE[item.status]}>{STATUS_LABEL[item.status]}</Badge>
                    <span>{item.activeDaysCount} dia(s) ativo(s)</span>
                    <span>{item.requireApproval ? "Modo aprovação" : "Modo automático"}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {item.status === "ACTIVE" ? (
                    <Button variant="secondary" disabled={busyId === item.id} onClick={() => setPauseTarget(item)}>
                      Pausar
                    </Button>
                  ) : item.status !== "ARCHIVED" ? (
                    <Button variant="secondary" disabled={busyId === item.id} onClick={() => handleActivate(item)}>
                      Ativar
                    </Button>
                  ) : null}
                  <LinkButton variant="secondary" href={`/instagram/piloto-automatico/automacoes/${item.id}`}>
                    Editar
                  </LinkButton>
                  <LinkButton variant="ghost" href={`/instagram/piloto-automatico/automacoes/${item.id}/historico`}>
                    Histórico
                  </LinkButton>
                  <Button variant="ghost" disabled={busyId === item.id} onClick={() => handleDuplicate(item)}>
                    Duplicar
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-red-700 hover:bg-red-50"
                    disabled={busyId === item.id}
                    onClick={() => setDeleteTarget(item)}
                  >
                    Excluir
                  </Button>
                </div>
              </div>
              {item.nextRunAt ? (
                <p className="mt-2 text-xs text-zinc-500">Próxima execução: {formatInTimeZone(item.nextRunAt, item.timezone)}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {pauseTarget ? (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-lg">
            <h2 className="text-base font-semibold text-zinc-900">Pausar &quot;{pauseTarget.name}&quot;</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Pausar impede novas gerações a partir de agora. Publicações já geradas e agendadas podem continuar ou ser
              canceladas também.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <Button disabled={busyId === pauseTarget.id} onClick={() => handlePauseConfirmed(false)}>
                Pausar (manter agendamentos futuros)
              </Button>
              <Button
                variant="secondary"
                disabled={busyId === pauseTarget.id}
                onClick={() => handlePauseConfirmed(true)}
              >
                Pausar e cancelar publicações futuras
              </Button>
              <Button variant="ghost" disabled={busyId === pauseTarget.id} onClick={() => setPauseTarget(null)}>
                Voltar sem pausar
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Excluir automação"
        description={`Isso exclui "${deleteTarget?.name ?? ""}" e seu histórico. Publicações já publicadas no Instagram não são afetadas.`}
        confirmLabel="Excluir"
        destructive
        busy={busyId === deleteTarget?.id}
        onConfirm={handleDeleteConfirmed}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
