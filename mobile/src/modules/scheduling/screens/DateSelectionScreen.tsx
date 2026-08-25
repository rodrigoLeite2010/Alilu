import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { AppButton, AppText, Screen } from '../../../components';
import { useTheme } from '../../../theme';
import { buildMonthGrid, MONTH_LABEL } from '../schedulingFormat';

interface DateSelectionScreenProps {
  professionalId: string;
}

/**
 * React Native: DateSelectionScreen (PROMPT 08) — "escolher data". Grade
 * de mês própria, sem biblioteca externa (mesma abordagem de
 * `professional/screens/CalendarAvailabilityScreen`, Etapa 07) — datas
 * passadas ficam desabilitadas. Esta tela não sabe nada sobre a agenda
 * real do profissional: só depois de escolher data e horário é que
 * TimeSelectionScreen consulta a disponibilidade de verdade.
 */
export function DateSelectionScreen({ professionalId }: DateSelectionScreenProps) {
  const { spacing, colors, radii } = useTheme();
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const weeks = useMemo(() => buildMonthGrid(cursor.year, cursor.month), [cursor]);

  function changeMonth(delta: number) {
    setCursor((previous) => {
      const next = new Date(previous.year, previous.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  }

  return (
    <Screen>
      <View style={{ flex: 1, gap: spacing.md }}>
        <View>
          <AppText variant="title">Escolha uma data</AppText>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <AppButton label="◀" variant="secondary" onPress={() => changeMonth(-1)} />
          <AppText variant="subtitle">{`${MONTH_LABEL[cursor.month]} de ${cursor.year}`}</AppText>
          <AppButton label="▶" variant="secondary" onPress={() => changeMonth(1)} />
        </View>

        <ScrollView contentContainerStyle={{ gap: spacing.xxs }}>
          {weeks.map((week, weekIndex) => (
            <View key={weekIndex} style={{ flexDirection: 'row', gap: spacing.xxs }}>
              {week.map((cell) => {
                const isSelected = cell.date === selectedDate;
                const disabled = !cell.isCurrentMonth || cell.isPast;

                return (
                  <Pressable
                    key={cell.date}
                    disabled={disabled}
                    onPress={() => setSelectedDate(cell.date)}
                    style={{
                      flex: 1,
                      aspectRatio: 1,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: radii.sm,
                      backgroundColor: isSelected ? colors.brand.primary : colors.surfaceAlt,
                      opacity: disabled ? 0.3 : 1,
                    }}
                  >
                    <AppText variant="caption" style={{ color: isSelected ? colors.text.inverse : colors.text.primary }}>
                      {cell.day}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </ScrollView>

        <View style={{ gap: spacing.sm }}>
          <AppButton
            label="Continuar"
            onPress={() =>
              router.push({
                pathname: '/(resident)/booking/[professionalId]/time',
                params: { professionalId, date: selectedDate as string },
              })
            }
            disabled={!selectedDate}
          />
          <AppButton label="Voltar" variant="ghost" onPress={() => router.back()} />
        </View>
      </View>
    </Screen>
  );
}
