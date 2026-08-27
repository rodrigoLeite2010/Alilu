import { router } from 'expo-router';
import { ActivityIndicator, FlatList, View } from 'react-native';

import { AppButton, AppText, Badge, Card, Screen } from '../../../components';
import { useTheme } from '../../../theme';
import { useMyRecommendations } from '../hooks';
import { formatRecommendationDate, RECOMMENDATION_STATUS_LABEL, RECOMMENDATION_STATUS_TONE } from '../recommendationsFormat';

/**
 * React Native: RecommendationsScreen (PROMPT 10) — "minhas
 * recomendações". Acessível a partir de "Recomendações" em
 * ResidentHomeScreen (módulo Resident), mesmo padrão de "Meus
 * agendamentos" (Etapa 08).
 *
 * Cada item mostra o profissional/indicação externa de forma resumida —
 * como este módulo não conhece o diretório de profissionais (módulo
 * Professional), o nome de um profissional vinculado não aparece aqui
 * (só o Id, se algum dia for necessário) — mostrar o nome exigiria
 * resolver o Id na camada de rotas para uma lista inteira, o que o
 * prompt não pediu; RecommendationDetailsScreen (tela seguinte) já
 * resolve isso para um único item.
 */
export function RecommendationsScreen() {
  const { spacing, colors } = useTheme();
  const { data: recommendations, isLoading, isError, refetch } = useMyRecommendations();

  return (
    <Screen>
      <View style={{ flex: 1, gap: spacing.md }}>
        <AppText variant="title">Minhas recomendações</AppText>

        <AppButton label="Nova recomendação" onPress={() => router.push('/(resident)/recommendations/new')} />

        {isLoading ? (
          <ActivityIndicator color={colors.brand.primary} style={{ marginTop: spacing.md }} />
        ) : isError ? (
          <View style={{ gap: spacing.xs }}>
            <AppText style={{ color: colors.semantic.error }}>Não foi possível carregar suas recomendações.</AppText>
            <AppButton label="Tentar de novo" variant="secondary" onPress={() => refetch()} />
          </View>
        ) : (
          <FlatList
            data={recommendations}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ gap: spacing.sm }}
            renderItem={({ item }) => (
              <Card
                onPress={() => router.push({ pathname: '/(resident)/recommendations/[id]', params: { id: item.id } })}
                style={{ gap: spacing.xxs }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <AppText variant="subtitle">{item.externalProfessionalName ?? 'Profissional do ALILU'}</AppText>
                  <Badge label={RECOMMENDATION_STATUS_LABEL[item.status]} tone={RECOMMENDATION_STATUS_TONE[item.status]} />
                </View>
                <AppText variant="caption" color="secondary">
                  {formatRecommendationDate(item.createdAt)}
                </AppText>
              </Card>
            )}
            ListEmptyComponent={<AppText color="muted">Você ainda não fez nenhuma recomendação.</AppText>}
          />
        )}
      </View>
    </Screen>
  );
}
