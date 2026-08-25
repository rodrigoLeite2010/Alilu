import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

import { AppButton, AppText, AppTextInput, Screen } from '../../../components';
import { useTheme } from '../../../theme';
import { getApiErrorMessage } from '../../../utils/apiError';
import { useCreateBooking } from '../hooks';
import { formatDateDisplay, formatTimeRange, toApiTime } from '../schedulingFormat';
import { bookingNotesSchema } from '../schemas';
import type { BookingItemInput, BookingMembershipSummary, BookingProfessionalSummary } from '../types';

interface BookingConfirmationScreenProps {
  professionalId: string;
  date: string;
  startTime: string;
  endTime: string;
  items: BookingItemInput[];
  /** Resolvido pela camada de rotas — usado só para exibição (nome do profissional, nome dos serviços escolhidos). */
  professional: BookingProfessionalSummary | null;
  /** Resolvido pela camada de rotas a partir do vínculo Active do morador — é dele que vêm `condominiumId`/`unitId` do agendamento (REGRA CRÍTICA: "morador só pode agendar para a própria Unit"). */
  membership: BookingMembershipSummary | null;
}

/**
 * React Native: BookingConfirmationScreen (PROMPT 08) — passo final do
 * fluxo do morador: revisão, "adicionar observações" e "enviar
 * solicitação". Todas as REGRAS CRÍTICAS que cruzam módulos (Membership
 * Active, profissional atende o condomínio, horário disponível, sem
 * conflito) são revalidadas pelo servidor dentro de `POST
 * /api/resident/bookings` — esta tela só monta o payload com o que foi
 * escolhido nos passos anteriores.
 */
export function BookingConfirmationScreen({
  professionalId,
  date,
  startTime,
  endTime,
  items,
  professional,
  membership,
}: BookingConfirmationScreenProps) {
  const { spacing, colors } = useTheme();
  const [notes, setNotes] = useState('');
  const [notesError, setNotesError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const createBooking = useCreateBooking();

  const categoryNameById = new Map((professional?.categories ?? []).map((category) => [category.id, category.name]));

  async function onSubmit() {
    setSubmitError(null);
    setNotesError(null);

    const notesResult = bookingNotesSchema.safeParse(notes || undefined);
    if (!notesResult.success) {
      setNotesError(notesResult.error.issues[0]?.message ?? 'Observação inválida.');
      return;
    }

    if (!membership) {
      setSubmitError('Você precisa de um vínculo ativo com um condomínio para agendar.');
      return;
    }

    try {
      const booking = await createBooking.mutateAsync({
        professionalId,
        condominiumId: membership.condominiumId,
        unitId: membership.unitId,
        scheduledDate: date,
        startTime: toApiTime(startTime),
        endTime: toApiTime(endTime),
        notes: notesResult.data,
        items,
      });
      router.replace({ pathname: '/(resident)/bookings/[id]', params: { id: booking.id } });
    } catch (error) {
      setSubmitError(getApiErrorMessage(error, 'Não foi possível enviar a solicitação de agendamento.'));
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ gap: spacing.lg }} keyboardShouldPersistTaps="handled">
          <AppText variant="title">Confirmar agendamento</AppText>

          <View style={{ gap: spacing.xxs }}>
            <AppText variant="subtitle">{professional?.displayName ?? 'Profissional'}</AppText>
            <AppText color="secondary">{formatDateDisplay(date)}</AppText>
            <AppText color="secondary">{formatTimeRange(startTime, endTime)}</AppText>
          </View>

          <View style={{ gap: spacing.xxs }}>
            <AppText variant="subtitle">Serviços</AppText>
            {items.map((item) => (
              <AppText key={item.serviceCategoryId} color="secondary">
                {`${categoryNameById.get(item.serviceCategoryId) ?? 'Serviço'} × ${item.quantity}`}
                {item.description ? ` — ${item.description}` : ''}
              </AppText>
            ))}
          </View>

          <AppTextInput
            label="Observações (opcional)"
            multiline
            value={notes}
            onChangeText={setNotes}
            errorMessage={notesError ?? undefined}
          />

          {submitError ? <AppText style={{ color: colors.semantic.error }}>{submitError}</AppText> : null}

          <View style={{ gap: spacing.sm }}>
            <AppButton
              label={createBooking.isPending ? 'Enviando…' : 'Enviar solicitação'}
              onPress={onSubmit}
              disabled={createBooking.isPending || !membership}
            />
            <AppButton label="Voltar" variant="ghost" onPress={() => router.back()} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
