import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useProfessionalProfile } from '../../../../modules/professional';
import { useMyMemberships } from '../../../../modules/resident';
import { BookingConfirmationScreen } from '../../../../modules/scheduling';
import type { BookingItemInput } from '../../../../modules/scheduling';
import { useTheme } from '../../../../theme';

/** Composição final do fluxo (ver nota em `booking/[professionalId]/index.tsx`): reúne de novo o perfil do profissional (exibição) e o vínculo Active do morador (de onde vêm `condominiumId`/`unitId` de verdade). */
export default function BookingConfirm() {
  const { colors } = useTheme();
  const { professionalId, date, startTime, endTime, items } = useLocalSearchParams<{
    professionalId: string;
    date: string;
    startTime: string;
    endTime: string;
    items: string;
  }>();
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

  let parsedItems: BookingItemInput[] = [];
  try {
    parsedItems = JSON.parse(items) as BookingItemInput[];
  } catch {
    parsedItems = [];
  }

  return (
    <BookingConfirmationScreen
      professionalId={professionalId}
      date={date}
      startTime={startTime}
      endTime={endTime}
      items={parsedItems}
      professional={
        professional
          ? { id: professional.id, displayName: professional.displayName, phone: professional.phone, categories: professional.categories }
          : null
      }
      membership={activeMembership ? { condominiumId: activeMembership.condominiumId, unitId: activeMembership.unitId } : null}
    />
  );
}
