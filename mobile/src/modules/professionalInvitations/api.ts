import { api } from '../../services/api';
import type { CreateProfessionalInvitationPayload, ProfessionalInvitation } from './types';

const BASE_PATH = '/api/resident/professional-invitations';

/**
 * Chamadas HTTP cruas do lado do morador (Etapa 23). Espelha
 * `modules/recommendations/api.ts#recommendationApi`: este arquivo não
 * conhece React nem o estado do app — quem orquestra isso é `hooks.ts`
 * (TanStack Query).
 */
export const professionalInvitationApi = {
  /** React Native: tela "Convidar prestador" — histórico "convites enviados". */
  listMine() {
    return api.get<ProfessionalInvitation[]>(BASE_PATH).then((response) => response.data);
  },

  /** React Native: tela "Convidar prestador". */
  create(payload: CreateProfessionalInvitationPayload) {
    return api.post<ProfessionalInvitation>(BASE_PATH, payload).then((response) => response.data);
  },
};
