import { router } from 'expo-router';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { AppButton, AppText, Card, Screen } from '../../../components';
import { useTheme } from '../../../theme';
import { RatingSummary } from '../components/RatingSummary';
import { useMyRatingSummary, useReceivedReviews } from '../hooks';
import { formatReviewDate, starsForRating } from '../reviewsFormat';

/**
 * React Native: ProfessionalReviewsScreen (PROMPT 09) — "visualizar
 * avaliações recebidas; visualizar média". Acessível a partir de
 * "Avaliações" em ProfessionalEditScreen (módulo Professional), mesmo
 * padrão de "Solicitações"/"Configurar disponibilidade" (Etapas 07/08).
 *
 * Nunca mostra o nome do morador (o backend nem devolve isso — ver
 * `ReviewResponse` em Dtos.cs) — "não permitir avaliação anônima" garante
 * que toda avaliação TEM um autor, não que o autor seja exibido para o
 * profissional; o prompt só pediu "visualizar avaliações recebidas", sem
 * mencionar identificar quem avaliou.
 */
export function ProfessionalReviewsScreen() {
  const { spacing, colors } = useTheme();
  const { data: summary, isLoading: isLoadingSummary } = useMyRatingSummary();
  const { data: reviews, isLoading: isLoadingReviews, isError, refetch } = useReceivedReviews();

  const isLoading = isLoadingSummary || isLoadingReviews;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: spacing.lg }}>
        <AppText variant="title">Minhas avaliações</AppText>

        {isLoading ? (
          <ActivityIndicator color={colors.brand.primary} />
        ) : isError ? (
          <View style={{ gap: spacing.xs }}>
            <AppText style={{ color: colors.semantic.error }}>Não foi possível carregar suas avaliações.</AppText>
            <AppButton label="Tentar de novo" variant="secondary" onPress={() => refetch()} />
          </View>
        ) : (
          <>
            {summary ? <RatingSummary averageRating={summary.averageRating} totalReviews={summary.totalReviews} /> : null}

            <View style={{ gap: spacing.sm }}>
              {(reviews ?? []).map((review) => (
                <Card key={review.id} style={{ gap: spacing.xxs }}>
                  <AppText style={{ color: colors.brand.accent, fontSize: 18 }}>{starsForRating(review.rating)}</AppText>
                  {review.comment ? <AppText>{review.comment}</AppText> : null}
                  <AppText variant="caption" color="secondary">
                    {formatReviewDate(review.createdAt)}
                  </AppText>
                </Card>
              ))}
              {(reviews ?? []).length === 0 ? <AppText color="muted">Você ainda não recebeu avaliações.</AppText> : null}
            </View>
          </>
        )}

        <AppButton label="Voltar" variant="ghost" onPress={() => router.back()} />
      </ScrollView>
    </Screen>
  );
}
