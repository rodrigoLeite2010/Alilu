import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import { AppButton, AppText, Screen } from '../../../components';
import { useTheme } from '../../../theme';
import { buildMonthGrid, MONTH_LABEL } from '../availabilityFormat';
import { useMyAvailability } from '../hooks';

/**
 * React Native: CalendarAvailabilityScreen (PROMPT 07) — visão de
 * calendário das exceções de disponibilidade (bloqueios/liberações). Grade
 * de mês própria, sem biblioteca externa (este projeto não usa nenhuma
 * biblioteca de calendário/data até agora — ver `availabilityFormat.ts`).
 * Tocar num dia leva para BlockedDatesScreen, onde as exceções são de fato
 * criadas/removidas — esta tela é só visualização + atalho de navegação.
 */
export function CalendarAvailabilityScreen() {
  const { spacing, colors, radii } = useTheme();
  const { data: overview, isLoading, isError, refetch } = useMyAvailability();

  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });

  const weeks = useMemo(() => buildMonthGrid(cursor.year, cursor.month), [cursor]);
  const exceptionByDate = new Map((overview?.exceptions ?? []).map((exception) => [exception.date, exception]));

  function changeMonth(delta: number) {
    setCursor((previous) => {
      const next = new Date(previous.year, previous.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: spacing.md }}>
        <View>
          <AppText variant="title">Calendário de disponibilidade</AppText>
          <AppText variant="subtitle" color="secondary" style={{ marginTop: spacing.xxs }}>
            Dias com bloqueios ou liberações aparecem destacados
          </AppText>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <AppButton label="◀" variant="secondary" onPress={() => changeMonth(-1)} />
          <AppText variant="subtitle">{`${MONTH_LABEL[cursor.month]} de ${cursor.year}`}</AppText>
          <AppButton label="▶" variant="secondary" onPress={() => changeMonth(1)} />
        </View>

        {isLoading ? (
          <ActivityIndicator color={colors.brand.primary} />
        ) : isError ? (
          <View style={{ gap: spacing.xs }}>
            <AppText style={{ color: colors.semantic.error }}>Não foi possível carregar o calendário.</AppText>
            <AppButton label="Tentar de novo" variant="secondary" onPress={() => refetch()} />
          </View>
        ) : (
          <View style={{ gap: spacing.xxs }}>
            {weeks.map((week, weekIndex) => (
              <View key={weekIndex} style={{ flexDirection: 'row', gap: spacing.xxs }}>
                {week.map((cell) => {
                  const exception = exceptionByDate.get(cell.date);
                  const backgroundColor = !cell.isCurrentMonth
                    ? colors.background
                    : exception?.type === 'Blocked'
                      ? colors.semantic.error
                      : exception?.type === 'Available'
                        ? colors.semantic.success
                        : colors.surfaceAlt;

                  return (
                    <Pressable
                      key={cell.date}
                      onPress={() => router.push('/(professional)/availability/blocked-dates')}
                      style={{
                        flex: 1,
                        aspectRatio: 1,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: radii.sm,
                        backgroundColor,
                        opacity: cell.isCurrentMonth ? 1 : 0.35,
                      }}
                    >
                      <AppText variant="caption" style={{ color: exception ? colors.text.inverse : colors.text.primary }}>
                        {cell.day}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <LegendDot color={colors.semantic.error} label="Bloqueado" />
          <LegendDot color={colors.semantic.success} label="Liberado" />
        </View>
      </ScrollView>
    </Screen>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  const { spacing, radii } = useTheme();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xxs }}>
      <View style={{ width: 12, height: 12, borderRadius: radii.sm, backgroundColor: color }} />
      <AppText variant="caption" color="secondary">
        {label}
      </AppText>
    </View>
  );
}
