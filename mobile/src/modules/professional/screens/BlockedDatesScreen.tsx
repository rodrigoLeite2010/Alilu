import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

import { AppButton, AppText, AppTextInput, Screen } from '../../../components';
import { useTheme } from '../../../theme';
import { getApiErrorMessage } from '../../../utils/apiError';
import { toApiTime } from '../availabilityFormat';
import { useAddAvailabilityException, useMyAvailability, useRemoveAvailabilityException } from '../hooks';
import { availabilityExceptionSchema, type AvailabilityExceptionFormValues } from '../schemas';

const TYPE_LABEL: Record<string, string> = {
  Blocked: 'Bloqueado',
  Available: 'Liberado',
};

const EMPTY_FORM: AvailabilityExceptionFormValues = {
  date: '',
  type: 'Blocked',
  isFullDay: true,
  startTime: '',
  endTime: '',
  reason: '',
};

/**
 * React Native: BlockedDatesScreen (PROMPT 07) — "bloquear datas; liberar
 * horários específicos". `isFullDay` decide entre bloquear/liberar o dia
 * inteiro (Api recebe `startTime`/`endTime` nulos) ou só uma janela
 * específica dentro do dia.
 */
export function BlockedDatesScreen() {
  const { spacing, colors } = useTheme();
  const { data: overview, isLoading, isError, refetch } = useMyAvailability();
  const addException = useAddAvailabilityException();
  const removeException = useRemoveAvailabilityException();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AvailabilityExceptionFormValues>({
    resolver: zodResolver(availabilityExceptionSchema),
    defaultValues: EMPTY_FORM,
  });

  // `useWatch` em vez de `watch()` — o React Compiler deste projeto não
  // consegue memoizar com segurança o `watch()` retornado por `useForm`
  // (ver aviso do eslint-plugin-react-hooks); `useWatch` é a forma
  // recomendada pelo react-hook-form para assinar um único campo.
  const isFullDay = useWatch({ control, name: 'isFullDay' });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await addException.mutateAsync({
        date: values.date,
        type: values.type,
        startTime: values.isFullDay || !values.startTime ? null : toApiTime(values.startTime),
        endTime: values.isFullDay || !values.endTime ? null : toApiTime(values.endTime),
        reason: values.reason || undefined,
      });
      reset(EMPTY_FORM);
    } catch (error) {
      setSubmitError(getApiErrorMessage(error, 'Não foi possível salvar a exceção.'));
    }
  });

  const exceptions = [...(overview?.exceptions ?? [])].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ gap: spacing.lg }} keyboardShouldPersistTaps="handled">
          <View>
            <AppText variant="title">Datas bloqueadas</AppText>
            <AppText variant="subtitle" color="secondary" style={{ marginTop: spacing.xxs }}>
              Bloqueie um dia (ex.: folga, feriado) ou libere um horário fora da sua agenda normal
            </AppText>
          </View>

          <View style={{ gap: spacing.sm }}>
            <Controller
              control={control}
              name="date"
              render={({ field: { onChange, onBlur, value } }) => (
                <AppTextInput
                  label="Data (AAAA-MM-DD)"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="2026-12-25"
                  errorMessage={errors.date?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="type"
              render={({ field: { onChange, value } }) => (
                <View style={{ gap: spacing.xxs }}>
                  <AppText variant="caption" color="secondary">
                    Tipo
                  </AppText>
                  <View style={{ flexDirection: 'row', gap: spacing.xxs }}>
                    <AppButton
                      label="Bloquear"
                      variant={value === 'Blocked' ? 'primary' : 'secondary'}
                      onPress={() => onChange('Blocked')}
                    />
                    <AppButton
                      label="Liberar"
                      variant={value === 'Available' ? 'primary' : 'secondary'}
                      onPress={() => onChange('Available')}
                    />
                  </View>
                </View>
              )}
            />

            <Controller
              control={control}
              name="isFullDay"
              render={({ field: { onChange, value } }) => (
                <View style={{ gap: spacing.xxs }}>
                  <AppText variant="caption" color="secondary">
                    Duração
                  </AppText>
                  <View style={{ flexDirection: 'row', gap: spacing.xxs }}>
                    <AppButton label="Dia inteiro" variant={value ? 'primary' : 'secondary'} onPress={() => onChange(true)} />
                    <AppButton
                      label="Horário específico"
                      variant={!value ? 'primary' : 'secondary'}
                      onPress={() => onChange(false)}
                    />
                  </View>
                </View>
              )}
            />

            {!isFullDay ? (
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
                        placeholder="14:00"
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
                        placeholder="16:00"
                        errorMessage={errors.endTime?.message}
                      />
                    )}
                  />
                </View>
              </View>
            ) : null}

            <Controller
              control={control}
              name="reason"
              render={({ field: { onChange, onBlur, value } }) => (
                <AppTextInput
                  label="Motivo (opcional)"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  errorMessage={errors.reason?.message}
                />
              )}
            />

            {submitError ? <AppText style={{ color: colors.semantic.error }}>{submitError}</AppText> : null}

            <AppButton label={isSubmitting ? 'Salvando…' : 'Adicionar'} onPress={onSubmit} disabled={isSubmitting} />
          </View>

          <View style={{ gap: spacing.xs }}>
            <AppText variant="subtitle">Exceções cadastradas</AppText>
            {isLoading ? (
              <ActivityIndicator color={colors.brand.primary} />
            ) : isError ? (
              <View style={{ gap: spacing.xs }}>
                <AppText style={{ color: colors.semantic.error }}>Não foi possível carregar as exceções.</AppText>
                <AppButton label="Tentar de novo" variant="secondary" onPress={() => refetch()} />
              </View>
            ) : exceptions.length === 0 ? (
              <AppText color="muted">Nenhuma exceção cadastrada.</AppText>
            ) : (
              exceptions.map((exception) => (
                <View
                  key={exception.id}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <View style={{ flex: 1, gap: spacing.none }}>
                    <AppText>{`${exception.date} — ${TYPE_LABEL[exception.type] ?? exception.type}`}</AppText>
                    <AppText variant="caption" color="secondary">
                      {exception.startTime && exception.endTime
                        ? `${exception.startTime.slice(0, 5)} - ${exception.endTime.slice(0, 5)}`
                        : 'Dia inteiro'}
                      {exception.reason ? ` · ${exception.reason}` : ''}
                    </AppText>
                  </View>
                  <AppButton
                    label="Remover"
                    variant="ghost"
                    onPress={() => removeException.mutateAsync(exception.id)}
                    disabled={removeException.isPending}
                  />
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
