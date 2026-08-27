/**
 * Reexportado de `utils/rating.ts` (Etapa 22) — a formatação de estrelas
 * deixou de ser exclusiva deste módulo (o diretório público de
 * profissionais também passou a usá-la) e virou um utilitário puro
 * compartilhado. Mantido aqui só para não quebrar os imports já existentes
 * dentro do próprio módulo Reviews (ReviewScreen/RatingSummary/
 * ProfessionalReviewsScreen).
 */
export { RATING_STARS, starsForRating } from '../../utils/rating';

/** "2026-08-24T10:30:00Z" → "24/08/2026" (React Native: ReviewScreen "avaliações feitas"/ProfessionalReviewsScreen "avaliações recebidas"). Só a data — a Api devolve um `DateTime` completo, mas a hora exata da avaliação não é relevante para exibição. */
export function formatReviewDate(createdAt: string): string {
  const datePart = createdAt.slice(0, 10);
  const [year, month, day] = datePart.split('-');
  return `${day}/${month}/${year}`;
}
