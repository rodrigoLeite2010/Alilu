import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import { AppButton, AppText, Screen } from '../../../components';
import { useTheme } from '../../../theme';
import { getApiErrorMessage } from '../../../utils/apiError';
import { useAcceptBooking, useBookingCondominiumsDirectory, useMyProfessionalRequests, useRejectBooking } from '../hooks';
import { BOOKING_STATUS_LABEL, formatDateDisplay, formatTimeRange } from '../schedulingFormat';
import type { BookingStatus } from '../types';

const FILTERS: { label: string; status: BookingStatus | undefined }[] = [
  { label: 'Pendentes', status: 'Requested' },
  { label: 'Todos', status: undefined },
];

/**
 * React Native: ProfessionalRequestsScreen (PROMPT 08) — "solicitações
 * recebidas; aceitar; recusar". Não mostra o nome do morador (nenhum
 * diretório público expõe isso — ver `Booking` em `types.ts`); mostra o
 * condomínio/data/horário, que já bastam para o profissional decidir.
 */
export function ProfessionalRequestsScreen() {
  const { spacing, colors, radii } = useTheme();
  const [filter, setFilter] = useState<BookingStatus | undefined>('Requested');
  const { data: bookings, isLoading, isError, refetch } = useMyProfessionalRequests(filter);
  const { data: condominiums } = useBookingCondominiumsDirectory();
  const acceptBooking = useAcceptBooking();
  const rejectBooking = useRejectBooking();
  const [actionError, setActionError] = useState<string | null>(null);

  const condominiumNameById = new Map((condominiums ?? []).map((condominium) => [condominium.id, condominium.name]));

  const sorted = [...(bookings ?? [])].sort((a, b) => `${a.scheduledDate}${a.startTime}`.localeCompare(`${b.scheduledDate}${b.startTime}`));

  async function onAccept(id: string) {
    setActionError(null);
    try {
      await acceptBooking.mutateAsync(id);
    } catch (error) {
      setActionError(getApiErrorMessage(error, 'Não foi possível aceitar esta solicitação.'));
    }
  }

  async function onReject(id: string) {
    setActionError(null);
    try {
      await rejectBooking.mutateAsync(id);
    } catch (error) {
      setActionError(getApiErrorMessage(error, 'Não foi possível recusar esta solicitação.'));
    }
  }

  return (
    <Screen>
      <View style={{ flex: 1, gap: spacing.md }}>
        <AppText variant="title">Solicitações de agendamento</AppText>

        <View style={{ flexDirection: 'row', gap: spacing.xxs }}>
          {FILTERS.map((item) => (
            <AppButton
              key={item.label}
              label={item.label}
              variant={filter === item.status ? 'primary' : 'secondary'}
              onPress={() => setFilter(item.status)}
            />
          ))}
        </View>

        {actionError ? <AppText style={{ color: colors.semantic.error }}>{actionError}</AppText> : null}

        {isLoading ? (
          <ActivityIndicator color={colors.brand.primary} />
        ) : isError ? (
          <View style={{ gap: spacing.xs }}>
            <AppText style={{ color: colors.semantic.error }}>Não foi possível carregar as solicitações.</AppText>
            <AppButton label="Tentar de novo" variant="secondary" onPress={() => refetch()} />
          </View>
        ) : sorted.length === 0 ? (
          <AppText color="muted">Nenhuma solicitação por aqui.</AppText>
        ) : (
          <ScrollView contentContainerStyle={{ gap: spacing.xs }}>
            {sorted.map((booking) => (
              <View key={booking.id} style={{ padding: spacing.sm, borderRadius: radii.md, backgroundColor: colors.surfaceAlt, gap: spacing.xxs }}>
                <Pressable onPress={() => router.push({ pathname: '/(professional)/requests/[id]', params: { id: booking.id } })}>
                  <AppText variant="subtitle">{condominiumNameById.get(booking.condominiumId) ?? 'Condomínio'}</AppText>
                  <AppText color="secondary">{`${formatDateDisplay(booking.scheduledDate)} · ${formatTimeRange(booking.startTime, booking.endTime)}`}</AppText>
                  <AppText variant="caption" color="secondary">
                    {BOOKING_STATUS_LABEL[booking.status]}
                  </AppText>
                </Pressable>

                {booking.status === 'Requested' ? (
                  <View style={{ flexDirection: 'row', gap: spacing.xxs, marginTop: spacing.xxs }}>
                    <AppButton
                      label="Aceitar"
                      onPress={() => onAccept(booking.id)}
                      disabled={acceptBooking.isPending || rejectBooking.isPending}
                    />
                    <AppButton
                      label="Recusar"
                      variant="secondary"
                      onPress={() => onReject(booking.id)}
                      disabled={acceptBooking.isPending || rejectBooking.isPending}
                    />
                  </View>
                ) : null}
              </View>
            ))}
          </ScrollView>
        )}

        <AppButton label="Voltar" variant="ghost" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}
