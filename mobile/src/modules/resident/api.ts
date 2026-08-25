import { api } from '../../services/api';
import type {
  CondominiumSummary,
  CondominiumUnitSummary,
  Membership,
  RedeemInvitationPayload,
  RequestResidentAccessPayload,
} from './types';

const MEMBERSHIPS_BASE_PATH = '/api/resident/memberships';
const DIRECTORY_BASE_PATH = '/api/directory';

/**
 * Chamadas HTTP cruas de validação do morador (PROMPT 05). Espelha
 * `modules/auth/api.ts`: este arquivo não conhece React nem o estado do
 * app — quem orquestra isso é `useMembership` (hook baseado em TanStack
 * Query, ver `hooks.ts`).
 */
export const membershipApi = {
  listMine() {
    return api.get<Membership[]>(MEMBERSHIPS_BASE_PATH).then((response) => response.data);
  },

  /** 204 (sem corpo) quando o usuário não tem nenhum vínculo Active — ver `ResidentMembershipsController.GetActive`. */
  getActive() {
    return api
      .get<Membership | null>(`${MEMBERSHIPS_BASE_PATH}/active`)
      .then((response) => (response.status === 204 ? null : response.data));
  },

  redeemInvitation(payload: RedeemInvitationPayload) {
    return api.post<Membership>(`${MEMBERSHIPS_BASE_PATH}/redeem-invitation`, payload).then((response) => response.data);
  },

  requestAccess(payload: RequestResidentAccessPayload) {
    return api.post<Membership>(`${MEMBERSHIPS_BASE_PATH}/request-access`, payload).then((response) => response.data);
  },
};

/** Diretório público de condomínios/unidades (FLUXO 2 — "Não encontrei minha unidade"). */
export const directoryApi = {
  listCondominiums() {
    return api.get<CondominiumSummary[]>(`${DIRECTORY_BASE_PATH}/condominiums`).then((response) => response.data);
  },

  listUnits(condominiumId: string) {
    return api
      .get<CondominiumUnitSummary[]>(`${DIRECTORY_BASE_PATH}/condominiums/${condominiumId}/units`)
      .then((response) => response.data);
  },
};
