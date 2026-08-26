/** Espelha `Alilu.Modules.Recommendations.Application/Dtos.cs` e `Domain/RecommendationStatus.cs`. */
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
