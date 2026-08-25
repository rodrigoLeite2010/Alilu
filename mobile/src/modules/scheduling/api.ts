import { api } from '../../services/api';
import type {
  AvailabilityCheckResult,
  Booking,
  BookingCondominiumSummary,
  BookingProfessionalSummary,
  BookingServiceCategorySummary,
  BookingStatus,
  BookingUnitSummary,
  CreateBookingPayload,
} from './types';

const RESIDENT_BOOKINGS_BASE_PATH = '/api/resident/bookings';
const PROFESSIONAL_BOOKINGS_BASE_PATH = '/api/professional/bookings';
const PROFESSIONAL_DIRECTORY_BASE_PATH = '/api/directory/professionals';
const CONDOMINIUM_DIRECTORY_BASE_PATH = '/api/directory';

/**
 * Chamadas HTTP cruas do lado do morador (PROMPT 08). Espelha
 * `modules/resident/api.ts`: este arquivo não conhece React nem o estado
 * do app — quem orquestra isso é `hooks.ts` (TanStack Query).
 */
export const bookingApi = {
  /** React Native: MyBookingsScreen — "meus agendamentos". */
  listMine() {
    return api.get<Booking[]>(RESIDENT_BOOKINGS_BASE_PATH).then((response) => response.data);
  },

  /** React Native: BookingDetailsScreen (visão do morador). */
  getMine(id: string) {
    return api.get<Booking>(`${RESIDENT_BOOKINGS_BASE_PATH}/${id}`).then((response) => response.data);
  },

  /** React Native: BookingConfirmationScreen — passo final do fluxo do morador. */
  create(payload: CreateBookingPayload) {
    return api.post<Booking>(RESIDENT_BOOKINGS_BASE_PATH, payload).then((response) => response.data);
  },

  /** React Native: MyBookingsScreen/BookingDetailsScreen — "cancelar". */
  cancelMine(id: string) {
    return api.post<Booking>(`${RESIDENT_BOOKINGS_BASE_PATH}/${id}/cancel`).then((response) => response.data);
  },
};

/** Chamadas HTTP cruas do lado do profissional (PROMPT 08) — fluxo "receber solicitação → aceitar ou recusar". */
export const professionalBookingApi = {
  /** React Native: ProfessionalRequestsScreen — "solicitações recebidas"; `status` opcional filtra. */
  listMine(status?: BookingStatus) {
    return api
      .get<Booking[]>(PROFESSIONAL_BOOKINGS_BASE_PATH, { params: status ? { status } : undefined })
      .then((response) => response.data);
  },

  /** React Native: BookingDetailsScreen (visão do profissional). */
  getMine(id: string) {
    return api.get<Booking>(`${PROFESSIONAL_BOOKINGS_BASE_PATH}/${id}`).then((response) => response.data);
  },

  accept(id: string) {
    return api.post<Booking>(`${PROFESSIONAL_BOOKINGS_BASE_PATH}/${id}/accept`).then((response) => response.data);
  },

  reject(id: string) {
    return api.post<Booking>(`${PROFESSIONAL_BOOKINGS_BASE_PATH}/${id}/reject`).then((response) => response.data);
  },

  cancel(id: string) {
    return api.post<Booking>(`${PROFESSIONAL_BOOKINGS_BASE_PATH}/${id}/cancel`).then((response) => response.data);
  },

  start(id: string) {
    return api.post<Booking>(`${PROFESSIONAL_BOOKINGS_BASE_PATH}/${id}/start`).then((response) => response.data);
  },

  complete(id: string) {
    return api.post<Booking>(`${PROFESSIONAL_BOOKINGS_BASE_PATH}/${id}/complete`).then((response) => response.data);
  },

  markNoShow(id: string) {
    return api.post<Booking>(`${PROFESSIONAL_BOOKINGS_BASE_PATH}/${id}/no-show`).then((response) => response.data);
  },
};

/**
 * Consulta pública, só-leitura (React Native: TimeSelectionScreen —
 * "verificar disponibilidade"). Ver `ProfessionalDirectoryController.CheckAvailability`
 * no backend: nunca lança erro por indisponibilidade, sempre 200 com
 * `{ available }` — "nunca confiar no calendário do React Native" (REGRA
 * CRÍTICA) continua valendo, esta consulta só melhora a experiência antes
 * do envio; a verificação que de fato vale é a repetida no servidor
 * dentro de `POST /api/resident/bookings`.
 */
export const availabilityCheckApi = {
  check(professionalId: string, date: string, startTime: string, endTime: string) {
    return api
      .get<AvailabilityCheckResult>(`${PROFESSIONAL_DIRECTORY_BASE_PATH}/${professionalId}/availability-check`, {
        params: { date, startTime, endTime },
      })
      .then((response) => response.data);
  },
};

/**
 * Diretórios públicos de outros módulos, só para enriquecer a exibição
 * (nome do profissional/condomínio/unidade/categoria de serviço) — o
 * módulo Scheduling nunca devolve esses nomes sozinho (ver `Booking` em
 * `types.ts`), então é a tela quem busca e casa os Ids localmente, mesmo
 * espírito de `ResidentHomeScreen` (PROMPT 05/06). Duplica chamadas já
 * existentes em `modules/professional/api.ts`/`modules/resident/api.ts`
 * de propósito — mesma convenção de módulos não se importarem entre si
 * (ver nota em `types.ts`).
 */
export const schedulingDirectoryApi = {
  listProfessionals() {
    return api.get<BookingProfessionalSummary[]>(PROFESSIONAL_DIRECTORY_BASE_PATH).then((response) => response.data);
  },

  listCategories() {
    return api.get<BookingServiceCategorySummary[]>(`${PROFESSIONAL_DIRECTORY_BASE_PATH}/categories`).then((response) => response.data);
  },

  listCondominiums() {
    return api.get<BookingCondominiumSummary[]>(`${CONDOMINIUM_DIRECTORY_BASE_PATH}/condominiums`).then((response) => response.data);
  },

  listUnits(condominiumId: string) {
    return api
      .get<BookingUnitSummary[]>(`${CONDOMINIUM_DIRECTORY_BASE_PATH}/condominiums/${condominiumId}/units`)
      .then((response) => response.data);
  },
};
