import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { recommendationApi, recommendationDirectoryApi } from './api';
import type { CreateRecommendationPayload } from './types';

const MY_RECOMMENDATIONS_QUERY_KEY = ['recommendations', 'mine'];
const RECOMMENDATION_PROFILE_QUERY_KEY = ['recommendations', 'profile'];
const RECOMMENDATION_CATEGORIES_QUERY_KEY = ['recommendations', 'categories'];

/** React Native: RecommendationsScreen — "minhas recomendações". */
export function useMyRecommendations() {
  return useQuery({
    queryKey: MY_RECOMMENDATIONS_QUERY_KEY,
    queryFn: () => recommendationApi.listMine(),
  });
}

/** React Native: RecommendationDetailsScreen. */
export function useMyRecommendation(id: string | undefined) {
  return useQuery({
    queryKey: [...MY_RECOMMENDATIONS_QUERY_KEY, id],
    queryFn: () => recommendationApi.getMine(id as string),
    enabled: Boolean(id),
  });
}

/** React Native: RecommendProfessionalScreen — "recomendar profissional". */
export function useCreateRecommendation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateRecommendationPayload) => recommendationApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MY_RECOMMENDATIONS_QUERY_KEY });
    },
  });
}

/** React Native: ProfessionalRecommendationsScreen — "Carlos Elétrica ⭐ 4.9 Recomendado por 7 moradores". */
export function useProfessionalRecommendationProfile(professionalId: string | undefined) {
  return useQuery({
    queryKey: [...RECOMMENDATION_PROFILE_QUERY_KEY, professionalId],
    queryFn: () => recommendationDirectoryApi.getProfessionalProfile(professionalId as string),
    enabled: Boolean(professionalId),
  });
}

/** React Native: RecommendProfessionalScreen — categorias para o modo "indicação externa". */
export function useRecommendationCategories() {
  return useQuery({
    queryKey: RECOMMENDATION_CATEGORIES_QUERY_KEY,
    queryFn: () => recommendationDirectoryApi.listCategories(),
  });
}
