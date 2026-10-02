import type { Recurrence } from "./time";

export type AgendaCategory = "PESSOAL" | "TRABALHO" | "MEDICO" | "FAMILIA" | "FESTA" | "FINANCEIRO" | "SERVICO" | "ESCOLA" | "VIAGEM" | "OUTRO";
export const AGENDA_CATEGORIES: AgendaCategory[] = ["PESSOAL", "TRABALHO", "MEDICO", "FAMILIA", "FESTA", "FINANCEIRO", "SERVICO", "ESCOLA", "VIAGEM", "OUTRO"];
export const AGENDA_CATEGORY_LABEL: Record<AgendaCategory, string> = {
  PESSOAL: "Pessoal",
  TRABALHO: "Trabalho",
  MEDICO: "Médico",
  FAMILIA: "Família",
  FESTA: "Festa",
  FINANCEIRO: "Financeiro",
  SERVICO: "Serviço",
  ESCOLA: "Escola",
  VIAGEM: "Viagem",
  OUTRO: "Outro",
};
/** Cor de cada categoria (pontinho no calendário). */
export const AGENDA_CATEGORY_COLOR: Record<AgendaCategory, string> = {
  PESSOAL: "#004b5a",
  TRABALHO: "#2563eb",
  MEDICO: "#dc2626",
  FAMILIA: "#9333ea",
  FESTA: "#db2777",
  FINANCEIRO: "#16a34a",
  SERVICO: "#ea580c",
  ESCOLA: "#ca8a04",
  VIAGEM: "#0891b2",
  OUTRO: "#71717a",
};

export type AgendaStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED";

/** Opções de lembrete (minutos antes). */
export const REMINDER_OPTIONS: Array<{ minutes: number; label: string }> = [
  { minutes: 10, label: "10 minutos antes" },
  { minutes: 30, label: "30 minutos antes" },
  { minutes: 60, label: "1 hora antes" },
  { minutes: 120, label: "2 horas antes" },
  { minutes: 1440, label: "1 dia antes" },
  { minutes: 10080, label: "1 semana antes" },
];

export function reminderLabel(minutes: number): string {
  const known = REMINDER_OPTIONS.find((option) => option.minutes === minutes);
  if (known) return known.label;
  if (minutes === 0) return "Na hora";
  if (minutes % 1440 === 0) return `${minutes / 1440} dias antes`;
  if (minutes % 60 === 0) return `${minutes / 60} horas antes`;
  return `${minutes} minutos antes`;
}

/** Evento como a tela recebe (datas em ISO/UTC + fuso para exibir). */
export interface AgendaEventDto {
  id: string;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string | null;
  isAllDay: boolean;
  timezone: string;
  category: AgendaCategory;
  location: string | null;
  status: AgendaStatus;
  recurrence: Recurrence;
  reminderOffsets: number[];
}

export interface AgendaOccurrenceDto {
  eventId: string;
  /** Início desta ocorrência (UTC ISO). */
  startAt: string;
}

export interface AgendaPreferencesDto {
  timezone: string;
  defaultReminderMinutes: number | null;
  emailRemindersEnabled: boolean;
}
