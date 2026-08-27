import { api } from '../../services/api';
import type { CreateMuralPostPayload, MuralPost } from './types';

const RESIDENT_MURAL_BASE_PATH = '/api/resident/mural';

/**
 * Chamadas HTTP cruas do lado do morador (Etapa 23). Espelha
 * `modules/recommendations/api.ts#recommendationApi`: este arquivo não
 * conhece React nem o estado do app — quem orquestra isso é `hooks.ts`
 * (TanStack Query).
 */
export const muralApi = {
  /** React Native: MuralScreen — feed do meu condomínio. */
  listMine() {
    return api.get<MuralPost[]>(RESIDENT_MURAL_BASE_PATH).then((response) => response.data);
  },

  /** React Native: tela "Novo post" do Mural. */
  create(payload: CreateMuralPostPayload) {
    return api.post<MuralPost>(RESIDENT_MURAL_BASE_PATH, payload).then((response) => response.data);
  },
};
