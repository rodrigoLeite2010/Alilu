import { api } from '../../services/api';
import type { ProfessionalCondominium, ProfessionalDirectoryItem } from './types';

const BASE_PATH = '/api/admin/professional-condominiums';

/**
 * Diretório público de profissionais (PROMPT 06) — reaproveitado aqui só
 * para resolver `professionalId` → nome/foto (`ProfessionalCondominium`
 * não guarda nome, mesmo raciocínio de `Membership`/Identity) e para dar
 * ao formulário "associar" uma lista para escolher, em vez de um Guid cru.
 */
export const professionalDirectoryApi = {
  list() {
    return api.get<ProfessionalDirectoryItem[]>('/api/directory/professionals').then((response) => response.data);
  },
};

/** Chamadas administrativas do módulo Professional (PROMPT 06, estendido no PROMPT 12 — "Profissionais"). */
export const professionalApi = {
  listPending() {
    return api.get<ProfessionalCondominium[]>(`${BASE_PATH}/pending`).then((response) => response.data);
  },

  listByCondominium(condominiumId: string) {
    return api
      .get<ProfessionalCondominium[]>(`${BASE_PATH}/condominiums/${condominiumId}`)
      .then((response) => response.data);
  },

  approve(id: string) {
    return api
      .post<ProfessionalCondominium>(`${BASE_PATH}/${id}/approve`)
      .then((response) => response.data);
  },

  reject(id: string) {
    return api.post<ProfessionalCondominium>(`${BASE_PATH}/${id}/reject`).then((response) => response.data);
  },

  block(id: string) {
    return api.post<ProfessionalCondominium>(`${BASE_PATH}/${id}/block`).then((response) => response.data);
  },

  associate(professionalId: string, condominiumId: string) {
    return api
      .post<ProfessionalCondominium>(`${BASE_PATH}/associate`, { professionalId, condominiumId })
      .then((response) => response.data);
  },
};
