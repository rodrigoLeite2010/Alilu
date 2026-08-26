import { api } from '../../services/api';
import type { Condominium, CondominiumUnit, CreateUnitPayload, EditUnitPayload } from './types';

const BASE_PATH = '/api/admin/condominiums';

/** Chamadas administrativas do módulo Condominium (PROMPT 04, estendido no PROMPT 12). */
export const condominiumApi = {
  list() {
    return api.get<Condominium[]>(BASE_PATH).then((response) => response.data);
  },

  listUnits(condominiumId: string) {
    return api
      .get<CondominiumUnit[]>(`${BASE_PATH}/${condominiumId}/units`)
      .then((response) => response.data);
  },

  createUnit(condominiumId: string, payload: CreateUnitPayload) {
    return api
      .post<CondominiumUnit>(`${BASE_PATH}/${condominiumId}/units`, payload)
      .then((response) => response.data);
  },

  getUnit(unitId: string) {
    return api.get<CondominiumUnit>(`${BASE_PATH}/units/${unitId}`).then((response) => response.data);
  },

  editUnit(unitId: string, payload: EditUnitPayload) {
    return api
      .put<CondominiumUnit>(`${BASE_PATH}/units/${unitId}`, payload)
      .then((response) => response.data);
  },

  blockUnit(unitId: string) {
    return api
      .post<CondominiumUnit>(`${BASE_PATH}/units/${unitId}/block`)
      .then((response) => response.data);
  },
};
