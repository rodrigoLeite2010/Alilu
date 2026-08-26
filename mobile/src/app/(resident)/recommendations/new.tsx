import { RecommendProfessionalScreen, useRecommendationCategories } from '../../../modules/recommendations';

/**
 * Composição raiz do PROMPT 10 (modo "indicação externa" — sem
 * `professionalId`): sem um profissional específico para restringir a
 * lista de categorias, usa o diretório público completo (duplicado em
 * `modules/recommendations/api.ts` pelo mesmo motivo de sempre — módulos
 * não se importam entre si).
 */
export default function NewRecommendation() {
  const { data: categories } = useRecommendationCategories();

  return <RecommendProfessionalScreen categories={categories ?? []} />;
}
