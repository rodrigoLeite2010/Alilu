import { router } from 'expo-router';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { AppButton, AppText, Screen } from '../../../components';
import { useTheme } from '../../../theme';
import { DAY_OF_WEEK_LABEL, DAY_OF_WEEK_ORDER, fromApiTime } from '../availabilityFormat';
import { useMyAvailability, useRemoveAvailability } from '../hooks';
import type { ProfessionalAvailabilitySlot } from '../types';

/**
 * React Native: AvailabilityScreen (PROMPT 07) — agenda recorrente
 * agrupada por dia da semana, exemplo do próprio prompt: "Segunda:
 * 08:00-12:00, 13:00-17:00; Terça: 08:00-12:00; Quarta: indisponível". Um
 * dia sem nenhum intervalo Active aparece como "Indisponível" — não existe
 * um registro próprio para isso no backend (ver `ProfessionalAvailability`).
 */
export function AvailabilityScreen() {
  const { spacing, colors } = useTheme();
  const { data: overview, isLoading, isError, refetch } = useMyAvailability();
  const removeSlot = useRemoveAvailability();

  const activeByDay = new Map<string, ProfessionalAvailabilitySlot[]>();
  for (const slot of overview?.weeklySchedule ?? []) {
    if (!slot.active) {
      continue;
    }
    const list = activeByDay.get(slot.dayOfWeek) ?? [];
    list.push(slot);
    activeByDay.set(slot.dayOfWeek, list);
  }
  for (const list of activeByDay.values()) {
    list.sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: spacing.md }}>
        <View>
          <AppText variant="title">Minha disponibilidade</AppText>
          <AppText variant="subtitle" color="secondary" style={{ marginTop: spacing.xxs }}>
            Configure os dias e horários em que você atende
          </AppText>
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
          <AppButton
            label="Datas bloqueadas"
            variant="secondary"
            onPress={() => router.push('/(professional)/availability/blocked-dates')}
          />
          <AppButton
            label="Calendário"
            variant="secondary"
            onPress={() => router.push('/(professional)/availability/calendar')}
          />
        </View>

        {isLoading ? (
          <ActivityIndicator color={colors.brand.primary} />
        ) : isError ? (
          <View style={{ gap: spacing.xs }}>
            <AppText style={{ color: colors.semantic.error }}>Não foi possível carregar sua disponibilidade.</AppText>
            <AppButton label="Tentar de novo" variant="secondary" onPress={() => refetch()} />
          </View>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {DAY_OF_WEEK_ORDER.map((day) => {
              const slots = activeByDay.get(day) ?? [];
              return (
                <View key={day} style={{ gap: spacing.xxs }}>
                  <AppText variant="subtitle">{DAY_OF_WEEK_LABEL[day]}</AppText>
                  {slots.length === 0 ? (
                    <AppText color="muted">Indisponível</AppText>
                  ) : (
                    slots.map((slot) => (
                      <View
                        key={slot.id}
                        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                      >
                        <AppText>{`${fromApiTime(slot.startTime)} - ${fromApiTime(slot.endTime)}`}</AppText>
                        <View style={{ flexDirection: 'row', gap: spacing.xxs }}>
                          <AppButton
                            label="Editar"
                            variant="ghost"
                            onPress={() =>
                              router.push({ pathname: '/(professional)/availability/editor', params: { id: slot.id } })
                            }
                          />
                          <AppButton
                            label="Remover"
                            variant="ghost"
                            onPress={() => removeSlot.mutateAsync(slot.id)}
                            disabled={removeSlot.isPending}
                          />
                        </View>
                      </View>
                    ))
                  )}
                </View>
              );
            })}
          </View>
        )}

        <AppButton label="Adicionar horário" onPress={() => router.push('/(professional)/availability/editor')} />
      </ScrollView>
    </Screen>
  );
}
