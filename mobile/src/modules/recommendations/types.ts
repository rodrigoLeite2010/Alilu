/**
 * Espelha `Alilu.Modules.Recommendations.Application/Dtos.cs` (PROMPT 10).
 * A Api serializa em camelCase — mesma observação já registrada em
 * `modules/reviews/types.ts` (Etapa 09).
 *
 * Campos exatamente como o backend devolve — de propósito NÃO há
 * `updatedAt` (mesma decisão de `Review`, Etapa 09) — ver
 * `Recommendation.cs` no backend.
 */
export type RecommendationStatus = 'Pending' | 'Approved' | 'Rejected' | 'Blocked';

export interface Recommendation {
  id: string;
  condominiumId: string;
  recommendedByUserId: string;
  professionalId: string | null;
  externalProfessionalName: string | null;
  externalPhone: string | null;
  serviceCategoryId: string;
  comment: string;
  status: RecommendationStatus;
  createdAt: string;
  approvedAt: string | null;
  approvedBy: string | null;
}

/** Corpo de `POST /api/resident/recommendations` (React Native: RecommendProfessionalScreen). Exatamente um entre `professionalId` e `externalProfessionalName` deve ser informado — o backend valida essa regra (XOR). */
export interface CreateRecommendationPayload {
  professionalId?: string;
  externalProfessionalName?: string;
  externalPhone?: string;
  serviceCategoryId: string;
  comment: string;
}

/**
 * Resposta de `GET /api/directory/professionals/{id}/recommendations` —
 * composta na Api a partir de três módulos (Professional, Reviews,
 * Recommendations, ver `ProfessionalDirectoryController.GetRecommendationProfile`
 * no backend). React Native: ProfessionalRecommendationsScreen —
 * "Carlos Elétrica ⭐ 4.9 Recomendado por 7 moradores".
 *
 * De propósito NÃO tem um "✓ Já prestou serviço no condomínio" — decisão
 * de escopo documentada em ARCHITECTURE.md, "Etapa 10" (exigiria uma nova
 * consulta ao módulo Scheduling, fora do escopo de "SOMENTE Recommendations").
 */
export interface ProfessionalRecommendationProfile {
  professionalId: string;
  professionalName: string;
  averageRating: number;
  totalReviews: number;
  totalRecommendations: number;
  recommendations: Recommendation[];
}

/**
 * Diretório público de categorias, duplicado aqui pelo mesmo motivo de
 * `modules/scheduling/types.ts#BookingServiceCategorySummary` (módulos não
 * se importam entre si) — usado por RecommendProfessionalScreen quando a
 * indicação é externa (sem um profissional do ALILU cujos próprios
 * serviços oferecidos possam ser reaproveitados).
 */
export interface RecommendationServiceCategorySummary {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
}
