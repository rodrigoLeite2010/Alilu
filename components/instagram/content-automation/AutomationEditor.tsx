"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { MediaPicker } from "./MediaPicker";
import { WeekDayEditor, type DayFormState } from "./WeekDayEditor";
import { autoResizeTextarea } from "./textarea-utils";
import {
  DAYS_OF_WEEK,
  MAX_SLOTS_PER_DAY,
  type AutomationContentCategory,
  type AutomationContentMode,
  type AutomationContentType,
  type AutomationStatus,
  type DayOfWeek,
  type ImageMode,
} from "@/lib/content-automation/backend/automation-types";

/** Forma do horário como a API devolve (serializeDay) — convertida para o estado do formulário. */
interface SerializedDayDto {
  id: string;
  dayOfWeek: DayOfWeek;
  slotIndex: number;
  contentCategory: AutomationContentCategory | null;
  enabled: boolean;
  contentType: AutomationContentType;
  contentMode: AutomationContentMode;
  prompt: string;
  manualCaption: string | null;
  visualText: string | null;
  templateId: string | null;
  overlayOpacity: number | null;
  visualTextColor: string | null;
  publishTime: string;
  imageMediaId: string | null;
  videoMediaId: string | null;
}

function toDayFormState(day: SerializedDayDto): DayFormState {
  return {
    id: day.id,
    dayOfWeek: day.dayOfWeek,
    slotIndex: day.slotIndex,
    contentCategory: day.contentCategory,
    enabled: day.enabled,
    contentType: day.contentType,
    contentMode: day.contentMode,
    prompt: day.prompt,
    manualCaption: day.manualCaption ?? "",
    visualText: day.visualText ?? "",
    templateId: day.templateId,
    overlayOpacity: day.overlayOpacity,
    visualTextColor: day.visualTextColor,
    publishTime: day.publishTime,
    imageMediaId: day.imageMediaId,
    videoMediaId: day.videoMediaId,
  };
}

/** Chave estável de um horário no formulário — o id quando existe, senão dia + posição. */
function slotKey(day: DayFormState): string {
  return day.id ?? `${day.dayOfWeek}-${day.slotIndex}`;
}

export interface AutomationDetailDto {
  id: string;
  /** Conta da automação — só para a prévia do Story resolver {{nomeConta}}. */
  instagramAccountId?: string;
  name: string;
  description: string;
  status: AutomationStatus;
  timezone: string;
  brandContext: string;
  autoPublish: boolean;
  requireApproval: boolean;
  generationLeadMinutes: number;
  imageMode: ImageMode;
  fixedImageMediaId: string | null;
  fixedVideoMediaId: string | null;
  days: DayFormState[];
}

export interface PendingRunDto {
  id: string;
  runDate: string;
  status: string;
  errorMessage: string | null;
}

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

