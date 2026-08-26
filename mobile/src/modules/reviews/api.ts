import { api } from '../../services/api';
import type { CreateReviewPayload, EditReviewPayload, ProfessionalRatingSummary, Review } from './types';

const RESIDENT_REVIEWS_BASE_PATH = '/api/resident/reviews';
const PROFESSIONAL_REVIEWS_BASE_PATH = '/api/professional/reviews';

/**
 * Chamadas HTTP cruas do lado do morador (PROMPT 09). Espelha
 * `modules/scheduling/api.ts#bookingApi`: este arquivo não conhece React
 * nem o estado do app — quem orquestra isso é `hooks.ts` (TanStack Query).
 */
export const reviewApi = {
  /** React Native: ReviewScreen — "visualizar avaliações feitas". */
  listMine() {
    return api.get<Review[]>(RESIDENT_REVIEWS_BASE_PATH).then((response) => response.data);
  },

  /**
   * Devolve a avaliação do morador para este agendamento, ou `null` quando
   * ainda não existe (a Api responde 204 sem corpo — mesmo padrão "204 sem
   * corpo" de outros módulos, ver `modules/resident/api.ts`). React Native:
   * a rota hospedeira (`bookings/[id]/review.tsx`) usa isso para decidir se
   * ReviewScreen abre em modo "avaliar" ou "ver/editar avaliação".
   */
  getMineForBooking(bookingId: string) {
    return api.get<Review>(`${RESIDENT_REVIEWS_BASE_PATH}/booking/${bookingId}`).then((response) => (response.status === 204 ? null : response.data));
  },

  /** React Native: ReviewScreen — "avaliar profissional". */
  create(payload: CreateReviewPayload) {
    return api.post<Review>(RESIDENT_REVIEWS_BASE_PATH, payload).then((response) => response.data);
  },

  /** React Native: ReviewScreen — "editar avaliação dentro da regra definida". */
  edit(id: string, payload: EditReviewPayload) {
    return api.put<Review>(`${RESIDENT_REVIEWS_BASE_PATH}/${id}`, payload).then((response) => response.data);
  },
};

/** Chamadas HTTP cruas do lado do profissional (PROMPT 09: "visualizar avaliações recebidas; visualizar média"). */
export const professionalReviewApi = {
  listReceived() {
    return api.get<Review[]>(PROFESSIONAL_REVIEWS_BASE_PATH).then((response) => response.data);
  },

  getSummary() {
    return api.get<ProfessionalRatingSummary>(`${PROFESSIONAL_REVIEWS_BASE_PATH}/summary`).then((response) => response.data);
  },
};
