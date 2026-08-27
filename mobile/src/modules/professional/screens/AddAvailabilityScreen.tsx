import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

import { AppButton, AppText, AppTextInput, Screen } from '../../../components';
import { useTheme } from '../../../theme';
import { getApiErrorMessage } from '../../../utils/apiError';
import {
  DAY_OF_WEEK_LABEL,
  DAY_OF_WEEK_ORDER,
  DATE_INPUT_PATTERN,
  formatDateInput,
  parseDateInput,
  QUICK_DATE_RANGE_OPTIONS,
  resolveQuickDateRange,
  STANDARD_PERIODS,
  TIME_PATTERN,
  toApiTime,
  WEEKDAY_SHORTCUTS,
  type QuickDateRangeKey,
} from '../availabilityFormat';
import { useSetBulkAvailability } from '../hooks';
import type { AvailabilityPeriodInput, DayOfWeek } from '../types';

type QuickChoice = QuickDateRangeKey | 'custom';
type RoutineChoice = 'forever' | 'untilDate';
type PeriodKey = (typeof STANDARD_PERIODS)[number]['key'];

/**
 * React Native: "+ Adicionar disponibilidade" e "📅 Configurar rotina
 * semanal" (Etapa 19) — a MESMA tela para os dois, distinguidos só pelo
 * parâmetro de rota `mode` ("quick" ou "routine"), que troca o que aparece
 * na seção "Quando" (atalhos de período vs. "repetir toda semana"/"repetir
 * até uma data") — dias da semana e períodos são exatamente a mesma seção
 * nos dois casos. Isto evita duplicar a tela inteira para dois fluxos que,
 * no fim, só chamam `SetBulkAvailabilityAsync` com um `effectiveFrom`/
 * `effectiveUntil` calculado de um jeito diferente — ver comentário de
 * `IProfessionalAvailabilityService.SetBulkAvailabilityAsync` no backend,
 * que já documenta os dois fluxos como "a mesma coisa, nome diferente na
 * tela".
 */
