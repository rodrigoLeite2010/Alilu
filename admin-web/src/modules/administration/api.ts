import { api } from '../../services/api';
import type { AdminDashboard, CondominiumAdministrator } from './types';

/**
 * Chamadas administrativas do próprio módulo Administration (PROMPT 12):
 * dashboard e o vínculo administrador↔condomínio (só SuperAdmin usa este
 * segundo grupo — ver `AdminCondominiumAdministratorsController`).
 */
export const administrationApi = {
  getDashboard(condominiumId?: string) {
    return api
      .get<AdminDashboard>('/api/admin/dashboard', { params: condominiumId ? { condominiumId } : undefined })
      .then((response) => response.data);
  },

  listAdministrators() {
    return api
      .get<CondominiumAdministrator[]>('/api/admin/condominium-administrators')
      .then((response) => response.data);
  },

  assignAdministrator(userId: string, condominiumId: string) {
    return api
      .post<CondominiumAdministrator>('/api/admin/condominium-administrators', { userId, condominiumId })
      .then((response) => response.data);
  },
};
