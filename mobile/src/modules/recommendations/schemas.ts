import { z } from 'zod';

/**
 * React Native: RecommendProfessionalScreen — modo "recomendar um
 * profissional do ALILU" (chegou com `professionalId` já resolvido pela
 * rota hospedeira, ver ProfessionalProfileScreen — "Recomendar"). Só
 * pede categoria e comentário — o profissional já está definido.
 */
export const internalRecommendationFormSchema = z.object({
  serviceCategoryId: z.string().min(1, 'Escolha uma categoria de serviço.'),
  comment: z.string().min(1, 'Conte por que você recomenda esse profissional.').max(1000, 'Comentário muito longo.'),
});

export type InternalRecommendationFormValues = z.infer<typeof internalRecommendationFormSchema>;

/**
 * React Native: RecommendProfessionalScreen — modo "indicação externa"
 * (profissional ainda não está no ALILU). `externalPhone` é opcional —
 * mesma nullability de `Recommendation.ExternalPhone` no backend.
 */
export const externalRecommendationFormSchema = z.object({
  externalProfessionalName: z.string().min(1, 'Informe o nome do profissional.').max(200, 'Nome muito longo.'),
  externalPhone: z.string().max(30, 'Telefone muito longo.').optional(),
  serviceCategoryId: z.string().min(1, 'Escolha uma categoria de serviço.'),
  comment: z.string().min(1, 'Conte por que você recomenda esse profissional.').max(1000, 'Comentário muito longo.'),
});

export type ExternalRecommendationFormValues = z.infer<typeof externalRecommendationFormSchema>;
