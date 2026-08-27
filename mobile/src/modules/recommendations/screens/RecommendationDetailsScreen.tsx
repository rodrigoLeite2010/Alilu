import { router } from 'expo-router';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { AppButton, AppText, Badge, Screen } from '../../../components';
import { useTheme } from '../../../theme';
import { useMyRecommendation } from '../hooks';
import { formatRecommendationDate, RECOMMENDATION_STATUS_LABEL, RECOMMENDATION_STATUS_TONE } from '../recommendationsFormat';

interface RecommendationDetailsScreenProps {
  recommendationId: string;
  /** Resolvido pela rota hospedeira a partir do diretório de profissionais (módulo Professional) quando a recomendação está vinculada — mesmo espírito de `ReviewScreen#professionalName`. */
  professionalName?: string;
  /** Resolvido pela rota hospedeira a partir do diretório de categorias (módulo Professional) — mesmo motivo acima. */
  categoryName?: string;
}

/**
 * React Native: RecommendationDetailsScreen (PROMPT 10) — detalhe de uma
 * recomendação feita pelo morador: status da moderação, categoria,
 * comentário e o profissional (do ALILU, vinculado, ou indicação
 * externa).
 */
export function RecommendationDetailsScreen({ recommendationId, professionalName, categoryName }: RecommendationDetailsScreenProps) {
  const { spacing, colors } = useTheme();
  const { data: recommendation, isLoading, isError, refetch } = useMyRecommendation(recommendationId);

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: spacing.lg, flexGrow: 1 }}>
        <AppText variant="title">Detalhes da recomendação</AppText>

        {isLoading ? (
          <ActivityIndicator color={colors.brand.primary} style={{ marginTop: spacing.md }} />
        ) : isError || !recommendation ? (
          <View style={{ gap: spacing.xs }}>
            <AppText style={{ color: colors.semantic.error }}>Não foi possível carregar esta recomendação.</AppText>
            <AppButton label="Tentar de novo" variant="secondary" onPress={() => refetch()} />
          </View>
        ) : (
          <View style={{ gap: spacing.sm }}>
            <View>
              <AppText variant="subtitle" color="secondary">
                Profissional
              </AppText>
              <AppText variant="body">
                {recommendation.professionalId
                  ? (professionalName ?? 'Profissional do ALILU')
                  : recommendation.externalProfessionalName}
              </AppText>
              {!recommendation.professionalId && recommendation.externalPhone ? (
                <AppText variant="caption" color="secondary">
                  {recommendation.externalPhone}
                </AppText>
              ) : null}
            </View>

            {categoryName ? (
              <View>
                <AppText variant="subtitle" color="secondary">
                  Categoria
                </AppText>
                <AppText variant="body">{categoryName}</AppText>
              </View>
            ) : null}

            <View style={{ gap: spacing.xxs }}>
              <AppText variant="subtitle" color="secondary">
                Status
              </AppText>
              <Badge label={RECOMMENDATION_STATUS_LABEL[recommendation.status]} tone={RECOMMENDATION_STATUS_TONE[recommendation.status]} />
            </View>

            <View>
              <AppText variant="subtitle" color="secondary">
                Comentário
              </AppText>
              <AppText variant="body">{recommendation.comment}</AppText>
            </View>

            <AppText variant="caption" color="secondary">
              Enviada em {formatRecommendationDate(recommendation.createdAt)}
            </AppText>

            {recommendation.approvedAt ? (
              <AppText variant="caption" color="secondary">
                Aprovada em {formatRecommendationDate(recommendation.approvedAt)}
              </AppText>
            ) : null}
          </View>
        )}

        <AppButton label="Voltar" variant="ghost" onPress={() => router.back()} />
      </ScrollView>
    </Screen>
  );
}
