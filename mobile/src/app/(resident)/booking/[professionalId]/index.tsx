import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useProfessionalProfile } from '../../../../modules/professional';
import { useMyMemberships } from '../../../../modules/resident';
import { ProfessionalBookingScreen } from '../../../../modules/scheduling';
import { useTheme } from '../../../../theme';

/**
 * Composição raiz do fluxo de agendamento do morador (PROMPT 08) — mesmo
 * papel de `BookingsController` no backend: o módulo Scheduling não pode
 * (nem deve) conhecer os módulos Resident/Professional, então é aqui, na
 * camada de rotas, que o perfil do profissional (módulo Professional) e o
 * vínculo Active do morador (módulo Resident) são resolvidos e repassados
 * como props já prontos para `ProfessionalBookingScreen` — mesmo espírito
 * de `(resident)/index.tsx` passando `membership` para `ResidentHomeScreen`.
 */
export default function BookingStart() {
  const { colors } = useTheme();
  const { professionalId } = useLocalSearchParams<{ professionalId: string }>();
  const { data: professional, isLoading: isLoadingProfessional } = useProfessionalProfile(professionalId);
  const { data: memberships, isLoading: isLoadingMemberships } = useMyMemberships();

  if (isLoadingProfessional || isLoadingMemberships) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.brand.primary} />
      </View>
    );
  }

  const activeMembership = memberships?.find((membership) => membership.status === 'Active');

  return (
    <ProfessionalBookingScreen
      professionalId={professionalId}
      professional={
        professional
          ? {
              id: professional.id,
              displayName: professional.displayName,
              phone: professional.phone,
              categories: professional.categories,
            }
          : null
      }
      membership={activeMembership ? { condominiumId: activeMembership.condominiumId, unitId: activeMembership.unitId } : null}
    />
  );
}
