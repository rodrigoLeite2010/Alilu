import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { AppButton, AppText, Screen } from '../../../components';
import { useTheme } from '../../../theme';
import { useAvailableDatesInRange } from '../hooks';
import { buildMonthGrid, MONTH_LABEL } from '../schedulingFormat';

interface DateSelectionScreenProps {
  professionalId: string;
}

/**
 * React Native: DateSelectionScreen (PROMPT 08, comportamento atualizado
 * depois de testar o fluxo ponta a ponta — "a experiência do calendário
 * está confusa, tinha que só deixar escolher a data que tem
 * disponibilidade"). Grade de mês própria, sem biblioteca externa (mesma
 * abordagem de `professional/screens/CalendarAvailabilityScreen`, Etapa
 * 07) — datas passadas E datas sem nenhuma janela livre do profissional
 * ficam desabilitadas (`useAvailableDatesInRange`, `GET
 * .../available-dates` para o mês exibido — ver
 * `ProfessionalDirectoryController.ListAvailableDates` no backend). "Nunca
 * confiar no calendário do React Native" continua valendo: quem de fato
 * impede um agendamento inválido é a verificação repetida no servidor
 * dentro de `POST /api/resident/bookings`.
 */
export function DateSelectionScreen({ professionalId }: DateSelectionScreenProps) {
  const { spacing, colors, radii } = useTheme();
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const weeks = useMemo(() => buildMonthGrid(cursor.year, cursor.month), [cursor]);

  const monthRange = useMemo(() => {
    const firstDay = weeks[0]?.find((cell) => cell.isCurrentMonth)?.date;
    const lastWeek = weeks[weeks.length - 1];
    const lastDay = [...(lastWeek ?? [])].reverse().find((cell) => cell.isCurrentMonth)?.date;
    return { from: firstDay, to: lastDay };
  }, [weeks]);

  const {
    data: availableDates,
    isLoading: isLoadingAvailableDates,
    isError: isAvailableDatesError,
  } = useAvailableDatesInRange(professionalId, monthRange.from, monthRange.to);
  const availableDateSet = useMemo(() => new Set(availableDates ?? []), [availableDates]);
  // Só aplica o filtro depois que a consulta termina com sucesso — se ela
  // falhar, cai de volta no comportamento antigo (só desabilita dias
  // passados) em vez de travar o morador por completo; TimeSelectionScreen
  // já trata graciosamente o caso de "nenhum horário livre nesta data".
  const filterByAvailability = !isLoadingAvailableDates && !isAvailableDatesError;

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
          <AppText variant="caption" color="secondary" style={{ marginTop: spacing.xxs }}>
            {isLoadingAvailableDates
              ? 'Carregando dias com horário livre…'
              : 'Só é possível escolher dias com horário livre do profissional.'}
          </AppText>
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
                const disabled = !cell.isCurrentMonth || cell.isPast || (filterByAvailability && !availableDateSet.has(cell.date));

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
