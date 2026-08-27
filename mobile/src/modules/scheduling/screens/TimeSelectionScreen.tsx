import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { AppButton, AppText, Screen } from '../../../components';
import { useTheme } from '../../../theme';
import { getApiErrorMessage } from '../../../utils/apiError';
import { useAvailableTimeWindows } from '../hooks';
import { formatDateDisplay, formatTimeRange, fromApiTime } from '../schedulingFormat';
import type { AvailableTimeWindow } from '../types';

interface TimeSelectionScreenProps {
  professionalId: string;
  date: string;
}

/**
 * React Native: TimeSelectionScreen (PROMPT 08, comportamento atualizado
 * depois de testar o fluxo ponta a ponta com o app de verdade) — "escolher
 * horário".
 *
 * Antes: o morador digitava um horário candidato e pedia uma checagem
 * explícita (`GET .../availability-check`), tentativa atrás da outra, até
 * acertar um horário livre — a Etapa 08 original decidiu, de propósito,
 * nunca expor a agenda do profissional. Na prática isso virou "ficar
 * tentando hora em hora", pior experiência do que o risco de privacidade
 * que a decisão original evitava.
 *
 * Agora: a tela busca as janelas realmente livres do profissional para a
 * data escolhida (`useAvailableTimeWindows`, `GET .../availability-windows`
 * — já descontando agenda recorrente, exceções e agendamentos existentes,
 * ver `ProfessionalDirectoryController.ListAvailabilityWindows` no
 * backend) e o morador só pode TOCAR numa delas. REGRA DE PRODUTO: "o
 * morador não pode definir a hora do profissional, só aceitar a hora que
 * ele deixou livre" — por isso não há mais nenhum campo de texto aqui.
 * "Nunca confiar no calendário do React Native" continua valendo: a
 * verificação que de fato impede um agendamento inválido é a repetida no
 * servidor dentro de `POST /api/resident/bookings`.
 */
export function TimeSelectionScreen({ professionalId, date }: TimeSelectionScreenProps) {
  const { spacing, colors } = useTheme();
  const [selected, setSelected] = useState<AvailableTimeWindow | null>(null);

  const {
    data: windows,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useAvailableTimeWindows(professionalId, date);

  return (
    <Screen>
      <View style={{ flex: 1, gap: spacing.lg }}>
        <View>
          <AppText variant="title">Escolha um horário</AppText>
          <AppText variant="subtitle" color="secondary" style={{ marginTop: spacing.xxs }}>
            {formatDateDisplay(date)}
          </AppText>
        </View>

        {isLoading ? (
          <ActivityIndicator color={colors.brand.primary} />
        ) : isError ? (
          <View style={{ gap: spacing.sm }}>
            <AppText style={{ color: colors.semantic.error }}>
              {getApiErrorMessage(error, 'Não foi possível carregar os horários disponíveis.')}
            </AppText>
            <AppButton label="Tentar novamente" variant="secondary" onPress={() => refetch()} disabled={isFetching} />
          </View>
        ) : !windows || windows.length === 0 ? (
          <AppText color="muted">O profissional não tem nenhum horário livre nesta data — escolha outra data.</AppText>
        ) : (
          <ScrollView contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {windows.map((window) => {
              const isSelected = selected?.startTime === window.startTime && selected?.endTime === window.endTime;

              return (
                <AppButton
                  key={`${window.startTime}-${window.endTime}`}
                  label={formatTimeRange(window.startTime, window.endTime)}
                  variant={isSelected ? 'primary' : 'secondary'}
                  onPress={() => setSelected(window)}
                />
              );
            })}
          </ScrollView>
        )}

        <View style={{ gap: spacing.sm, marginTop: 'auto' }}>
          <AppButton
            label="Continuar"
            onPress={() =>
              selected &&
              router.push({
                pathname: '/(resident)/booking/[professionalId]/services',
                params: {
                  professionalId,
                  date,
                  startTime: fromApiTime(selected.startTime),
                  endTime: fromApiTime(selected.endTime),
                },
              })
            }
            disabled={!selected}
          />
          <AppButton label="Voltar" variant="ghost" onPress={() => router.back()} />
        </View>
      </View>
    </Screen>
  );
}
