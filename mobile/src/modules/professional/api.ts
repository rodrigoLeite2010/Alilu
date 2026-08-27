import { api } from '../../services/api';
import type {
  AddProfessionalAvailabilityExceptionPayload,
  AddProfessionalServicePayload,
  AgendaDay,
  CondominiumSummary,
  Professional,
  ProfessionalAvailabilityExceptionItem,
  ProfessionalAvailabilityOverview,
  ProfessionalAvailabilitySlot,
  ProfessionalCategory,
  ProfessionalCondominiumLink,
  ProfessionalDirectoryItem,
  ProfessionalServiceItem,
  RequestProfessionalCondominiumPayload,
  SaveProfessionalAvailabilityPayload,
  SaveProfessionalProfilePayload,
  ServiceCategory,
  SetBulkAvailabilityPayload,
} from './types';

const PROFILE_BASE_PATH = '/api/professional/profile';
const DIRECTORY_BASE_PATH = '/api/directory/professionals';
/** Etapa 22 — recurso próprio, fora de `.../professionals` (ver comentário de `ProfessionalDirectoryController.ListProfessionalCategories` no backend). */
const PROFESSIONAL_CATEGORIES_PATH = '/api/directory/professional-categories';
const CONDOMINIUM_DIRECTORY_BASE_PATH = '/api/directory';
const AVAILABILITY_BASE_PATH = '/api/professional/availability';
const AGENDA_BASE_PATH = '/api/professional/agenda';

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
  /** Etapa 22 — o nível de CIMA da navegação ("Categoria"), React Native: nova tela de categorias. */
  listProfessionalCategories() {
    return api.get<ProfessionalCategory[]>(PROFESSIONAL_CATEGORIES_PATH).then((response) => response.data);
  },

  /** "Especialidade". `categoryId` (Etapa 22, opcional) filtra pela categoria escolhida na tela anterior. */
  listCategories(categoryId?: string) {
    return api
      .get<ServiceCategory[]>(`${DIRECTORY_BASE_PATH}/categories`, { params: categoryId ? { categoryId } : undefined })
      .then((response) => response.data);
  },

  /**
   * Etapa 23 — `professionalCategoryId` (categoria-pai) só é considerado
   * pela Api quando `categoryId` (especialidade) não é informado — ver
   * `ProfessionalDirectoryController.ListProfessionals` no backend. Corrige
   * o bug de "Ver todos os profissionais" dentro de uma categoria mostrar
   * profissionais de outras categorias. `name` (Etapa 23, "buscar
   * profissional pelo nome") é combinável com qualquer um dos dois.
   */
  listProfessionals(categoryId?: string, professionalCategoryId?: string, name?: string) {
    const params = {
      ...(categoryId ? { categoryId } : professionalCategoryId ? { professionalCategoryId } : undefined),
      ...(name ? { name } : undefined),
    };
    return api
      .get<ProfessionalDirectoryItem[]>(DIRECTORY_BASE_PATH, { params: Object.keys(params).length > 0 ? params : undefined })
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

  /**
   * Etapa 19 — cadastro em massa (React Native: telas "Adicionar
   * disponibilidade"/"Configurar rotina semanal", que só variam o que
   * pré-preenchem antes de chamar isto). Ver
   * `SetBulkAvailabilityAsync`/`SetBulkAvailabilityBody` no backend.
   */
  setBulk(payload: SetBulkAvailabilityPayload) {
    return api.post<ProfessionalAvailabilitySlot[]>(`${AVAILABILITY_BASE_PATH}/bulk`, payload).then((response) => response.data);
  },
};

/**
 * Etapa 19 — "Minha Agenda": visão unificada por data/período
 * (Disponível/Agendado/Bloqueado/Indisponível). Ver
 * `Alilu.Api.Controllers.ProfessionalAgendaController` no backend.
 */
export const professionalAgendaApi = {
  getMine(from: string, to: string) {
    return api.get<AgendaDay[]>(`${AGENDA_BASE_PATH}/minha-agenda`, { params: { from, to } }).then((response) => response.data);
  },
};
