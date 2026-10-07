"use client";

import { useId, type ReactNode } from "react";
import { DAYS_OF_WEEK, DAY_OF_WEEK_LABEL, type DayOfWeek, type ImageMode } from "@/lib/content-automation/backend/automation-types";
import {
  DAY_SHORT_LABEL,
  MAX_SHARED_TIMES,
  SCHEDULE_TIME_RE,
  formatDaysSummary,
  suggestNextTime,
} from "@/lib/content-automation/shared-schedule";
import { WeekDayEditor, type DayFormState, type StoryPreviewContext } from "./WeekDayEditor";

export interface SharedScheduleState {
  days: DayOfWeek[];
  times: string[];
}

/** Estado inicial do conteúdo compartilhado (o mesmo formato de uma linha de dia, já "habilitada"). */
export function emptySharedContent(): DayFormState {
  return {
    dayOfWeek: "MONDAY",
    slotIndex: 0,
    contentCategory: null,
    enabled: true,
    contentType: "POST",
    contentMode: "AI",
    prompt: "",
    manualCaption: "",
    visualText: "",
    templateId: null,
    overlayOpacity: null,
    visualTextColor: null,
    publishTime: "09:00",
    imageMediaId: null,
    videoMediaId: null,
  };
}

/** Primeiro problema da agenda (ou null) — mesmas regras do servidor (validateSharedSchedule). */
export function sharedScheduleError(schedule: SharedScheduleState): string | null {
  if (schedule.days.length === 0) return "Escolha pelo menos um dia da semana.";
  if (schedule.times.length === 0) return "Adicione pelo menos um horário.";
  if (schedule.times.some((time) => !SCHEDULE_TIME_RE.test(time))) return "Preencha todos os horários.";
  const repeated = schedule.times.find((time, index) => schedule.times.indexOf(time) !== index);
  if (repeated) return `O horário ${repeated} está repetido.`;
  return null;
}

/** Corpo do PATCH "update-shared" a partir do formulário. */
export function sharedContentPayload(content: DayFormState) {
  return {
    contentType: content.contentType,
    contentMode: content.contentMode,
    contentCategory: content.contentCategory,
    prompt: content.prompt,
    manualCaption: content.manualCaption,
    visualText: content.visualText,
    templateId: content.templateId,
    overlayOpacity: content.overlayOpacity,
    visualTextColor: content.visualTextColor,
    imageMediaId: content.imageMediaId,
    videoMediaId: content.videoMediaId,
  };
}

const TYPE_LABEL = { POST: "Post", CAROUSEL: "Carrossel", STORY: "Story", REEL: "Reel" } as const;

/**
 * Formulário do modo "Prompt único recorrente": UM conteúdo (prompt…),
 * N dias e N horários. O usuário cadastra o prompt uma vez; o servidor
 * cria as execuções (dias × horários) — ver lib/content-automation/
 * shared-schedule.ts. Componente controlado: quem usa guarda o estado.
 */
