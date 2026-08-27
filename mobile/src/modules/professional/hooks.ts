import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { condominiumDirectoryApi, professionalAgendaApi, professionalAvailabilityApi, professionalDirectoryApi, professionalProfileApi } from './api';
import type {
  AddProfessionalAvailabilityExceptionPayload,
  AddProfessionalServicePayload,
  RequestProfessionalCondominiumPayload,
  SaveProfessionalAvailabilityPayload,
  SaveProfessionalProfilePayload,
  SetBulkAvailabilityPayload,
} from './types';

/** Chave única do perfil do usuário — usada tanto pelo gate (`(professional)/index.tsx`) quanto para invalidar depois de criar/editar. */
const MY_PROFILE_QUERY_KEY = ['professional', 'profile', 'mine'];
const MY_SERVICES_QUERY_KEY = ['professional', 'services', 'mine'];
const MY_CONDOMINIUMS_QUERY_KEY = ['professional', 'condominiums', 'mine'];
/** Uma única chave para agenda + exceções (PROMPT 07) — mesma resposta única de `GET .../availability`, ver `api.ts`. */
const MY_AVAILABILITY_QUERY_KEY = ['professional', 'availability', 'mine'];
/** Etapa 19 — "Minha Agenda" (`GET .../agenda/minha-agenda`); o prefixo (sem `from`/`to`) é usado para invalidar TODOS os intervalos já consultados de uma vez depois de qualquer mudança de disponibilidade/bloqueio. */
const MY_AGENDA_QUERY_KEY_PREFIX = ['professional', 'agenda', 'mine'];

/**
 * Agenda recorrente, exceções e "Minha Agenda" mudam sempre juntas — toda
 * mutação de disponibilidade (Etapa 07) ou de cadastro em massa/agenda
 * (Etapa 19) invalida as duas de uma vez, para nunca esquecer de atualizar
 * uma das telas depois da outra mudar o mesmo dado por baixo.
 */
function invalidateAvailabilityQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: MY_AVAILABILITY_QUERY_KEY });
  queryClient.invalidateQueries({ queryKey: MY_AGENDA_QUERY_KEY_PREFIX });
}

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

/**
 * Diretório público de categorias de profissional (Etapa 22, React Native:
 * nova tela de categorias, antes de ServiceCategoryScreen — "Categoria" no
 * vocabulário de Rodrigo).
 */
export function useProfessionalCategories() {
  return useQuery({
    queryKey: ['professional', 'directory', 'professional-categories'],
    queryFn: () => professionalDirectoryApi.listProfessionalCategories(),
  });
}

/**
 * Diretório público de especialidades (React Native: ServiceCategoryScreen
 * — "Especialidade" no vocabulário de Rodrigo). `categoryId` (Etapa 22,
 * opcional) filtra pela categoria-pai escolhida na tela anterior; sem ele,
 * devolve todas (usado, por exemplo, pela lista plana de "Meus serviços"
 * em ProfessionalEditScreen, que agrupa por categoria no próprio React
 * Native em vez de pedir uma consulta por categoria).
 */
export function useServiceCategories(categoryId?: string) {
  return useQuery({
    queryKey: ['professional', 'directory', 'categories', categoryId ?? null],
    queryFn: () => professionalDirectoryApi.listCategories(categoryId),
  });
}

/**
 * Diretório público de profissionais (React Native: ProfessionalListScreen
 * — "listar profissionais; filtrar categoria"). Etapa 23 —
 * `professionalCategoryId` (categoria-pai) é usado só quando `categoryId`
 * (especialidade) não vem preenchido; ver comentário em `api.ts`.
 */
export function useProfessionals(categoryId?: string, professionalCategoryId?: string, name?: string) {
  return useQuery({
    queryKey: ['professional', 'directory', 'professionals', categoryId ?? null, professionalCategoryId ?? null, name ?? null],
    queryFn: () => professionalDirectoryApi.listProfessionals(categoryId, professionalCategoryId, name),
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
    onSuccess: () => invalidateAvailabilityQueries(queryClient),
  });
}

/** React Native: AvailabilityEditor — edição de um intervalo já existente. */
export function useUpdateAvailability() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: SaveProfessionalAvailabilityPayload }) =>
      professionalAvailabilityApi.update(id, payload),
    onSuccess: () => invalidateAvailabilityQueries(queryClient),
  });
}

export function useRemoveAvailability() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => professionalAvailabilityApi.remove(id),
    onSuccess: () => invalidateAvailabilityQueries(queryClient),
  });
}

/** React Native: BlockedDatesScreen — "bloquear datas; liberar horários específicos". */
export function useAddAvailabilityException() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: AddProfessionalAvailabilityExceptionPayload) => professionalAvailabilityApi.addException(payload),
    onSuccess: () => invalidateAvailabilityQueries(queryClient),
  });
}

export function useRemoveAvailabilityException() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => professionalAvailabilityApi.removeException(id),
    onSuccess: () => invalidateAvailabilityQueries(queryClient),
  });
}

/**
 * Etapa 19 — cadastro em massa (React Native: telas "Adicionar
 * disponibilidade"/"Configurar rotina semanal").
 */
export function useSetBulkAvailability() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: SetBulkAvailabilityPayload) => professionalAvailabilityApi.setBulk(payload),
    onSuccess: () => invalidateAvailabilityQueries(queryClient),
  });
}

/**
 * Etapa 19 — "Minha Agenda": visão unificada por data/período. `from`/`to`
 * no formato `DateOnly` ("yyyy-MM-dd"); a query só roda com os dois
 * presentes (mesmo padrão de `useProfessionalProfile` com `enabled`).
 */
export function useMyAgenda(from: string, to: string) {
  return useQuery({
    queryKey: [...MY_AGENDA_QUERY_KEY_PREFIX, from, to],
    queryFn: () => professionalAgendaApi.getMine(from, to),
    enabled: Boolean(from && to),
  });
}
