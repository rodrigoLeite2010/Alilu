import { useLocalSearchParams } from 'expo-router';

import { useProfessionalProfile, useServiceCategories } from '../../../modules/professional';
import { RecommendationDetailsScreen, useMyRecommendation } from '../../../modules/recommendations';

/**
 * Composição raiz do PROMPT 10: o módulo Recommendations não conhece o
 * diretório de profissionais/categorias (módulo Professional) — é aqui,
 * na camada de rotas, que o nome do profissional (quando a recomendação
 * está vinculada) e o nome da categoria são resolvidos e repassados como
 * props prontas — mesmo espírito de `bookings/[id]/review.tsx` (Etapa 09).
 */
export default function ResidentRecommendationDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: recommendation } = useMyRecommendation(id);
  const { data: professional } = useProfessionalProfile(recommendation?.professionalId ?? undefined);
  const { data: categories } = useServiceCategories();

  const categoryName = categories?.find((category) => category.id === recommendation?.serviceCategoryId)?.name;

  return <RecommendationDetailsScreen recommendationId={id} professionalName={professional?.displayName} categoryName={categoryName} />;
}
