import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useProfessionalProfile } from '../../../../modules/professional';
import { ReviewScreen } from '../../../../modules/reviews';
import { useTheme } from '../../../../theme';

/**
 * Composição raiz da Etapa 23 (pedido de Rodrigo: "avaliar qualquer
 * profissional buscando pelo nome, sem precisar ter contratado antes") —
 * mesmo espírito de `bookings/[id]/review.tsx` (Etapa 09) e
 * `professionals/[id]/recommend.tsx` (PROMPT 10): o módulo Reviews não
 * conhece o diretório de profissionais (módulo Professional), então é
 * aqui, na camada de rotas, que o nome do profissional é resolvido e
 * repassado como prop pronta para `ReviewScreen` — desta vez com
 * `professionalId` no lugar de `bookingId` (avaliação LIVRE, sem
 * agendamento).
 */
export default function ProfessionalReview() {
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

  return <ReviewScreen professionalId={professional.id} professionalName={professional.displayName} />;
}
