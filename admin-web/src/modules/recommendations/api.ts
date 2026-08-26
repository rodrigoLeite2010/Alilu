import { api } from '../../services/api';
import type { Recommendation } from './types';

const BASE_PATH = '/api/admin/recommendations';

/** Chamadas administrativas do módulo Recommendations (PROMPT 10 — "Administrador pode moderar"). */
export const recommendationsApi = {
  listPending() {
    return api.get<Recommendation[]>(`${BASE_PATH}/pending`).then((response) => response.data);
  },

  listByCondominium(condominiumId: string) {
    return api
      .get<Recommendation[]>(`${BASE_PATH}/condominiums/${condominiumId}`)
      .then((response) => response.data);
  },

  approve(id: string) {
    return api.post<Recommendation>(`${BASE_PATH}/${id}/approve`).then((response) => response.data);
  },

  reject(id: string) {
    return api.post<Recommendation>(`${BASE_PATH}/${id}/reject`).then((response) => response.data);
  },

  block(id: string) {
    return api.post<Recommendation>(`${BASE_PATH}/${id}/block`).then((response) => response.data);
  },
};
