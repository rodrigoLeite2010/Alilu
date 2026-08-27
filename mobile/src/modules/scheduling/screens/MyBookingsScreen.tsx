import { router } from 'expo-router';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { AppButton, AppText, Badge, Card, Screen } from '../../../components';
import { useTheme } from '../../../theme';
import { useBookingProfessionalsDirectory, useMyBookings } from '../hooks';
import { BOOKING_STATUS_LABEL, BOOKING_STATUS_TONE, formatDateDisplay, formatTimeRange } from '../schedulingFormat';

/** React Native: MyBookingsScreen (PROMPT 08) — "meus agendamentos". Modernizado na Etapa 20: cada item é um `Card` com `Badge` de status. */
export function MyBookingsScreen() {
  const { spacing, colors } = useTheme();
  const { data: bookings, isLoading, isError, refetch } = useMyBookings();
  const { data: professionals } = useBookingProfessionalsDirectory();

  const professionalNameById = new Map((professionals ?? []).map((professional) => [professional.id, professional.displayName]));

  const sorted = [...(bookings ?? [])].sort((a, b) =>
    `${b.scheduledDate}${b.startTime}`.localeCompare(`${a.scheduledDate}${a.startTime}`),
  );

  return (
    <Screen>
      <View style={{ flex: 1, gap: spacing.md }}>
        <AppText variant="title">Meus agendamentos</AppText>

        {isLoading ? (
          <ActivityIndicator color={colors.brand.primary} />
        ) : isError ? (
          <View style={{ gap: spacing.xs }}>
            <AppText style={{ color: colors.semantic.error }}>Não foi possível carregar seus agendamentos.</AppText>
            <AppButton label="Tentar de novo" variant="secondary" onPress={() => refetch()} />
          </View>
        ) : sorted.length === 0 ? (
          <AppText color="muted">Você ainda não fez nenhum agendamento.</AppText>
        ) : (
          <ScrollView contentContainerStyle={{ gap: spacing.xs }}>
            {sorted.map((booking) => (
              <Card
                key={booking.id}
                onPress={() => router.push({ pathname: '/(resident)/bookings/[id]', params: { id: booking.id } })}
                style={{ gap: spacing.xxs }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <AppText variant="subtitle">{professionalNameById.get(booking.professionalId) ?? 'Profissional'}</AppText>
                  <Badge label={BOOKING_STATUS_LABEL[booking.status]} tone={BOOKING_STATUS_TONE[booking.status]} />
                </View>
                <AppText color="secondary">{`${formatDateDisplay(booking.scheduledDate)} · ${formatTimeRange(booking.startTime, booking.endTime)}`}</AppText>
              </Card>
            ))}
          </ScrollView>
        )}

        <AppButton label="Voltar" variant="ghost" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}
