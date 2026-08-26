import { api } from '../../services/api';
import type { Membership } from './types';

const BASE_PATH = '/api/admin/memberships';

/** Chamadas administrativas do módulo Resident (PROMPT 05, estendido no PROMPT 12 — "Moradores"). */
export const residentApi = {
  listPending() {
    return api.get<Membership[]>(`${BASE_PATH}/pending`).then((response) => response.data);
  },

  listByCondominium(condominiumId: string) {
    return api
      .get<Membership[]>(`${BASE_PATH}/condominiums/${condominiumId}`)
      .then((response) => response.data);
  },

  getById(membershipId: string) {
    return api.get<Membership>(`${BASE_PATH}/${membershipId}`).then((response) => response.data);
  },

  getActiveByUnit(unitId: string) {
    return api
      .get<Membership | null>(`${BASE_PATH}/units/${unitId}/active-membership`)
      .then((response) => response.data);
  },

  approve(membershipId: string) {
    return api.post<Membership>(`${BASE_PATH}/${membershipId}/approve`).then((response) => response.data);
  },

  reject(membershipId: string) {
    return api.post<Membership>(`${BASE_PATH}/${membershipId}/reject`).then((response) => response.data);
  },

  block(membershipId: string) {
    return api.post<Membership>(`${BASE_PATH}/${membershipId}/block`).then((response) => response.data);
  },
};
