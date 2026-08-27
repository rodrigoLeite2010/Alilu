import type { MuralPostType } from './types';

/** Rótulos PT-BR (React Native: MuralScreen/tela "Novo post") — mesmo padrão de `modules/recommendations/recommendationsFormat.ts#RECOMMENDATION_STATUS_LABEL`. */
export const MURAL_POST_TYPE_LABEL: Record<MuralPostType, string> = {
  Complaint: 'Reclamação',
  Suggestion: 'Sugestão',
  Warning: 'Aviso',
  UnregisteredProfessional: 'Prestador não cadastrado',
};

/** Etapa 23 — tom do `Badge` para cada tipo, mesmo espírito de `scheduling/schedulingFormat.ts#BOOKING_STATUS_TONE`. */
export const MURAL_POST_TYPE_TONE: Record<MuralPostType, 'success' | 'accent' | 'error' | 'neutral'> = {
  Complaint: 'error',
  Suggestion: 'success',
  Warning: 'accent',
  UnregisteredProfessional: 'neutral',
};

/** "2026-08-24T10:30:00Z" → "24/08/2026" — mesma função de `modules/recommendations/recommendationsFormat.ts#formatRecommendationDate`, duplicada aqui pelo mesmo motivo (módulos não se importam entre si). */
export function formatMuralPostDate(createdAt: string): string {
  const datePart = createdAt.slice(0, 10);
  const [year, month, day] = datePart.split('-');
  return `${day}/${month}/${year}`;
}
