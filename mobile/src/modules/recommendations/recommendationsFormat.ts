import type { RecommendationStatus } from './types';

/** Rótulos PT-BR (React Native: RecommendationsScreen/RecommendationDetailsScreen) — mesmo padrão de `modules/scheduling/schedulingFormat.ts#BOOKING_STATUS_LABEL`. */
export const RECOMMENDATION_STATUS_LABEL: Record<RecommendationStatus, string> = {
  Pending: 'Aguardando moderação',
  Approved: 'Aprovada',
  Rejected: 'Recusada',
  Blocked: 'Bloqueada',
};

/** "2026-08-24T10:30:00Z" → "24/08/2026" — mesma função de `modules/reviews/reviewsFormat.ts#formatReviewDate`, duplicada aqui pelo mesmo motivo (módulos não se importam entre si). */
export function formatRecommendationDate(createdAt: string): string {
  const datePart = createdAt.slice(0, 10);
  const [year, month, day] = datePart.split('-');
  return `${day}/${month}/${year}`;
}
