import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { condominiumDirectoryApi, professionalAvailabilityApi, professionalDirectoryApi, professionalProfileApi } from './api';
import type {
  AddProfessionalAvailabilityExceptionPayload,
  AddProfessionalServicePayload,
  RequestProfessionalCondominiumPayload,
  SaveProfessionalAvailabilityPayload,
  SaveProfessionalProfilePayload,
} from './types';

/** Chave única do perfil do usuário — usada tanto pelo gate (`(professional)/index.tsx`) quanto para invalidar depois de criar/editar. */
const MY_PROFILE_QUERY_KEY = ['professional', 'profile', 'mine'];
const MY_SERVICES_QUERY_KEY = ['professional', 'services', 'mine'];
const MY_CONDOMINIUMS_QUERY_KEY = ['professional', 'condominiums', 'mine'];
/** Uma única chave para agenda + exceções (PROMPT 07) — mesma resposta única de `GET .../availability`, ver `api.ts`. */
const MY_AVAILABILITY_QUERY_KEY = ['professional', 'availability', 'mine'];

/**
 * Meu perfil profissional, se houver. O gate do app (ver
 * `(professional)/index.tsx`) decide entre o formulário de criação e a
 * edição a partir disto — mesmo espírito de `useMyMemberships` no módulo
 * Resident (PROMPT 05).
 */
export function useMyProfessionalProfile() {
  return useQuery({
    queryKey: MY_PROFILE_QUERY_KEY,
    queryFn: () => professionalProfileApi.getMine(),
  });
}

export function useCreateProfessionalProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: SaveProfessionalProfilePayload) => professionalProfileApi.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MY_PROFILE_QUERY_KEY }),
  });
}

export function useUpdateProfessionalProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: SaveProfessionalProfilePayload) => professionalProfileApi.update(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MY_PROFILE_QUERY_KEY }),
  });
}

export function useMyProfessionalServices() {
  return useQuery({
    queryKey: MY_SERVICES_QUERY_KEY,
    queryFn: () => professionalProfileApi.listMyServices(),
  });
}

export function useAddProfessionalService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: AddProfessionalServicePayload) => professionalProfileApi.addMyService(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MY_SERVICES_QUERY_KEY }),
  });
}

export function useRemoveProfessionalService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (serviceId: string) => professionalProfileApi.removeMyService(serviceId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MY_SERVICES_QUERY_KEY }),
  });
}

export function useMyProfessionalCondominiums() {
  return useQuery({
    queryKey: MY_CONDOMINIUMS_QUERY_KEY,
    queryFn: () => professionalProfileApi.listMyCondominiums(),
  });
}

/** "Solicitar atendimento em condomínios" (PROMPT 06). */
export function useRequestProfessionalCondominium() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: RequestProfessionalCondominiumPayload) => professionalProfileApi.requestCondominium(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MY_CONDOMINIUMS_QUERY_KEY }),
  });
}

/** Diretório público de categorias (React Native: ServiceCategoryScreen). */
export function useServiceCategories() {
  return useQuery({
    queryKey: ['professional', 'directory', 'categories'],
    queryFn: () => professionalDirectoryApi.listCategories(),
  });
}

/** Diretório público de profissionais (React Native: ProfessionalListScreen — "listar profissionais; filtrar categoria"). */
export function useProfessionals(categoryId?: string) {
  return useQuery({
    queryKey: ['professional', 'directory', 'professionals', categoryId ?? null],
    queryFn: () => professionalDirectoryApi.listProfessionals(categoryId),
  });
}

/** React Native: ProfessionalProfileScreen — "visualizar perfil". */
export function useProfessionalProfile(id: string | undefined) {
  return useQuery({
    queryKey: ['professional', 'directory', 'profile', id],
    queryFn: () => professionalDirectoryApi.getProfile(id as string),
    enabled: Boolean(id),
  });
}

/** Condomínios ativos — para o profissional escolher onde "solicitar atendimento". */
export function useCondominiumsForRequest() {
  return useQuery({
    queryKey: ['professional', 'condominium-directory', 'condominiums'],
    queryFn: () => condominiumDirectoryApi.listCondominiums(),
  });
}

/**
 * Minha disponibilidade (PROMPT 07) — agenda recorrente + exceções, numa
 * única consulta. Base das quatro telas React Native pedidas
 * (AvailabilityScreen/AvailabilityEditor/BlockedDatesScreen/
 * CalendarAvailabilityScreen).
 */
export function useMyAvailability() {
  return useQuery({
    queryKey: MY_AVAILABILITY_QUERY_KEY,
    queryFn: () => professionalAvailabilityApi.getMine(),
  });
}

/** React Native: AvailabilityEditor — "configurar dias; configurar horários" (criação). */
export function useAddAvailability() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: SaveProfessionalAvailabilityPayload) => professionalAvailabilityApi.add(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MY_AVAILABILITY_QUERY_KEY }),
  });
}

/** React Native: AvailabilityEditor — edição de um intervalo já existente. */
export function useUpdateAvailability() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: SaveProfessionalAvailabilityPayload }) =>
      professionalAvailabilityApi.update(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MY_AVAILABILITY_QUERY_KEY }),
  });
}

export function useRemoveAvailability() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => professionalAvailabilityApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MY_AVAILABILITY_QUERY_KEY }),
  });
}

/** React Native: BlockedDatesScreen — "bloquear datas; liberar horários específicos". */
export function useAddAvailabilityException() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: AddProfessionalAvailabilityExceptionPayload) => professionalAvailabilityApi.addException(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MY_AVAILABILITY_QUERY_KEY }),
  });
}

export function useRemoveAvailabilityException() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => professionalAvailabilityApi.removeException(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MY_AVAILABILITY_QUERY_KEY }),
  });
}
