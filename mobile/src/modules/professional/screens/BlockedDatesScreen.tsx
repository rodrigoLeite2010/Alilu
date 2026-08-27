import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

import { AppButton, AppText, AppTextInput, Screen } from '../../../components';
import { useTheme } from '../../../theme';
import { getApiErrorMessage } from '../../../utils/apiError';
import { formatDateDisplay, formatDateInput, parseDateInput, STANDARD_PERIODS, toApiTime } from '../availabilityFormat';
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
 * Atalhos de período (pedido explícito depois de testar o fluxo: em vez
 * de digitar início/término à mão toda vez, o profissional escolhe
 * "Manhã"/"Tarde"/"Noite" — ou "Personalizado" quando nenhum dos três
 * serve). Vale tanto para "Bloquear" (ex.: "bloquear só a tarde de
 * folga") quanto para "Liberar" — só o rótulo da pergunta muda.
 */
type QuickPeriod = 'full' | 'morning' | 'afternoon' | 'evening' | 'custom';

const STANDARD_PERIOD_BY_KEY = Object.fromEntries(STANDARD_PERIODS.map((period) => [period.key, period]));

// Etapa 19 — horários alinhados aos períodos padrão do backend
// (`ProfessionalAvailabilityPeriods`/`availabilityFormat.ts#STANDARD_PERIODS`,
// 07-12/12-18/18-22); antes desta etapa esta tela usava 08-12/13-18, só
// aqui, sem nenhuma relação com o backend — ajuste intencional para as duas
// pontas baterem.
const QUICK_PERIOD_OPTIONS: { key: QuickPeriod; label: string; startTime?: string; endTime?: string }[] = [
  { key: 'full', label: 'Dia inteiro' },
  {
    key: 'morning',
    label: `Manhã (${STANDARD_PERIOD_BY_KEY.morning.startTime}–${STANDARD_PERIOD_BY_KEY.morning.endTime})`,
    startTime: STANDARD_PERIOD_BY_KEY.morning.startTime,
    endTime: STANDARD_PERIOD_BY_KEY.morning.endTime,
  },
  {
    key: 'afternoon',
    label: `Tarde (${STANDARD_PERIOD_BY_KEY.afternoon.startTime}–${STANDARD_PERIOD_BY_KEY.afternoon.endTime})`,
    startTime: STANDARD_PERIOD_BY_KEY.afternoon.startTime,
    endTime: STANDARD_PERIOD_BY_KEY.afternoon.endTime,
  },
  {
    key: 'evening',
    label: `Noite (${STANDARD_PERIOD_BY_KEY.evening.startTime}–${STANDARD_PERIOD_BY_KEY.evening.endTime})`,
    startTime: STANDARD_PERIOD_BY_KEY.evening.startTime,
    endTime: STANDARD_PERIOD_BY_KEY.evening.endTime,
  },
  { key: 'custom', label: 'Personalizado' },
];

/**
 * React Native: BlockedDatesScreen (PROMPT 07, atalhos de período e
 * máscara de data adicionados na Etapa 18) — "bloquear datas; liberar
 * horários específicos". `isFullDay`/`startTime`/`endTime` (Api recebe os
 * dois últimos nulos para o dia inteiro) são preenchidos a partir do
 * período escolhido em `QUICK_PERIOD_OPTIONS`, nunca digitados
 * diretamente — exceto em "Personalizado".
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
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<AvailabilityExceptionFormValues>({
    resolver: zodResolver(availabilityExceptionSchema),
    defaultValues: EMPTY_FORM,
  });

  // `useWatch` em vez de `watch()` — o React Compiler deste projeto não
  // consegue memoizar com segurança o `watch()` retornado por `useForm`
  // (ver aviso do eslint-plugin-react-hooks); `useWatch` é a forma
  // recomendada pelo react-hook-form para assinar um único campo.
  const type = useWatch({ control, name: 'type' });
  const [quickPeriod, setQuickPeriod] = useState<QuickPeriod>('full');

  // Trocar de "Bloquear" para "Liberar" (ou vice-versa) começa do zero —
  // evita herdar um horário de um período pensado para o outro tipo. Feito
  // direto no handler do botão (em vez de um `useEffect` assistindo
  // `type`) para não disparar um `setState` síncrono dentro de um efeito.
  function selectType(nextType: 'Blocked' | 'Available', onChange: (value: 'Blocked' | 'Available') => void) {
    onChange(nextType);
    setQuickPeriod('full');
  }

  function selectQuickPeriod(option: (typeof QUICK_PERIOD_OPTIONS)[number]) {
    setQuickPeriod(option.key);
    if (option.key === 'full') {
      setValue('isFullDay', true);
      setValue('startTime', '');
      setValue('endTime', '');
    } else if (option.key === 'custom') {
      setValue('isFullDay', false);
    } else {
      setValue('isFullDay', false);
      setValue('startTime', option.startTime ?? '');
      setValue('endTime', option.endTime ?? '');
    }
  }

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await addException.mutateAsync({
        date: parseDateInput(values.date),
        type: values.type,
        startTime: values.isFullDay || !values.startTime ? null : toApiTime(values.startTime),
        endTime: values.isFullDay || !values.endTime ? null : toApiTime(values.endTime),
        reason: values.reason || undefined,
      });
      reset(EMPTY_FORM);
      setQuickPeriod('full');
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
                  label="Data (DD/MM/AAAA)"
                  value={value}
                  onChangeText={(text) => onChange(formatDateInput(text))}
                  onBlur={onBlur}
                  placeholder="25/12/2026"
                  keyboardType="number-pad"
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
                      onPress={() => selectType('Blocked', onChange)}
                    />
                    <AppButton
                      label="Liberar"
                      variant={value === 'Available' ? 'primary' : 'secondary'}
                      onPress={() => selectType('Available', onChange)}
                    />
                  </View>
                </View>
              )}
            />

            {/* Em vez de digitar início/término à mão, escolhe um período pronto — só cai nos campos manuais em "Personalizado". */}
            <View style={{ gap: spacing.xxs }}>
              <AppText variant="caption" color="secondary">
                {type === 'Available' ? 'Quando você quer liberar?' : 'Quando você quer bloquear?'}
              </AppText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xxs }}>
                {QUICK_PERIOD_OPTIONS.map((option) => (
                  <AppButton
                    key={option.key}
                    label={option.label}
                    variant={quickPeriod === option.key ? 'primary' : 'secondary'}
                    onPress={() => selectQuickPeriod(option)}
                  />
                ))}
              </View>
            </View>

            {quickPeriod === 'custom' ? (
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
                    <AppText>{`${formatDateDisplay(exception.date)} — ${TYPE_LABEL[exception.type] ?? exception.type}`}</AppText>
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
