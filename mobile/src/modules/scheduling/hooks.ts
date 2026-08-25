import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { availabilityCheckApi, bookingApi, professionalBookingApi, schedulingDirectoryApi } from './api';
import type { BookingStatus, CreateBookingPayload } from './types';

const MY_BOOKINGS_QUERY_KEY = ['scheduling', 'bookings', 'mine'];
const MY_PROFESSIONAL_REQUESTS_QUERY_KEY = ['scheduling', 'professional-requests', 'mine'];

/** React Native: MyBookingsScreen — "meus agendamentos". */
export function useMyBookings() {
  return useQuery({
    queryKey: MY_BOOKINGS_QUERY_KEY,
    queryFn: () => bookingApi.listMine(),
  });
}

/** React Native: BookingDetailsScreen (visão do morador). */
export function useMyBooking(id: string | undefined) {
  return useQuery({
    queryKey: [...MY_BOOKINGS_QUERY_KEY, id],
    queryFn: () => bookingApi.getMine(id as string),
    enabled: Boolean(id),
  });
}

/** React Native: BookingConfirmationScreen — passo final do fluxo do morador. */
export function useCreateBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateBookingPayload) => bookingApi.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MY_BOOKINGS_QUERY_KEY }),
  });
}

/** React Native: MyBookingsScreen/BookingDetailsScreen — "cancelar". */
export function useCancelMyBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => bookingApi.cancelMine(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MY_BOOKINGS_QUERY_KEY }),
  });
}

/**
 * Consulta sob demanda (React Native: TimeSelectionScreen — "verificar
 * disponibilidade"). `enabled: false` — só roda quando o morador pede
 * explicitamente (botão "Verificar disponibilidade"), nunca
 * automaticamente a cada tecla digitada; ver `TimeSelectionScreen`, que
 * chama `refetch()`.
 */
export function useAvailabilityCheck(professionalId: string | undefined, date: string, startTime: string, endTime: string) {
  return useQuery({
    queryKey: ['scheduling', 'availability-check', professionalId, date, startTime, endTime],
    queryFn: () => availabilityCheckApi.check(professionalId as string, date, startTime, endTime),
    enabled: false,
    retry: false,
  });
}

/** React Native: ProfessionalRequestsScreen — "solicitações recebidas"; `status` opcional filtra (ex.: só as ainda pendentes). */
export function useMyProfessionalRequests(status?: BookingStatus) {
  return useQuery({
    queryKey: [...MY_PROFESSIONAL_REQUESTS_QUERY_KEY, status ?? null],
    queryFn: () => professionalBookingApi.listMine(status),
  });
}

/** React Native: BookingDetailsScreen (visão do profissional). */
export function useMyProfessionalRequest(id: string | undefined) {
  return useQuery({
    queryKey: [...MY_PROFESSIONAL_REQUESTS_QUERY_KEY, id],
    queryFn: () => professionalBookingApi.getMine(id as string),
    enabled: Boolean(id),
  });
}

/** React Native: ProfessionalRequestsScreen — "aceitar". */
export function useAcceptBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => professionalBookingApi.accept(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MY_PROFESSIONAL_REQUESTS_QUERY_KEY }),
  });
}

/** React Native: ProfessionalRequestsScreen — "recusar". */
export function useRejectBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => professionalBookingApi.reject(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MY_PROFESSIONAL_REQUESTS_QUERY_KEY }),
  });
}

/** React Native: ProfessionalRequestsScreen/BookingDetailsScreen — "cancelar" (lado do profissional). */
export function useCancelProfessionalBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => professionalBookingApi.cancel(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MY_PROFESSIONAL_REQUESTS_QUERY_KEY }),
  });
}

/** O profissional marca o início do atendimento. */
export function useStartBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => professionalBookingApi.start(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MY_PROFESSIONAL_REQUESTS_QUERY_KEY }),
  });
}

/** React Native: ProfessionalRequestsScreen — "concluir". */
export function useCompleteBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => professionalBookingApi.complete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MY_PROFESSIONAL_REQUESTS_QUERY_KEY }),
  });
}

/** O morador não compareceu ao horário confirmado. */
export function useMarkBookingNoShow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => professionalBookingApi.markNoShow(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MY_PROFESSIONAL_REQUESTS_QUERY_KEY }),
  });
}

/** Diretório completo de profissionais — usado para achar o nome a partir de `professionalId` (React Native: MyBookingsScreen/BookingDetailsScreen). */
export function useBookingProfessionalsDirectory() {
  return useQuery({
    queryKey: ['scheduling', 'directory', 'professionals'],
    queryFn: () => schedulingDirectoryApi.listProfessionals(),
  });
}

/** Diretório de categorias de serviço — usado para achar o nome a partir de `serviceCategoryId` (React Native: BookingServicesScreen/BookingDetailsScreen). */
export function useBookingServiceCategoriesDirectory() {
  return useQuery({
    queryKey: ['scheduling', 'directory', 'categories'],
    queryFn: () => schedulingDirectoryApi.listCategories(),
  });
}

/** Diretório completo de condomínios — usado para achar o nome a partir de `condominiumId` (React Native: ProfessionalRequestsScreen/BookingDetailsScreen). */
export function useBookingCondominiumsDirectory() {
  return useQuery({
    queryKey: ['scheduling', 'directory', 'condominiums'],
    queryFn: () => schedulingDirectoryApi.listCondominiums(),
  });
}

/** Unidades de um condomínio já conhecido — usado para achar o código a partir de `unitId` (React Native: BookingDetailsScreen). */
export function useBookingUnitsDirectory(condominiumId: string | undefined) {
  return useQuery({
    queryKey: ['scheduling', 'directory', 'units', condominiumId],
    queryFn: () => schedulingDirectoryApi.listUnits(condominiumId as string),
    enabled: Boolean(condominiumId),
  });
}
