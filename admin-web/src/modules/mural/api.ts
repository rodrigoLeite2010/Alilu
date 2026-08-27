import { api } from '../../services/api';
import type { MuralPost } from './types';

const BASE_PATH = '/api/admin/mural';

/** Chamadas administrativas do módulo Mural (Etapa 23 — "síndico/admin pode bloquear um post depois"). */
export const muralApi = {
  listByCondominium(condominiumId: string) {
    return api.get<MuralPost[]>(`${BASE_PATH}/condominiums/${condominiumId}`).then((response) => response.data);
  },

  block(id: string) {
    return api.post<MuralPost>(`${BASE_PATH}/${id}/block`).then((response) => response.data);
  },
};
