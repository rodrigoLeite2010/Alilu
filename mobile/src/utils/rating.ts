/**
 * Formatação de nota média em estrelas — movido para `utils/` (Etapa 22)
 * porque deixou de ser exclusivo do módulo `reviews`: o diretório público
 * de profissionais (módulo `professional`, React Native: ProfessionalListScreen/
 * ProfessionalProfileScreen) também passou a mostrar a média na busca, a
 * pedido de Rodrigo — e módulos de funcionalidade não podem se importar
 * entre si (só `auth`, a "fundação compartilhada"). Como esta é uma função
 * pura (sem hook, sem estado, sem dependência de nenhum módulo), ela se
 * qualifica para `utils/` do mesmo jeito que `formatPhoneNumber`/
 * `getApiErrorMessage`. `reviews/reviewsFormat.ts` reexporta daqui para não
 * quebrar nenhum import já existente dentro do próprio módulo Reviews.
 */
export const RATING_STARS = [1, 2, 3, 4, 5] as const;

/** "★" para posições ≤ `rating`, "☆" para o restante — string pronta para exibir. */
export function starsForRating(rating: number): string {
  return RATING_STARS.map((position) => (position <= Math.round(rating) ? '★' : '☆')).join('');
}
