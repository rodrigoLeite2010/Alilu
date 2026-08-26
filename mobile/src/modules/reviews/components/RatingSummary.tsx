import { View } from 'react-native';

import { AppText } from '../../../components';
import { useTheme } from '../../../theme';
import { starsForRating } from '../reviewsFormat';

interface RatingSummaryProps {
  averageRating: number;
  totalReviews: number;
}

/**
 * React Native: RatingSummary (PROMPT 09) — "visualizar média", usado no
 * topo de ProfessionalReviewsScreen. Só a própria visão do profissional
 * sobre as avaliações recebidas — o prompt não pediu exposição pública da
 * média para o morador (ver ARCHITECTURE.md, "Etapa 09 — decisões de
 * escopo"), então este componente não aparece em nenhuma tela do lado do
 * morador.
 */
export function RatingSummary({ averageRating, totalReviews }: RatingSummaryProps) {
  const { spacing, colors } = useTheme();

  if (totalReviews === 0) {
    return (
      <View style={{ gap: spacing.xxs }}>
        <AppText variant="title">☆☆☆☆☆</AppText>
        <AppText color="secondary">Ainda sem avaliações</AppText>
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.xxs }}>
      <AppText variant="title" style={{ color: colors.brand.primary }}>
        {starsForRating(averageRating)}
      </AppText>
      <AppText color="secondary">
        {`${averageRating.toFixed(1)} de 5 · ${totalReviews} ${totalReviews === 1 ? 'avaliação' : 'avaliações'}`}
      </AppText>
    </View>
  );
}
