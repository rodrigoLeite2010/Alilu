import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { AppButton, AppText, Badge, Card, Screen } from '../../../components';
import { useTheme } from '../../../theme';
import { getApiErrorMessage } from '../../../utils/apiError';
import {
  useAcceptBooking,
  useBookingCondominiumsDirectory,
  useBookingProfessionalsDirectory,
  useBookingServiceCategoriesDirectory,
  useBookingUnitsDirectory,
  useCancelMyBooking,
  useCancelProfessionalBooking,
  useCompleteBooking,
  useMarkBookingNoShow,
  useMyBooking,
  useMyProfessionalRequest,
  useRejectBooking,
  useStartBooking,
} from '../hooks';
import { BOOKING_STATUS_LABEL, BOOKING_STATUS_TONE, formatDateDisplay, formatTimeRange } from '../schedulingFormat';
import type { Booking } from '../types';

interface BookingDetailsScreenProps {
  bookingId: string;
  /** `resident`: rota `(resident)/bookings/[id]`. `professional`: rota `(professional)/requests/[id]`. Decide quais dados/ações aparecem — mesmo agendamento, duas visões (ver `BookingsController`/`ProfessionalBookingsController` no backend). */
  role: 'resident' | 'professional';
  /**
   * Ponto de extensão do PROMPT 09 — o módulo `scheduling` não pode
   * importar o módulo `reviews` (independência de módulos, mesma regra do
   * backend), então quem quer mostrar um botão "Avaliar"/"Ver avaliação"
   * aqui (só faz sentido para `role === 'resident'` com
   * `booking.status === 'Completed'`) fornece este slot — mesmo papel da
   * Api compor módulos nos controllers. A rota hospedeira
   * (`bookings/[id]/index.tsx`) é quem passa isso, importando `modules/reviews`
   * livremente (ela não tem essa restrição).
   */
  reviewSlot?: (booking: Booking) => ReactNode;
}

/**
 * React Native: BookingDetailsScreen (PROMPT 08) — uma única tela para as
 * duas visões (morador/profissional), já que o agendamento é o mesmo — só
 * as ações disponíveis mudam por papel e por status (ver `Booking.cs` no
 * backend para as transições válidas: `EnsureCancellable`/`EnsureStatus`/
 * `Complete`/`MarkNoShow`).
 */
