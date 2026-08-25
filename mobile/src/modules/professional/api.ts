import { api } from '../../services/api';
import type {
  AddProfessionalAvailabilityExceptionPayload,
  AddProfessionalServicePayload,
  CondominiumSummary,
  Professional,
  ProfessionalAvailabilityExceptionItem,
  ProfessionalAvailabilityOverview,
  ProfessionalAvailabilitySlot,
  ProfessionalCondominiumLink,
  ProfessionalDirectoryItem,
  ProfessionalServiceItem,
  RequestProfessionalCondominiumPayload,
  SaveProfessionalAvailabilityPayload,
  SaveProfessionalProfilePayload,
  ServiceCategory,
} from './types';

const PROFILE_BASE_PATH = '/api/professional/profile';
const DIRECTORY_BASE_PATH = '/api/directory/professionals';
const CONDOMINIUM_DIRECTORY_BASE_PATH = '/api/directory';
const AVAILABILITY_BASE_PATH = '/api/professional/availability';

/**
 * Chamadas HTTP cruas do módulo Professional (PROMPT 06). Espelha
 * `modules/resident/api.ts`: este arquivo não conhece React nem o estado
 * do app — quem orquestra isso é `hooks.ts` (TanStack Query).
 */
export const professionalProfileApi = {
  /** 204 (sem corpo) quando o usuário ainda não criou um perfil — ver `ProfessionalProfileController.GetMine`. */
  getMine() {
    return api
      .get<Professional | null>(PROFILE_BASE_PATH)
      .then((response) => (response.status === 204 ? null : response.data));
  },

  create(payload: SaveProfessionalProfilePayload) {
    return api.post<Professional>(PROFILE_BASE_PATH, payload).then((response) => response.data);
  },

  update(payload: SaveProfessionalProfilePayload) {
    return api.put<Professional>(PROFILE_BASE_PATH, payload).then((response) => response.data);
  },

  listMyServices() {
    return api.get<ProfessionalServiceItem[]>(`${PROFILE_BASE_PATH}/services`).then((response) => response.data);
  },

  addMyService(payload: AddProfessionalServicePayload) {
    return api.post<ProfessionalServiceItem>(`${PROFILE_BASE_PATH}/services`, payload).then((response) => response.data);
  },

  removeMyService(serviceId: string) {
    return api.delete(`${PROFILE_BASE_PATH}/services/${serviceId}`);
  },

  listMyCondominiums() {
    return api.get<ProfessionalCondominiumLink[]>(`${PROFILE_BASE_PATH}/condominiums`).then((response) => response.data);
  },

  requestCondominium(payload: RequestProfessionalCondominiumPayload) {
    return api.post<ProfessionalCondominiumLink>(`${PROFILE_BASE_PATH}/condominiums`, payload).then((response) => response.data);
  },
};

/** Diretório público de profissionais/categorias (React Native, morador: ProfessionalListScreen/ServiceCategoryScreen/ProfessionalProfileScreen). */
export const professionalDirectoryApi = {
  listCategories() {
    return api.get<ServiceCategory[]>(`${DIRECTORY_BASE_PATH}/categories`).then((response) => response.data);
  },

  listProfessionals(categoryId?: string) {
    return api
      .get<ProfessionalDirectoryItem[]>(DIRECTORY_BASE_PATH, { params: categoryId ? { categoryId } : undefined })
      .then((response) => response.data);
  },

  getProfile(id: string) {
    return api.get<ProfessionalDirectoryItem>(`${DIRECTORY_BASE_PATH}/${id}`).then((response) => response.data);
  },
};

/** Mesmo diretório público de condomínios usado pelo módulo Resident (FLUXO 2) — aqui para o profissional escolher onde "solicitar atendimento". */
export const condominiumDirectoryApi = {
  listCondominiums() {
    return api.get<CondominiumSummary[]>(`${CONDOMINIUM_DIRECTORY_BASE_PATH}/condominiums`).then((response) => response.data);
  },
};

/**
 * Disponibilidade do profissional (PROMPT 07). `getMine` devolve agenda
 * recorrente + exceções numa única resposta — ver
 * `ProfessionalAvailabilityController.GetMyAvailability` no backend e a
 * nota em `types.ts`/`ProfessionalAvailabilityOverview`.
 */
export const professionalAvailabilityApi = {
  getMine() {
    return api.get<ProfessionalAvailabilityOverview>(AVAILABILITY_BASE_PATH).then((response) => response.data);
  },

  /** React Native: AvailabilityEditor — "configurar dias; configurar horários" (criação). */
  add(payload: SaveProfessionalAvailabilityPayload) {
    return api.post<ProfessionalAvailabilitySlot>(AVAILABILITY_BASE_PATH, payload).then((response) => response.data);
  },

  /** React Native: AvailabilityEditor — edição de um intervalo já existente. */
  update(id: string, payload: SaveProfessionalAvailabilityPayload) {
    return api.put<ProfessionalAvailabilitySlot>(`${AVAILABILITY_BASE_PATH}/${id}`, payload).then((response) => response.data);
  },

  remove(id: string) {
    return api.delete(`${AVAILABILITY_BASE_PATH}/${id}`);
  },

  /** React Native: BlockedDatesScreen — "bloquear datas; liberar horários específicos". */
  addException(payload: AddProfessionalAvailabilityExceptionPayload) {
    return api
      .post<ProfessionalAvailabilityExceptionItem>(`${AVAILABILITY_BASE_PATH}/exceptions`, payload)
      .then((response) => response.data);
  },

  removeException(id: string) {
    return api.delete(`${AVAILABILITY_BASE_PATH}/exceptions/${id}`);
  },
};