export function AutomationEditor({
  userId,
  automation,
  pendingRuns,
}: {
  userId: string;
  automation: AutomationDetailDto;
  pendingRuns: PendingRunDto[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState(automation.status);
  const [name, setName] = useState(automation.name);
  const [brandContext, setBrandContext] = useState(automation.brandContext);
  const [requireApproval, setRequireApproval] = useState(automation.requireApproval);
  const [generationLeadMinutes, setGenerationLeadMinutes] = useState(automation.generationLeadMinutes);
  const [imageMode, setImageMode] = useState<ImageMode>(automation.imageMode);
  const [fixedImageMediaId, setFixedImageMediaId] = useState(automation.fixedImageMediaId);
  const [fixedVideoMediaId, setFixedVideoMediaId] = useState(automation.fixedVideoMediaId);
  const [days, setDays] = useState<DayFormState[]>(automation.days);
  const [runs, setRuns] = useState(pendingRuns);

  const [savingConfig, setSavingConfig] = useState(false);
  const [savingDays, setSavingDays] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [runBusy, setRunBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const nameId = useId();
  const contextId = useId();
  const leadId = useId();

  const [slotBusy, setSlotBusy] = useState<string | null>(null);

  function updateDay(key: string, patch: Partial<DayFormState>) {
    setDays((list) => list.map((day) => (slotKey(day) === key ? { ...day, ...patch } : day)));
  }

  async function addSlot(dayOfWeek: DayOfWeek) {
    setSlotBusy(dayOfWeek);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/content-automation/automations/${automation.id}/days/${dayOfWeek}`, { method: "POST" });
      if (!response.ok) throw new Error(await readErrorMessage(response, "Não foi possível adicionar o horário."));
      const payload = (await response.json()) as { slotId: string; automation: { days: SerializedDayDto[] } };
      const created = payload.automation.days.find((day) => day.id === payload.slotId);
      // Só acrescenta o horário novo — nunca descarta edições ainda não salvas dos outros horários.
      if (created) setDays((list) => [...list, toDayFormState(created)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível adicionar o horário.");
    } finally {
      setSlotBusy(null);
    }
  }

  async function removeSlot(day: DayFormState) {
    if (!day.id || day.slotIndex === 0) return;
    setSlotBusy(day.id);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/content-automation/automations/${automation.id}/days/${day.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await readErrorMessage(response, "Não foi possível remover o horário."));
      setDays((list) => list.filter((candidate) => candidate.id !== day.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível remover o horário.");
    } finally {
      setSlotBusy(null);
    }
  }

  async function saveConfig() {
    setSavingConfig(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/content-automation/automations/${automation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          name,
          brandContext,
          requireApproval,
          autoPublish: !requireApproval,
          generationLeadMinutes,
          imageMode,
          fixedImageMediaId,
          fixedVideoMediaId,
        }),
      });
      if (!response.ok) throw new Error(await readErrorMessage(response, "Não foi possível salvar as configurações."));
      setNotice("Configurações salvas.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar as configurações.");
    } finally {
      setSavingConfig(false);
    }
  }

  async function saveDays() {
    setSavingDays(true);
    setError(null);
    setNotice(null);
    try {
      for (const day of days) {
        const response = await fetch(`/api/content-automation/automations/${automation.id}/days/${day.id ?? day.dayOfWeek}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            enabled: day.enabled,
            contentCategory: day.contentCategory,
            contentType: day.contentType,
            contentMode: day.contentMode,
            prompt: day.prompt,
            manualCaption: day.manualCaption,
            visualText: day.visualText,
            templateId: day.templateId,
            overlayOpacity: day.overlayOpacity,
            visualTextColor: day.visualTextColor,
            publishTime: day.publishTime,
            imageMediaId: day.imageMediaId,
            videoMediaId: day.videoMediaId,
          }),
        });
        if (!response.ok) {
          throw new Error(await readErrorMessage(response, `Não foi possível salvar ${day.dayOfWeek}.`));
        }
      }
      setNotice("Semana salva.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar a semana.");
    } finally {
      setSavingDays(false);
    }
  }

  async function toggleStatus() {
    setTogglingStatus(true);
    setError(null);
    try {
      const action = status === "ACTIVE" ? "pause" : "activate";
      const response = await fetch(`/api/content-automation/automations/${automation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, cancelScheduledRuns: false }),
      });
      if (!response.ok) throw new Error(await readErrorMessage(response, "Não foi possível alterar o status."));
      setStatus(action === "activate" ? "ACTIVE" : "PAUSED");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível alterar o status.");
    } finally {
      setTogglingStatus(false);
    }
  }

  async function handleRunAction(runId: string, action: "approve" | "reject") {
    setRunBusy(runId);
    setError(null);
    try {
      const response = await fetch(`/api/content-automation/runs/${runId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!response.ok) throw new Error(await readErrorMessage(response, "Não foi possível processar esta execução."));
      setRuns((list) => list.filter((run) => run.id !== runId));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível processar esta execução.");
    } finally {
      setRunBusy(null);
    }
  }

  const needsImage = days.some(
    (day) => day.enabled && (day.contentType === "POST" || day.contentType === "CAROUSEL" || day.contentType === "STORY"),
  );
  const needsVideo = days.some((day) => day.enabled && day.contentType === "REEL");

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Badge tone={status === "ACTIVE" ? "brand" : status === "ERROR" ? "warning" : "neutral"}>{STATUS_LABEL[status]}</Badge>
        {status !== "ARCHIVED" ? (
          <Button variant="secondary" disabled={togglingStatus} onClick={toggleStatus}>
            {togglingStatus ? "Aguarde…" : status === "ACTIVE" ? "Pausar automação" : "Ativar automação"}
          </Button>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-800">
          {notice}
        </p>
      ) : null}

      {runs.length > 0 ? (
        <section className="rounded-lg border border-amber-300 bg-amber-50/50 p-4">
          <h2 className="text-sm font-semibold text-zinc-900">Aguardando aprovação</h2>
          <ul className="mt-2 space-y-2">
            {runs.map((run) => (
              <li key={run.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white px-3 py-2 text-sm">
                <span>{run.runDate}</span>
                <div className="flex gap-2">
                  <Button disabled={runBusy === run.id} onClick={() => handleRunAction(run.id, "approve")}>
                    Aprovar
                  </Button>
                  <Button variant="ghost" disabled={runBusy === run.id} onClick={() => handleRunAction(run.id, "reject")}>
                    Rejeitar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-zinc-900">Configurações</h2>
        <div>
          <label htmlFor={nameId} className="mb-1 block text-sm font-medium text-zinc-800">
            Nome
          </label>
          <input
            id={nameId}
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full min-h-11 rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor={contextId} className="mb-1 block text-sm font-medium text-zinc-800">
            Contexto geral da marca
          </label>
          <textarea
            id={contextId}
            ref={autoResizeTextarea}
            value={brandContext}
            onChange={(event) => {
              setBrandContext(event.target.value);
              autoResizeTextarea(event.target);
            }}
            onFocus={(event) => autoResizeTextarea(event.target)}
            rows={6}
            maxLength={2000}
            className="w-full min-h-[144px] resize-y rounded-md border border-zinc-300 px-3 py-2 text-sm leading-relaxed"
          />
          <p className="mt-1 text-xs text-zinc-500">{brandContext.length}/2000</p>
        </div>
        <fieldset className="rounded-md border border-zinc-200 p-3">
          <legend className="px-1 text-sm font-medium text-zinc-800">Modo de publicação</legend>
          <label className="flex items-start gap-2 py-1 text-sm">
            <input
              type="radio"
              name="edit-mode"
              checked={requireApproval}
              onChange={() => setRequireApproval(true)}
              className="mt-0.5 h-4 w-4 border-zinc-300 text-teal-700"
            />
            Modo aprovação
          </label>
          <label className="flex items-start gap-2 py-1 text-sm">
            <input
              type="radio"
              name="edit-mode"
              checked={!requireApproval}
              onChange={() => setRequireApproval(false)}
              className="mt-0.5 h-4 w-4 border-zinc-300 text-teal-700"
            />
            Modo automático
          </label>
        </fieldset>
        <div>
          <label htmlFor={leadId} className="mb-1 block text-sm font-medium text-zinc-800">
            Gerar com antecedência (minutos)
          </label>
          <input
            id={leadId}
            type="number"
            min={0}
            max={1440}
            value={generationLeadMinutes}
            onChange={(event) => setGenerationLeadMinutes(Math.max(0, Math.min(1440, Number(event.target.value) || 0)))}
            className="w-32 min-h-11 rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>

        {needsImage ? (
          <fieldset className="rounded-md border border-zinc-200 p-3">
            <legend className="px-1 text-sm font-medium text-zinc-800">Como definir a imagem dos posts</legend>
            <label className="flex items-start gap-2 py-1 text-sm">
              <input
                type="radio"
                name="edit-image-mode"
                checked={imageMode === "FIXED_IMAGE"}
                onChange={() => setImageMode("FIXED_IMAGE")}
                className="mt-0.5 h-4 w-4 border-zinc-300 text-teal-700"
              />
              <span>
                <strong>Imagem fixa</strong> — publica a foto escolhida abaixo do jeito que ela é.
              </span>
            </label>
            <label className="flex items-start gap-2 py-1 text-sm">
              <input
                type="radio"
                name="edit-image-mode"
                checked={imageMode === "MEDIA_LIBRARY"}
                onChange={() => setImageMode("MEDIA_LIBRARY")}
                className="mt-0.5 h-4 w-4 border-zinc-300 text-teal-700"
              />
              <span>
                <strong>Biblioteca de imagens</strong> — cada dia pode usar uma foto diferente, publicada como está.
              </span>
            </label>
            <label className="flex items-start gap-2 py-1 text-sm">
              <input
                type="radio"
                name="edit-image-mode"
                checked={imageMode === "AUTO_TEMPLATE"}
                onChange={() => setImageMode("AUTO_TEMPLATE")}
                className="mt-0.5 h-4 w-4 border-zinc-300 text-teal-700"
              />
              <span>
                <strong>Gerar com IA sobre a imagem</strong> — desenha um texto curto (IA ou manual) sobre a foto de fundo, com o template escolhido em cada dia.
              </span>
            </label>
          </fieldset>
        ) : null}

        {needsImage ? (
          <div>
            <p className="mb-1 text-sm font-medium text-zinc-800">
              {imageMode === "AUTO_TEMPLATE" ? "Foto de fundo padrão" : "Imagem padrão"}
            </p>
            <MediaPicker userId={userId} mediaType="image" value={fixedImageMediaId} onChange={setFixedImageMediaId} />
          </div>
        ) : null}
        {needsVideo ? (
          <div>
            <p className="mb-1 text-sm font-medium text-zinc-800">Vídeo padrão</p>
            <MediaPicker userId={userId} mediaType="video" value={fixedVideoMediaId} onChange={setFixedVideoMediaId} />
          </div>
        ) : null}

        <Button onClick={saveConfig} disabled={savingConfig}>
          {savingConfig ? "Salvando…" : "Salvar configurações"}
        </Button>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-zinc-900">Semana</h2>
        <div className="space-y-3">
          {DAYS_OF_WEEK.map((dow) => {
            const slots = days
              .filter((candidate) => candidate.dayOfWeek === dow)
              .sort((a, b) => a.slotIndex - b.slotIndex);
            if (slots.length === 0) return null;
            return (
              <div key={dow} className="space-y-2">
                {slots.map((day) => (
                  <WeekDayEditor
                    key={slotKey(day)}
                    userId={userId}
                    day={day}
                    imageMode={imageMode}
                    defaultImageMediaId={fixedImageMediaId}
                    onChange={(patch) => updateDay(slotKey(day), patch)}
                    onRemove={day.slotIndex > 0 && day.id ? () => removeSlot(day) : undefined}
                    previewContext={{ instagramAccountId: automation.instagramAccountId ?? null, automationName: name, brandContext }}
                  />
                ))}
                {slots.length < MAX_SLOTS_PER_DAY ? (
                  <button
                    type="button"
                    onClick={() => addSlot(dow)}
                    disabled={slotBusy !== null}
                    className="text-sm font-medium text-teal-800 hover:underline disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                  >
                    {slotBusy === dow ? "Adicionando…" : "+ Adicionar horário"}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
        <Button onClick={saveDays} disabled={savingDays}>
          {savingDays ? "Salvando…" : "Salvar semana"}
        </Button>
      </section>

      <p className="text-xs text-zinc-500">Fuso horário da automação: {automation.timezone}.</p>
    </div>
  );
}

