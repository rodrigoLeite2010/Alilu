import "server-only";
import type { AutomationListItem } from "./automation-repository";
import type { AutomationDayRecord, AutomationRunRecord, AutomationSharedConfig, AutomationWithDays } from "./automation-types";
import { countWeeklyExecutions, deriveSharedSchedule } from "../shared-schedule";

/** Serialização para JSON das respostas da API — nunca expõe token (as automações nem o carregam) e sempre datas em ISO. */

export function serializeDay(day: AutomationDayRecord) {
  return {
    id: day.id,
    dayOfWeek: day.dayOfWeek,
    slotIndex: day.slotIndex,
    contentCategory: day.contentCategory,
    enabled: day.enabled,
    contentType: day.contentType,
    contentMode: day.contentMode,
    prompt: day.prompt,
    manualCaption: day.manualCaption,
    visualText: day.visualText,
    publishTime: day.publishTime,
    templateId: day.templateId,
    styleConfig: day.styleConfig,
    overlayOpacity: day.overlayOpacity,
    visualTextColor: day.visualTextColor,
    imageMediaId: day.imageMediaId,
    videoMediaId: day.videoMediaId,
  };
}

export function serializeSharedConfig(shared: AutomationSharedConfig) {
  return { ...shared };
}

export function serializeAutomation(automation: AutomationWithDays) {
  return {
    id: automation.id,
    instagramAccountId: automation.instagramAccountId,
    name: automation.name,
    description: automation.description,
    status: automation.status,
    scheduleMode: automation.scheduleMode,
    /** Modo inteligente de Stories (config já normalizada). */
    smartStory: automation.smartStory,
    /** Conteúdo compartilhado — só vale quando scheduleMode = "SHARED_PROMPT". */
    shared: serializeSharedConfig(automation.shared),
    /** Agenda do modo compartilhado (dias e horários habilitados) + total de execuções por semana. */
    schedule: deriveSharedSchedule(automation.days),
    weeklyExecutions: countWeeklyExecutions(automation.days),
    timezone: automation.timezone,
    brandContext: automation.brandContext,
    autoPublish: automation.autoPublish,
    requireApproval: automation.requireApproval,
    generationLeadMinutes: automation.generationLeadMinutes,
    imageMode: automation.imageMode,
    fixedImageMediaId: automation.fixedImageMediaId,
    videoSelection: automation.videoSelection,
    fixedVideoMediaId: automation.fixedVideoMediaId,
    createdAt: automation.createdAt.toISOString(),
    updatedAt: automation.updatedAt.toISOString(),
    lastRunAt: automation.lastRunAt ? automation.lastRunAt.toISOString() : null,
    nextRunAt: automation.nextRunAt ? automation.nextRunAt.toISOString() : null,
    days: automation.days.map(serializeDay),
  };
}

export function serializeAutomationListItem(item: AutomationListItem) {
  return {
    id: item.id,
    instagramAccountId: item.instagramAccountId,
    name: item.name,
    status: item.status,
    scheduleMode: item.scheduleMode,
    weeklyExecutions: item.activeSlotsCount,
    timezone: item.timezone,
    autoPublish: item.autoPublish,
    requireApproval: item.requireApproval,
    activeDaysCount: item.activeDaysCount,
    createdAt: item.createdAt.toISOString(),
    lastRunAt: item.lastRunAt ? item.lastRunAt.toISOString() : null,
    nextRunAt: item.nextRunAt ? item.nextRunAt.toISOString() : null,
  };
}

export function serializeRun(run: AutomationRunRecord) {
  return {
    id: run.id,
    automationId: run.automationId,
    runDate: run.runDate,
    status: run.status,
    publicationId: run.publicationId,
    generationAttempt: run.generationAttempt,
    errorMessage: run.errorMessage,
    startedAt: run.startedAt ? run.startedAt.toISOString() : null,
    completedAt: run.completedAt ? run.completedAt.toISOString() : null,
    nextAttemptAt: run.nextAttemptAt ? run.nextAttemptAt.toISOString() : null,
    createdAt: run.createdAt.toISOString(),
  };
}
