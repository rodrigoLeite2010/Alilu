import { router } from 'expo-router';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { AppButton, AppText, Screen } from '../../../components';
import { useTheme } from '../../../theme';
import { useProfessionalRecommendationProfile } from '../hooks';
import { formatRecommendationDate } from '../recommendationsFormat';

interface ProfessionalRecommendationsScreenProps {
  professionalId: string;
}

/**
 * React Native: ProfessionalRecommendationsScreen (PROMPT 10) — "Carlos
 * Elétrica ⭐ 4.9 Recomendado por 7 moradores". Consulta pública e
 * composta (ver `ProfessionalDirectoryController.GetRecommendationProfile`
 * no backend — nome vem do módulo Professional, nota do módulo Reviews,
 * contagem/lista de indicações do módulo Recommendations); acessível tanto
 * pelo morador (a partir de "Ver recomendações" em ProfessionalProfileScreen,
 * avaliando quem contratar) quanto pelo próprio profissional (a partir de
 * "Recomendações" em ProfessionalEditScreen, vendo o próprio perfil).
 *
 * De propósito NÃO mostra "✓ Já prestou serviço no condomínio" — decisão
 * de escopo documentada em ARCHITECTURE.md, "Etapa 10" (exigiria uma nova
 * consulta ao módulo Scheduling, fora do escopo de "SOMENTE Recommendations";
 * "cada informação deve possuir origem real no banco" foi cumprido
 * mostrando só o que já existe: nome, nota e contagem/lista de indicações).
 */
export function ProfessionalRecommendationsScreen({ professionalId }: ProfessionalRecommendationsScreenProps) {
  const { spacing, colors } = useTheme();
  const { data: profile, isLoading, isError, refetch } = useProfessionalRecommendationProfile(professionalId);

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: spacing.lg }}>
        <AppText variant="title">Recomendações</AppText>

        {isLoading ? (
          <ActivityIndicator color={colors.brand.primary} style={{ marginTop: spacing.md }} />
        ) : isError || !profile ? (
          <View style={{ gap: spacing.xs }}>
            <AppText style={{ color: colors.semantic.error }}>Não foi possível carregar as recomendações.</AppText>
            <AppButton label="Tentar de novo" variant="secondary" onPress={() => refetch()} />
          </View>
        ) : (
          <>
            <View style={{ gap: spacing.xxs }}>
              <AppText variant="title">{profile.professionalName}</AppText>
              <AppText color="secondary">
                {profile.totalReviews > 0 ? `⭐ ${profile.averageRating.toFixed(1)}` : 'Ainda sem avaliações'}
              </AppText>
              <AppText color="secondary">
                {profile.totalRecommendations === 0
                  ? 'Ainda sem recomendações'
                  : `Recomendado por ${profile.totalRecommendations} ${profile.totalRecommendations === 1 ? 'morador' : 'moradores'}`}
              </AppText>
            </View>

            <View style={{ gap: spacing.sm }}>
              {profile.recommendations.map((recommendation) => (
                <View
                  key={recommendation.id}
                  style={{ gap: spacing.xxs, borderBottomWidth: 1, borderColor: colors.border, paddingBottom: spacing.sm }}
                >
                  <AppText>{recommendation.comment}</AppText>
                  <AppText variant="caption" color="secondary">
                    {formatRecommendationDate(recommendation.createdAt)}
                  </AppText>
                </View>
              ))}
            </View>
          </>
        )}

        <AppButton label="Voltar" variant="ghost" onPress={() => router.back()} />
      </ScrollView>
    </Screen>
  );
}
