import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { professionalReviewApi, reviewApi } from './api';
import type { CreateReviewPayload, EditReviewPayload } from './types';

const MY_REVIEWS_QUERY_KEY = ['reviews', 'mine'];
const RECEIVED_REVIEWS_QUERY_KEY = ['reviews', 'received'];
const RATING_SUMMARY_QUERY_KEY = ['reviews', 'summary'];

/** React Native: ReviewScreen — "visualizar avaliações feitas". */
export function useMyReviews() {
  return useQuery({
    queryKey: MY_REVIEWS_QUERY_KEY,
    queryFn: () => reviewApi.listMine(),
  });
}

/**
 * React Native: a rota hospedeira (`bookings/[id]/review.tsx`) usa isso
 * para decidir se ReviewScreen abre em modo "avaliar" ou "ver/editar
 * avaliação" — `null` quando o agendamento ainda não foi avaliado.
 */
export function useMyReviewForBooking(bookingId: string | undefined) {
  return useQuery({
    queryKey: [...MY_REVIEWS_QUERY_KEY, 'booking', bookingId],
    queryFn: () => reviewApi.getMineForBooking(bookingId as string),
    enabled: Boolean(bookingId),
  });
}

/**
 * Etapa 23 — mesmo padrão de `useMyReviewForBooking`, pra avaliação LIVRE
 * (sem agendamento, morador buscou o profissional pelo nome).
 */
export function useMyReviewForProfessional(professionalId: string | undefined) {
  return useQuery({
    queryKey: [...MY_REVIEWS_QUERY_KEY, 'professional', professionalId],
    queryFn: () => reviewApi.getMineForProfessional(professionalId as string),
    enabled: Boolean(professionalId),
  });
}

/** React Native: ReviewScreen — "avaliar profissional". */
export function useCreateReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateReviewPayload) => reviewApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MY_REVIEWS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: RECEIVED_REVIEWS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: RATING_SUMMARY_QUERY_KEY });
    },
  });
}

/** React Native: ReviewScreen — "editar avaliação dentro da regra definida". */
export function useEditReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: EditReviewPayload }) => reviewApi.edit(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MY_REVIEWS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: RECEIVED_REVIEWS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: RATING_SUMMARY_QUERY_KEY });
    },
  });
}

/** React Native: ProfessionalReviewsScreen — "visualizar avaliações recebidas". */
export function useReceivedReviews() {
  return useQuery({
    queryKey: RECEIVED_REVIEWS_QUERY_KEY,
    queryFn: () => professionalReviewApi.listReceived(),
  });
}

/** React Native: ProfessionalReviewsScreen/RatingSummary — "visualizar média". */
export function useMyRatingSummary() {
  return useQuery({
    queryKey: RATING_SUMMARY_QUERY_KEY,
    queryFn: () => professionalReviewApi.getSummary(),
  });
}