export function BookingDetailsScreen({ bookingId, role, reviewSlot }: BookingDetailsScreenProps) {
  const { spacing, colors } = useTheme();
  const [actionError, setActionError] = useState<string | null>(null);

  const residentQuery = useMyBooking(role === 'resident' ? bookingId : undefined);
  const professionalQuery = useMyProfessionalRequest(role === 'professional' ? bookingId : undefined);
  const { data: booking, isLoading, isError, refetch } = role === 'resident' ? residentQuery : professionalQuery;

  const { data: professionals } = useBookingProfessionalsDirectory();
  const { data: condominiums } = useBookingCondominiumsDirectory();
  const { data: categories } = useBookingServiceCategoriesDirectory();
  const { data: units } = useBookingUnitsDirectory(booking?.condominiumId);

  const cancelMine = useCancelMyBooking();
  const cancelAsProfessional = useCancelProfessionalBooking();
  const acceptBooking = useAcceptBooking();
  const rejectBooking = useRejectBooking();
  const startBooking = useStartBooking();
  const completeBooking = useCompleteBooking();
  const markNoShow = useMarkBookingNoShow();

  const isMutating =
    cancelMine.isPending ||
    cancelAsProfessional.isPending ||
    acceptBooking.isPending ||
    rejectBooking.isPending ||
    startBooking.isPending ||
    completeBooking.isPending ||
    markNoShow.isPending;

  async function run(action: () => Promise<unknown>, fallback: string) {
    setActionError(null);
    try {
      await action();
    } catch (error) {
      setActionError(getApiErrorMessage(error, fallback));
    }
  }

  if (isLoading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.brand.primary} style={{ marginTop: spacing.md }} />
      </Screen>
    );
  }

  if (isError || !booking) {
    return (
      <Screen>
        <View style={{ gap: spacing.xs }}>
          <AppText style={{ color: colors.semantic.error }}>Não foi possível carregar este agendamento.</AppText>
          <AppButton label="Tentar de novo" variant="secondary" onPress={() => refetch()} />
          <AppButton label="Voltar" variant="ghost" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const professionalName = professionals?.find((professional) => professional.id === booking.professionalId)?.displayName;
  const condominium = condominiums?.find((item) => item.id === booking.condominiumId);
  const unit = units?.find((item) => item.id === booking.unitId);
  const categoryNameById = new Map((categories ?? []).map((category) => [category.id, category.name]));

  const canCancel = role === 'resident'
    ? booking.status === 'Requested' || booking.status === 'Confirmed'
    : booking.status === 'Requested' || booking.status === 'Confirmed';

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: spacing.lg }}>
        <View style={{ gap: spacing.xxs }}>
          <AppText variant="title">{professionalName ?? 'Agendamento'}</AppText>
          <Badge label={BOOKING_STATUS_LABEL[booking.status]} tone={BOOKING_STATUS_TONE[booking.status]} />
        </View>

        <Card style={{ gap: spacing.xxs }}>
          <AppText color="secondary">{formatDateDisplay(booking.scheduledDate)}</AppText>
          <AppText color="secondary">{formatTimeRange(booking.startTime, booking.endTime)}</AppText>
          {condominium ? <AppText color="secondary">{`${condominium.name} — ${condominium.city}/${condominium.state}`}</AppText> : null}
          {unit ? <AppText color="secondary">{`Unidade ${unit.code}`}</AppText> : null}
        </Card>

        <Card style={{ gap: spacing.xxs }}>
          <AppText variant="subtitle">Serviços</AppText>
          {booking.items.map((item) => (
            <AppText key={item.id} color="secondary">
              {`${categoryNameById.get(item.serviceCategoryId) ?? 'Serviço'} × ${item.quantity}`}
              {item.description ? ` — ${item.description}` : ''}
            </AppText>
          ))}
        </Card>

        {booking.notes ? (
          <Card style={{ gap: spacing.xxs }}>
            <AppText variant="subtitle">Observações</AppText>
            <AppText color="secondary">{booking.notes}</AppText>
          </Card>
        ) : null}

        {actionError ? <AppText style={{ color: colors.semantic.error }}>{actionError}</AppText> : null}

        <View style={{ gap: spacing.sm }}>
          {role === 'professional' && booking.status === 'Requested' ? (
            <>
              <AppButton
                label="Aceitar"
                onPress={() => run(() => acceptBooking.mutateAsync(booking.id), 'Não foi possível aceitar esta solicitação.')}
                disabled={isMutating}
              />
              <AppButton
                label="Recusar"
                variant="secondary"
                onPress={() => run(() => rejectBooking.mutateAsync(booking.id), 'Não foi possível recusar esta solicitação.')}
                disabled={isMutating}
              />
            </>
          ) : null}

          {role === 'professional' && booking.status === 'Confirmed' ? (
            <AppButton
              label="Iniciar atendimento"
              variant="secondary"
              onPress={() => run(() => startBooking.mutateAsync(booking.id), 'Não foi possível iniciar o atendimento.')}
              disabled={isMutating}
            />
          ) : null}

          {role === 'professional' && (booking.status === 'Confirmed' || booking.status === 'InProgress') ? (
            <>
              <AppButton
                label="Concluir"
                onPress={() => run(() => completeBooking.mutateAsync(booking.id), 'Não foi possível concluir este agendamento.')}
                disabled={isMutating}
              />
              <AppButton
                label="Morador não compareceu"
                variant="secondary"
                onPress={() => run(() => markNoShow.mutateAsync(booking.id), 'Não foi possível registrar a ausência.')}
                disabled={isMutating}
              />
            </>
          ) : null}

          {canCancel ? (
            <AppButton
              label="Cancelar agendamento"
              variant="secondary"
              onPress={() =>
                run(
                  () => (role === 'resident' ? cancelMine.mutateAsync(booking.id) : cancelAsProfessional.mutateAsync(booking.id)),
                  'Não foi possível cancelar este agendamento.',
                )
              }
              disabled={isMutating}
            />
          ) : null}

          {role === 'resident' && booking.status === 'Completed' && reviewSlot ? reviewSlot(booking) : null}

          <AppButton label="Voltar" variant="ghost" onPress={() => router.back()} />
        </View>
      </ScrollView>
    </Screen>
  );
}
