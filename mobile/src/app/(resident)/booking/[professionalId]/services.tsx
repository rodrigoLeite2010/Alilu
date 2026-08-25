import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useProfessionalProfile } from '../../../../modules/professional';
import { BookingServicesScreen } from '../../../../modules/scheduling';
import { useTheme } from '../../../../theme';

/** Composição: as categorias oferecidas vêm do diretório público do módulo Professional — ver nota em `booking/[professionalId]/index.tsx`. */
export default function BookingServices() {
  const { colors } = useTheme();
  const { professionalId, date, startTime, endTime } = useLocalSearchParams<{
    professionalId: string;
    date: string;
    startTime: string;
    endTime: string;
  }>();
  const { data: professional, isLoading } = useProfessionalProfile(professionalId);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.brand.primary} />
      </View>
    );
  }

  return (
    <BookingServicesScreen
      professionalId={professionalId}
      date={date}
      startTime={startTime}
      endTime={endTime}
      categories={professional?.categories ?? []}
    />
  );
}
