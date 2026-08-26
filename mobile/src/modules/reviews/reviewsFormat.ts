/** As cinco estrelas do rating — usado tanto no seletor (ReviewScreen) quanto na exibição (RatingSummary/ProfessionalReviewsScreen). */
export const RATING_STARS = [1, 2, 3, 4, 5] as const;

/** "★" para posições ≤ `rating`, "☆" para o restante — string pronta para exibir (React Native: RatingSummary/ProfessionalReviewsScreen, exibição não-interativa). */
export function starsForRating(rating: number): string {
  return RATING_STARS.map((position) => (position <= Math.round(rating) ? '★' : '☆')).join('');
}

/** "2026-08-24T10:30:00Z" → "24/08/2026" (React Native: ReviewScreen "avaliações feitas"/ProfessionalReviewsScreen "avaliações recebidas"). Só a data — a Api devolve um `DateTime` completo, mas a hora exata da avaliação não é relevante para exibição. */
export function formatReviewDate(createdAt: string): string {
  const datePart = createdAt.slice(0, 10);
  const [year, month, day] = datePart.split('-');
  return `${day}/${month}/${year}`;
}
