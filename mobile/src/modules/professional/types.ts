/**
 * Espelha `Alilu.Modules.Professional.Application/Dtos.cs` e
 * `Domain/ProfessionalStatus.cs`/`ProfessionalCondominiumStatus.cs`/
 * `ProfessionalCondominiumSource.cs` (PROMPT 06). A Api serializa enums
 * como string e usa camelCase — ver `modules/auth/types.ts` para a mesma
 * observação já registrada no PROMPT 03.
 */
export type ProfessionalStatus = 'Active' | 'Inactive';

export type ProfessionalCondominiumStatus = 'Pending' | 'Active' | 'Rejected' | 'Inactive';

export type ProfessionalCondominiumSource =
  | 'AdminApproved'
  | 'ResidentRecommended'
  | 'CompletedService'
  | 'ProfessionalRequested';

export interface Professional {
  id: string;
  userId: string;
  displayName: string;
  description: string | null;
  phone: string | null;
  photoUrl: string | null;
  status: ProfessionalStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceCategory {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
}

export interface ProfessionalServiceItem {
  id: string;
  professionalId: string;
  serviceCategoryId: string;
  description: string | null;
  active: boolean;
}

export interface ProfessionalCondominiumLink {
  id: string;
  professionalId: string;
  condominiumId: string;
  status: ProfessionalCondominiumStatus;
  source: ProfessionalCondominiumSource;
  createdAt: string;
}

/** Item de diretório público (React Native: ProfessionalListScreen/ProfessionalProfileScreen). */
export interface ProfessionalDirectoryItem {
  id: string;
  displayName: string;
  description: string | null;
  phone: string | null;
  photoUrl: string | null;
  categories: ServiceCategory[];
}

/** Espelha `Alilu.Modules.Condominium.Application/Dtos.cs` — mesmo formato usado pelo módulo Resident (ver `modules/resident/types.ts`), aqui para o profissional escolher onde "solicitar atendimento". */
export interface CondominiumSummary {
  id: string;
  name: string;
  city: string;
  state: string;
}

export interface SaveProfessionalProfilePayload {
  displayName: string;
  description?: string;
  phone?: string;
  photoUrl?: string;
}

export interface AddProfessionalServicePayload {
  serviceCategoryId: string;
  description?: string;
}

export interface RequestProfessionalCondominiumPayload {
  condominiumId: string;
}

/**
 * Espelha `Dtos.cs`/`ProfessionalAvailabilityExceptionType.cs` (PROMPT 07).
 * `DayOfWeek` é o enum nativo do .NET (`System.DayOfWeek`), serializado
 * como string igual aos demais enums deste projeto (ver nota no topo deste
 * arquivo) — a ordem de exibição PT-BR fica em `availabilityFormat.ts`.
 */
export type DayOfWeek = 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';

export type AvailabilityExceptionType = 'Blocked' | 'Available';

/**
 * `startTime`/`endTime` chegam da Api no formato `TimeOnly` do .NET
 * ("HH:mm:ss", sempre com segundos) — ver `availabilityFormat.ts` para as
 * funções de conversão usadas pelas telas.
 */
export interface ProfessionalAvailabilitySlot {
  id: string;
  professionalId: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  active: boolean;
}

/** `startTime`/`endTime` nulos em conjunto = exceção de dia inteiro (ver `ProfessionalAvailabilityException.cs`). */
export interface ProfessionalAvailabilityExceptionItem {
  id: string;
  professionalId: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  type: AvailabilityExceptionType;
  reason: string | null;
}

/** Resposta de `GET .../availability` — agenda recorrente e exceções juntas (ver `ProfessionalAvailabilityController.GetMyAvailability`). */
export interface ProfessionalAvailabilityOverview {
  weeklySchedule: ProfessionalAvailabilitySlot[];
  exceptions: ProfessionalAvailabilityExceptionItem[];
}

/** `startTime`/`endTime` devem incluir segundos ("08:00:00") — ver `availabilityFormat.ts#toApiTime`. */
export interface SaveProfessionalAvailabilityPayload {
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
}

export interface AddProfessionalAvailabilityExceptionPayload {
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  type: AvailabilityExceptionType;
  reason?: string;
}

// Etapa 19 (agenda e disponibilidade) — ver ARCHITECTURE.md.

/** Espelha `Alilu.Modules.Professional.Application/Dtos.cs#AvailabilityPeriodInput` — um período dentro de `SetBulkAvailabilityPayload`. */
export interface AvailabilityPeriodInput {
  startTime: string;
  endTime: string;
}

/** Corpo de `POST .../availability/bulk` — espelha `Alilu.Api.Controllers.SetBulkAvailabilityBody`; ver `IProfessionalAvailabilityService.SetBulkAvailabilityAsync` no backend para a semântica completa (tudo-ou-nada; ambas as datas nulas = recorrente para sempre). */
export interface SetBulkAvailabilityPayload {
  daysOfWeek: DayOfWeek[];
  periods: AvailabilityPeriodInput[];
  effectiveFrom?: string | null;
  effectiveUntil?: string | null;
}

/** Espelha `Alilu.Api.Controllers.AgendaPeriodStatus` — prioridade Agendado &gt; Bloqueado &gt; Disponível &gt; Indisponível (ver `ProfessionalAgendaController.ResolvePeriodStatus` no backend). */
export type AgendaPeriodStatus = 'Available' | 'Scheduled' | 'Blocked' | 'Unavailable';

/** Espelha `Alilu.Api.Controllers.AgendaPeriodResponse` — um período (Manhã/Tarde/Noite) de um dia em "Minha Agenda", já com o status resolvido. */
export interface AgendaPeriod {
  name: string;
  startTime: string;
  endTime: string;
  status: AgendaPeriodStatus;
}

/** Espelha `Alilu.Api.Controllers.AgendaDayResponse` — resposta de `GET /api/professional/agenda/minha-agenda`. */
export interface AgendaDay {
  date: string;
  periods: AgendaPeriod[];
}
