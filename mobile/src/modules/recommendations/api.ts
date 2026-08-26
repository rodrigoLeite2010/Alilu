import { api } from '../../services/api';
import type {
  CreateRecommendationPayload,
  ProfessionalRecommendationProfile,
  Recommendation,
  RecommendationServiceCategorySummary,
} from './types';

const RESIDENT_RECOMMENDATIONS_BASE_PATH = '/api/resident/recommendations';
const PROFESSIONAL_DIRECTORY_BASE_PATH = '/api/directory/professionals';

/**
 * Chamadas HTTP cruas do lado do morador (PROMPT 10). Espelha
 * `modules/reviews/api.ts#reviewApi`: este arquivo não conhece React nem o
 * estado do app — quem orquestra isso é `hooks.ts` (TanStack Query).
 */
export const recommendationApi = {
  /** React Native: RecommendationsScreen — "minhas recomendações". */
  listMine() {
    return api.get<Recommendation[]>(RESIDENT_RECOMMENDATIONS_BASE_PATH).then((response) => response.data);
  },

  /** React Native: RecommendationDetailsScreen. */
  getMine(id: string) {
    return api.get<Recommendation>(`${RESIDENT_RECOMMENDATIONS_BASE_PATH}/${id}`).then((response) => response.data);
  },

  /** React Native: RecommendProfessionalScreen — "recomendar profissional". */
  create(payload: CreateRecommendationPayload) {
    return api.post<Recommendation>(RESIDENT_RECOMMENDATIONS_BASE_PATH, payload).then((response) => response.data);
  },
};

/**
 * Diretório público (qualquer usuário autenticado, morador ou
 * profissional) — o "perfil de recomendações" de um profissional do ALILU
 * e a lista de categorias de serviço. Duplica de propósito chamadas já
 * existentes em `modules/professional/api.ts` (mesma convenção de módulos
 * não se importarem entre si — ver nota em `types.ts`).
 */
export const recommendationDirectoryApi = {
  /** React Native: ProfessionalRecommendationsScreen — "Carlos Elétrica ⭐ 4.9 Recomendado por 7 moradores". */
  getProfessionalProfile(professionalId: string) {
    return api
      .get<ProfessionalRecommendationProfile>(`${PROFESSIONAL_DIRECTORY_BASE_PATH}/${professionalId}/recommendations`)
      .then((response) => response.data);
  },

  /** React Native: RecommendProfessionalScreen — usado só no modo "indicação externa" (sem um profissional do ALILU cujos próprios serviços possam ser reaproveitados). */
  listCategories() {
    return api
      .get<RecommendationServiceCategorySummary[]>(`${PROFESSIONAL_DIRECTORY_BASE_PATH}/categories`)
      .then((response) => response.data);
  },
};
