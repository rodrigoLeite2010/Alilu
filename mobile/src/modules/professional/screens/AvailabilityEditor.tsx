import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

import { AppButton, AppText, AppTextInput, Screen } from '../../../components';
import { useTheme } from '../../../theme';
import { getApiErrorMessage } from '../../../utils/apiError';
import { DAY_OF_WEEK_LABEL, DAY_OF_WEEK_ORDER, fromApiTime, toApiTime } from '../availabilityFormat';
import { useAddAvailability, useMyAvailability, useUpdateAvailability } from '../hooks';
import { availabilitySlotSchema, type AvailabilitySlotFormValues } from '../schemas';
import type { DayOfWeek } from '../types';

/**
 * React Native: AvailabilityEditor (PROMPT 07) — "configurar dias;
 * configurar horários". Um único formulário serve para criar (sem `id` na
 * rota) e editar (`id` de um intervalo existente) — mesmo espírito de
 * ProfessionalEditScreen (PROMPT 06) reaproveitando um único componente
 * para os dois casos.
 */
export function AvailabilityEditor() {
  const { spacing, colors } = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data: overview } = useMyAvailability();
  const existing = overview?.weeklySchedule.find((slot) => slot.id === id);
  const addAvailability = useAddAvailability();
  const updateAvailability = useUpdateAvailability();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AvailabilitySlotFormValues>({
    resolver: zodResolver(availabilitySlotSchema),
    defaultValues: {
      dayOfWeek: existing?.dayOfWeek ?? 'Monday',
      startTime: existing ? fromApiTime(existing.startTime) : '08:00',
      endTime: existing ? fromApiTime(existing.endTime) : '12:00',
    },
  });

  // Se o intervalo existente chegar depois da primeira renderização (ex.:
  // a agenda ainda estava carregando), preenche o formulário com os dados
  // reais — mesmo padrão de ProfessionalEditScreen.
  useEffect(() => {
    if (existing) {
      reset({
        dayOfWeek: existing.dayOfWeek,
        startTime: fromApiTime(existing.startTime),
        endTime: fromApiTime(existing.endTime),
      });
    }
  }, [existing, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    const payload = {
      dayOfWeek: values.dayOfWeek,
      startTime: toApiTime(values.startTime),
      endTime: toApiTime(values.endTime),
    };

    try {
      if (existing) {
        await updateAvailability.mutateAsync({ id: existing.id, payload });
      } else {
        await addAvailability.mutateAsync(payload);
      }
      router.back();
    } catch (error) {
      setSubmitError(getApiErrorMessage(error, 'Não foi possível salvar o horário.'));
    }
  });

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ gap: spacing.lg }} keyboardShouldPersistTaps="handled">
          <View>
            <AppText variant="title">{existing ? 'Editar horário' : 'Novo horário'}</AppText>
            <AppText variant="subtitle" color="secondary" style={{ marginTop: spacing.xxs }}>
              Escolha o dia da semana e o intervalo de atendimento
            </AppText>
          </View>

          <Controller
            control={control}
            name="dayOfWeek"
            render={({ field: { onChange, value } }) => (
              <View style={{ gap: spacing.xxs }}>
                <AppText variant="subtitle">Dia da semana</AppText>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xxs }}>
                  {DAY_OF_WEEK_ORDER.map((day) => (
                    <AppButton
                      key={day}
                      label={DAY_OF_WEEK_LABEL[day]}
                      variant={value === day ? 'primary' : 'secondary'}
                      onPress={() => onChange(day as DayOfWeek)}
                    />
                  ))}
                </View>
              </View>
            )}
          />

          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Controller
                control={control}
                name="startTime"
                render={({ field: { onChange, onBlur, value } }) => (
                  <AppTextInput
                    label="Início (HH:MM)"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="08:00"
                    errorMessage={errors.startTime?.message}
                  />
                )}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Controller
                control={control}
                name="endTime"
                render={({ field: { onChange, onBlur, value } }) => (
                  <AppTextInput
                    label="Término (HH:MM)"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="12:00"
                    errorMessage={errors.endTime?.message}
                  />
                )}
              />
            </View>
          </View>

          {submitError ? <AppText style={{ color: colors.semantic.error }}>{submitError}</AppText> : null}

          <AppButton label={isSubmitting ? 'Salvando…' : 'Salvar'} onPress={onSubmit} disabled={isSubmitting} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
