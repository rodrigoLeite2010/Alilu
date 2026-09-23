/**
 * Tipos compartilhados do Piloto Automático de Conteúdo. Espelham
 * exatamente os CHECKs da migração db/migrations/0004_content_automation.sql
 * — qualquer novo valor precisa ser adicionado nos dois lugares.
 */

export type AutomationStatus = "ACTIVE" | "PAUSED" | "ARCHIVED" | "ERROR";

export type DayOfWeek =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

/** Sempre nesta ordem (segunda a domingo) — usado para gerar as 7 linhas de cada automação e para a UI. */
export const DAYS_OF_WEEK: DayOfWeek[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

export const DAY_OF_WEEK_LABEL: Record<DayOfWeek, string> = {
  MONDAY: "Segunda-feira",
  TUESDAY: "Terça-feira",
  WEDNESDAY: "Quarta-feira",
  THURSDAY: "Quinta-feira",
  FRIDAY: "Sexta-feira",
  SATURDAY: "Sábado",
  SUNDAY: "Domingo",
};

export type AutomationContentType = "POST" | "REEL";

export type ImageMode = "AUTO_TEMPLATE" | "FIXED_IMAGE" | "MEDIA_LIBRARY";

export type VideoSelection = "FIXED" | "ROTATE" | "RANDOM";

export type AutomationRunStatus =
  | "PENDING"
  | "GENERATING"
  | "GENERATED"
  | "WAITING_APPROVAL"
  | "SCHEDULED"
  | "PUBLISHING"
  | "PUBLISHED"
  | "FAILED"
  | "CANCELLED";

export interface AutomationDayRecord {
  id: string;
  automationId: string;
  dayOfWeek: DayOfWeek;
  enabled: boolean;
  contentType: AutomationContentType;
  prompt: string;
  publishTime: string; // "HH:mm"
  templateId: string | null;
  styleConfig: Record<string, unknown> | null;
  imageMediaId: string | null;
  videoMediaId: string | null;
}

export interface AutomationRecord {
  id: string;
  userId: string;
  instagramAccountId: string;
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
  videoSelection: VideoSelection;
  fixedVideoMediaId: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
}

export interface AutomationWithDays extends AutomationRecord {
  days: AutomationDayRecord[];
}

export interface AutomationRunRecord {
  id: string;
  automationId: string;
  automationDayId: string;
  instagramAccountId: string;
  runDate: string; // "YYYY-MM-DD"
  status: AutomationRunStatus;
  publicationId: string | null;
  generationAttempt: number;
  errorMessage: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  nextAttemptAt: Date | null;
  createdAt: Date;
}
