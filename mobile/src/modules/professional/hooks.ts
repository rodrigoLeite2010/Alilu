import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { condominiumDirectoryApi, professionalDirectoryApi, professionalProfileApi } from './api';
import type {
  AddProfessionalServicePayload,
  RequestProfessionalCondominiumPayload,
  SaveProfessionalProfilePayload,
} from './types';

/** Chave única do perfil do usuário — usada tanto pelo gate (`(professional)/index.tsx`) quanto para invalidar depois de criar/editar. */
const MY_PROFILE_QUERY_KEY = ['professional', 'profile', 'mine'];
const MY_SERVICES_QUERY_KEY = ['professional', 'services', 'mine'];
const MY_CONDOMINIUMS_QUERY_KEY = ['professional', 'condominiums', 'mine'];

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
