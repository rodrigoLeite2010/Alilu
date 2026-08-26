import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useProfessionalProfile } from '../../../../modules/professional';
import { RecommendProfessionalScreen } from '../../../../modules/recommendations';
import { useTheme } from '../../../../theme';

/**
 * Composição raiz do PROMPT 10 (modo "profissional do ALILU"): o módulo
 * Recommendations não conhece o diretório de profissionais (módulo
 * Professional) — é aqui, na camada de rotas, que o perfil (nome +
 * categorias que o profissional realmente oferece) é resolvido e
 * repassado como props prontas para RecommendProfessionalScreen — mesmo
 * espírito de `bookings/[id]/review.tsx` (Etapa 09).
 */
export default function RecommendProfessional() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: professional, isLoading } = useProfessionalProfile(id);

  if (isLoading || !professional) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.brand.primary} />
      </View>
    );
  }

  return (
    <RecommendProfessionalScreen
      professionalId={professional.id}
      professionalName={professional.displayName}
      categories={professional.categories}
    />
  );
}
