/**
 * Espelha `Alilu.Modules.Scheduling.Application/Dtos.cs` e
 * `Domain/BookingStatus.cs` (PROMPT 08 — "o módulo mais crítico"). A Api
 * serializa enums como string e usa camelCase — ver `modules/auth/types.ts`
 * para a mesma observação já registrada no PROMPT 03. `scheduledDate`/
 * `startTime`/`endTime` seguem o mesmo formato `DateOnly`/`TimeOnly` da
 * Etapa 07 (`TimeOnly` exige segundos, "HH:mm:ss") — ver
 * `schedulingFormat.ts`.
 */
export type BookingStatus =
  | 'Requested'
  | 'Confirmed'
  | 'Rejected'
  | 'CancelledByResident'
  | 'CancelledByProfessional'
  | 'InProgress'
  | 'Completed'
  | 'NoShow';

export interface BookingItem {
  id: string;
  bookingId: string;
  serviceCategoryId: string;
  description: string | null;
  quantity: number;
}

/**
 * Nunca inclui dados de outro módulo (nome do morador/profissional, nome
 * do condomínio, código da unidade, nome das categorias de serviço) — só
 * os Ids, exatamente como a Api devolve (ver `BookingResponse` no
 * backend). Enriquecer para exibição é responsabilidade das telas, que
 * consultam os diretórios públicos de outros módulos por conta própria
 * (ver `schedulingDirectoryApi` em `api.ts`) — mesmo espírito de
 * `ResidentHomeScreen` (PROMPT 05/06) e da regra "módulos não se
 * referenciam" da Api (PROMPT 01), aqui espelhada no app: nenhuma tela
 * deste módulo importa `modules/resident`/`modules/professional`
 * diretamente — quem faz essa composição é a camada de rotas (`app/`),
 * que passa os dados já resolvidos como props (mesmo papel dos
 * controllers da Api no backend, ver `BookingsController`).
 */
export interface Booking {
  id: string;
  residentId: string;
  professionalId: string;
  condominiumId: string;
  unitId: string;
  scheduledDate: string;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  items: BookingItem[];
}

/** Um serviço escolhido no passo "selecionar serviços" (React Native: BookingServicesScreen). `startTime`/`endTime` do payload de criação devem incluir segundos — ver `schedulingFormat.ts#toApiTime`. */
export interface BookingItemInput {
  serviceCategoryId: string;
  description?: string;
  quantity: number;
}

/** Corpo de `POST /api/resident/bookings` — ver BookingConfirmationScreen, passo final do fluxo do morador. */
export interface CreateBookingPayload {
  professionalId: string;
  condominiumId: string;
  unitId: string;
  scheduledDate: string;
  startTime: string;
  endTime: string;
  notes?: string;
  items: BookingItemInput[];
}

/** Resposta de `GET .../availability-check` (React Native: TimeSelectionScreen — "verificar disponibilidade"). Nunca lista horários livres, só responde sim/não sobre a janela pedida — ver `ProfessionalDirectoryController.CheckAvailability` no backend. */
export interface AvailabilityCheckResult {
  available: boolean;
}

/**
 * Versão mínima de `ProfessionalDirectoryItem` (módulo Professional), só
 * com o que as telas de agendamento precisam exibir/usar — mesma
 * convenção de duplicar DTOs enxutos entre módulos já usada em
 * `CondominiumSummary` (Resident/Professional, ver nota da interface
 * `Booking` acima).
 */
export interface BookingProfessionalSummary {
  id: string;
  displayName: string;
  phone: string | null;
  categories: BookingServiceCategorySummary[];
}

/** Só o necessário do vínculo do morador (módulo Resident) para montar o agendamento — mesma nota de duplicação acima. */
export interface BookingMembershipSummary {
  condominiumId: string;
  unitId: string;
}

/** Espelha `Alilu.Modules.Professional.Application/Dtos.cs#ServiceCategoryResponse` — duplicado aqui pelo mesmo motivo. */
export interface BookingServiceCategorySummary {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
}

/** Espelha `Alilu.Modules.Condominium.Application/Dtos.cs` (diretório público) — duplicado aqui pelo mesmo motivo. */
export interface BookingCondominiumSummary {
  id: string;
  name: string;
  city: string;
  state: string;
}

export interface BookingUnitSummary {
  id: string;
  code: string;
}