export function AddAvailabilityScreen() {
  const { spacing, colors } = useTheme();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isRoutine = mode === 'routine';
  const setBulkAvailability = useSetBulkAvailability();

  const [quickChoice, setQuickChoice] = useState<QuickChoice>('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const [routineChoice, setRoutineChoice] = useState<RoutineChoice>('forever');
  const [routineUntil, setRoutineUntil] = useState('');

  const [selectedDays, setSelectedDays] = useState<Set<DayOfWeek>>(new Set());
  const [selectedPeriods, setSelectedPeriods] = useState<Set<PeriodKey>>(new Set());
  const [useCustomPeriod, setUseCustomPeriod] = useState(false);
  const [customStartTime, setCustomStartTime] = useState('');
  const [customEndTime, setCustomEndTime] = useState('');

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  function toggleDay(day: DayOfWeek) {
    setSelectedDays((current) => {
      const next = new Set(current);
      if (next.has(day)) {
        next.delete(day);
      } else {
        next.add(day);
      }
      return next;
    });
  }

  function applyDayShortcut(days: DayOfWeek[]) {
    setSelectedDays(new Set(days));
  }

  function togglePeriod(key: PeriodKey) {
    setSelectedPeriods((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  const allStandardPeriodsSelected = STANDARD_PERIODS.every((period) => selectedPeriods.has(period.key));

  function toggleSelectAllPeriods() {
    setSelectedPeriods(allStandardPeriodsSelected ? new Set() : new Set(STANDARD_PERIODS.map((period) => period.key)));
  }

  const onSubmit = async () => {
    setSubmitError(null);
    setValidationError(null);

    const daysOfWeek = DAY_OF_WEEK_ORDER.filter((day) => selectedDays.has(day));
    if (daysOfWeek.length === 0) {
      setValidationError('Selecione ao menos um dia da semana.');
      return;
    }

    const periods: AvailabilityPeriodInput[] = STANDARD_PERIODS.filter((period) => selectedPeriods.has(period.key)).map(
      (period) => ({ startTime: toApiTime(period.startTime), endTime: toApiTime(period.endTime) }),
    );

    if (useCustomPeriod) {
      if (!TIME_PATTERN.test(customStartTime) || !TIME_PATTERN.test(customEndTime)) {
        setValidationError('Informe início e término do horário personalizado (HH:MM).');
        return;
      }
      if (customStartTime >= customEndTime) {
        setValidationError('O horário de início precisa ser antes do término.');
        return;
      }
      periods.push({ startTime: toApiTime(customStartTime), endTime: toApiTime(customEndTime) });
    }

    if (periods.length === 0) {
      setValidationError('Selecione ao menos um período.');
      return;
    }

    let effectiveFrom: string | null = null;
    let effectiveUntil: string | null = null;

    if (isRoutine) {
      if (routineChoice === 'untilDate') {
        if (!DATE_INPUT_PATTERN.test(routineUntil)) {
          setValidationError('Informe até quando repetir (DD/MM/AAAA).');
          return;
        }
        effectiveUntil = parseDateInput(routineUntil);
      }
    } else if (quickChoice === 'custom') {
      if (!DATE_INPUT_PATTERN.test(customFrom) || !DATE_INPUT_PATTERN.test(customTo)) {
        setValidationError('Informe o período personalizado (DD/MM/AAAA).');
        return;
      }
      effectiveFrom = parseDateInput(customFrom);
      effectiveUntil = parseDateInput(customTo);
    } else {
      const range = resolveQuickDateRange(quickChoice);
      effectiveFrom = range.from;
      effectiveUntil = range.to;
    }

    try {
      await setBulkAvailability.mutateAsync({ daysOfWeek, periods, effectiveFrom, effectiveUntil });
      router.back();
    } catch (error) {
      setSubmitError(getApiErrorMessage(error, 'Não foi possível salvar a disponibilidade.'));
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ gap: spacing.lg }} keyboardShouldPersistTaps="handled">
          <View>
            <AppText variant="title">{isRoutine ? 'Configurar rotina semanal' : 'Adicionar disponibilidade'}</AppText>
            <AppText variant="subtitle" color="secondary" style={{ marginTop: spacing.xxs }}>
              {isRoutine
                ? 'Escolha os dias e horários em que você atende toda semana'
                : 'Escolha quando, quais dias e quais horários você quer liberar'}
            </AppText>
          </View>

          <View style={{ gap: spacing.xs }}>
            <AppText variant="subtitle">Quando</AppText>
            {isRoutine ? (
              <View style={{ gap: spacing.sm }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xxs }}>
                  <AppButton
                    label="Repetir toda semana"
                    variant={routineChoice === 'forever' ? 'primary' : 'secondary'}
                    onPress={() => setRoutineChoice('forever')}
                  />
                  <AppButton
                    label="Repetir até uma data"
                    variant={routineChoice === 'untilDate' ? 'primary' : 'secondary'}
                    onPress={() => setRoutineChoice('untilDate')}
                  />
                </View>
                {routineChoice === 'untilDate' ? (
                  <AppTextInput
                    label="Repetir até (DD/MM/AAAA)"
                    value={routineUntil}
                    onChangeText={(text) => setRoutineUntil(formatDateInput(text))}
                    placeholder="31/12/2026"
                    keyboardType="number-pad"
                  />
                ) : null}
              </View>
            ) : (
              <View style={{ gap: spacing.sm }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xxs }}>
                  {QUICK_DATE_RANGE_OPTIONS.map((option) => (
                    <AppButton
                      key={option.key}
                      label={option.label}
                      variant={quickChoice === option.key ? 'primary' : 'secondary'}
                      onPress={() => setQuickChoice(option.key)}
                    />
                  ))}
                  <AppButton
                    label="Personalizado"
                    variant={quickChoice === 'custom' ? 'primary' : 'secondary'}
                    onPress={() => setQuickChoice('custom')}
                  />
                </View>
                {quickChoice === 'custom' ? (
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <View style={{ flex: 1 }}>
                      <AppTextInput
                        label="De (DD/MM/AAAA)"
                        value={customFrom}
                        onChangeText={(text) => setCustomFrom(formatDateInput(text))}
                        placeholder="01/09/2026"
                        keyboardType="number-pad"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <AppTextInput
                        label="Até (DD/MM/AAAA)"
                        value={customTo}
                        onChangeText={(text) => setCustomTo(formatDateInput(text))}
                        placeholder="30/09/2026"
                        keyboardType="number-pad"
                      />
                    </View>
                  </View>
                ) : null}
              </View>
            )}
          </View>

          <View style={{ gap: spacing.xs }}>
            <AppText variant="subtitle">Dias da semana</AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xxs }}>
              {WEEKDAY_SHORTCUTS.map((shortcut) => (
                <AppButton key={shortcut.key} label={shortcut.label} variant="secondary" onPress={() => applyDayShortcut(shortcut.days)} />
              ))}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xxs }}>
              {DAY_OF_WEEK_ORDER.map((day) => (
                <AppButton
                  key={day}
                  label={DAY_OF_WEEK_LABEL[day]}
                  variant={selectedDays.has(day) ? 'primary' : 'secondary'}
                  onPress={() => toggleDay(day)}
                />
              ))}
            </View>
          </View>

          <View style={{ gap: spacing.xs }}>
            <AppText variant="subtitle">Períodos</AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xxs }}>
              <AppButton
                label="Selecionar todos"
                variant={allStandardPeriodsSelected ? 'primary' : 'secondary'}
                onPress={toggleSelectAllPeriods}
              />
              {STANDARD_PERIODS.map((period) => (
                <AppButton
                  key={period.key}
                  label={`${period.label} (${period.startTime}–${period.endTime})`}
                  variant={selectedPeriods.has(period.key) ? 'primary' : 'secondary'}
                  onPress={() => togglePeriod(period.key)}
                />
              ))}
              <AppButton
                label="Horário personalizado"
                variant={useCustomPeriod ? 'primary' : 'secondary'}
                onPress={() => setUseCustomPeriod((current) => !current)}
              />
            </View>
            {useCustomPeriod ? (
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <AppTextInput
                    label="Início (HH:MM)"
                    value={customStartTime}
                    onChangeText={setCustomStartTime}
                    placeholder="14:00"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <AppTextInput label="Término (HH:MM)" value={customEndTime} onChangeText={setCustomEndTime} placeholder="16:00" />
                </View>
              </View>
            ) : null}
          </View>

          {validationError ? <AppText style={{ color: colors.semantic.error }}>{validationError}</AppText> : null}
          {submitError ? <AppText style={{ color: colors.semantic.error }}>{submitError}</AppText> : null}

          <AppButton
            label={setBulkAvailability.isPending ? 'Salvando…' : 'Salvar'}
            onPress={onSubmit}
            disabled={setBulkAvailability.isPending}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