export function SharedPromptEditor({
  userId,
  content,
  onContentChange,
  schedule,
  onScheduleChange,
  imageMode,
  defaultImageMediaId = null,
  previewContext,
  footer,
}: {
  userId: string;
  content: DayFormState;
  onContentChange: (patch: Partial<DayFormState>) => void;
  schedule: SharedScheduleState;
  onScheduleChange: (next: SharedScheduleState) => void;
  imageMode: ImageMode;
  defaultImageMediaId?: string | null;
  previewContext?: StoryPreviewContext;
  /** Ação principal (ex.: "Salvar"). No celular fica numa barra fixa acima da navegação inferior, junto do total semanal. */
  footer?: ReactNode;
}) {
  const timesId = useId();
  const allSelected = schedule.days.length === DAYS_OF_WEEK.length;
  const weekly = schedule.days.length * schedule.times.length;
  const scheduleError = sharedScheduleError(schedule);
  const repeatedTimes = new Set(schedule.times.filter((time, index) => schedule.times.indexOf(time) !== index));
  const promptText = (content.contentMode === "MANUAL" ? content.manualCaption : content.prompt).trim();
  const usesAi = content.contentMode === "AI";

  function toggleDay(day: DayOfWeek) {
    const selected = schedule.days.includes(day);
    const days = selected ? schedule.days.filter((candidate) => candidate !== day) : [...schedule.days, day];
    onScheduleChange({ ...schedule, days: DAYS_OF_WEEK.filter((candidate) => days.includes(candidate)) });
  }

  function setTime(index: number, value: string) {
    onScheduleChange({ ...schedule, times: schedule.times.map((time, position) => (position === index ? value : time)) });
  }

  return (
    <div className="space-y-4">
      {/* Mobile: uma coluna (prompt → dias → horários → resumo). Desktop (lg): prompt à esquerda, agenda e resumo à direita. */}
      <div className="space-y-6 lg:grid lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start lg:gap-6 lg:space-y-0">
        <WeekDayEditor
          shared
          userId={userId}
          day={{ ...content, enabled: true }}
          imageMode={imageMode}
          defaultImageMediaId={defaultImageMediaId}
          onChange={(patch) => onContentChange({ ...patch, enabled: true })}
          previewContext={previewContext}
        />

        <div className="space-y-6 lg:sticky lg:top-4">
          <fieldset className="min-w-0 rounded-lg border border-zinc-200 p-3 sm:p-4">
            <legend className="px-1 text-sm font-semibold text-zinc-900">Dias da semana</legend>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-7 lg:grid-cols-4">
              {DAYS_OF_WEEK.map((day) => {
                const selected = schedule.days.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={selected}
                    aria-label={DAY_OF_WEEK_LABEL[day]}
                    onClick={() => toggleDay(day)}
                    className={`min-h-11 rounded-md border px-1 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                      selected ? "border-teal-700 bg-teal-700 text-white" : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                    }`}
                  >
                    {DAY_SHORT_LABEL[day]}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => onScheduleChange({ ...schedule, days: allSelected ? [] : [...DAYS_OF_WEEK] })}
              className="mt-2 min-h-11 w-full rounded-md border border-teal-700/30 px-3 py-2 text-sm font-medium text-teal-800 hover:bg-teal-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            >
              {allSelected ? "Limpar" : "Selecionar todos"}
            </button>
          </fieldset>

          <fieldset className="min-w-0 rounded-lg border border-zinc-200 p-3 sm:p-4">
            <legend className="px-1 text-sm font-semibold text-zinc-900">Horários</legend>
            <ul className="space-y-2" id={timesId}>
              {schedule.times.map((time, index) => (
                <li key={index} className="flex items-center gap-2">
                  <input
                    type="time"
                    aria-label={`Horário ${index + 1}`}
                    value={time}
                    onChange={(event) => setTime(index, event.target.value)}
                    aria-invalid={repeatedTimes.has(time)}
                    className={`min-h-11 min-w-0 flex-1 rounded-md border px-3 py-2 text-base sm:text-sm ${repeatedTimes.has(time) ? "border-red-400" : "border-zinc-300"}`}
                  />
                  <button
                    type="button"
                    aria-label={`Remover horário ${time || index + 1}`}
                    disabled={schedule.times.length <= 1}
                    onClick={() => onScheduleChange({ ...schedule, times: schedule.times.filter((_, position) => position !== index) })}
                    className="min-h-11 min-w-11 shrink-0 rounded-md border border-zinc-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                  >
                    <span aria-hidden="true">✕</span>
                  </button>
                </li>
              ))}
            </ul>
            {schedule.times.length < MAX_SHARED_TIMES ? (
              <button
                type="button"
                onClick={() => onScheduleChange({ ...schedule, times: [...schedule.times, suggestNextTime(schedule.times)] })}
                className="mt-2 min-h-11 w-full rounded-md border border-dashed border-teal-700/40 px-3 py-2 text-sm font-medium text-teal-800 hover:bg-teal-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
              >
                + Adicionar horário
              </button>
            ) : (
              <p className="mt-2 text-xs text-zinc-500">Máximo de {MAX_SHARED_TIMES} horários por dia.</p>
            )}
            {repeatedTimes.size > 0 ? (
              <p role="alert" className="mt-2 text-sm text-red-700">
                Não repita horários: {[...repeatedTimes].join(", ")}.
              </p>
            ) : null}
          </fieldset>

          <section aria-label="Resumo da automação" className="rounded-lg border border-teal-300 bg-teal-50/40 p-3 text-sm text-zinc-800 sm:p-4">
            <h3 className="font-semibold text-zinc-900">Esta automação será executada</h3>
            {scheduleError ? (
              <p className="mt-1 text-zinc-600">{scheduleError}</p>
            ) : (
              <div className="mt-1 space-y-1">
                <p>
                  <strong>{formatDaysSummary(schedule.days)}</strong> às {[...schedule.times].sort().join(", ")} ({TYPE_LABEL[content.contentType]}).
                </p>
                <p className="break-words text-zinc-600">
                  Prompt: {promptText ? `“${promptText.length > 120 ? `${promptText.slice(0, 120)}…` : promptText}”` : "ainda não escrito"}
                </p>
                <p>
                  Total aproximado: <strong>{weekly} {weekly === 1 ? "execução" : "execuções"} por semana</strong>.
                </p>
                {usesAi ? (
                  <p className="text-xs text-zinc-500">Cada execução com IA usa 1 geração do seu plano ou do teste grátis.</p>
                ) : null}
              </div>
            )}
          </section>
        </div>
      </div>

      {footer ? (
        // Barra fixa no celular, acima da navegação inferior (3,5rem + área segura); no desktop volta ao fluxo normal.
        <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 -mx-4 flex items-center justify-between gap-3 border-t border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
          <span className="text-xs text-zinc-600 md:hidden" aria-hidden="true">
            {scheduleError ? "Revise a agenda" : `${weekly} ${weekly === 1 ? "execução" : "execuções"}/semana`}
          </span>
          {footer}
        </div>
      ) : null}
    </div>
  );
}
