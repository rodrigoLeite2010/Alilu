import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { ActivityIndicator, View } from 'react-native';

import { AppButton, AppText, AppTextInput, Screen } from '../../../components';
import { useTheme } from '../../../theme';
import { getApiErrorMessage } from '../../../utils/apiError';
import { useAvailabilityCheck } from '../hooks';
import { formatDateDisplay, toApiTime } from '../schedulingFormat';
import { timeSelectionSchema, type TimeSelectionFormValues } from '../schemas';

interface TimeSelectionScreenProps {
  professionalId: string;
  date: string;
}

/**
 * React Native: TimeSelectionScreen (PROMPT 08) — "verificar
 * disponibilidade; escolher horário". "Nunca confiar no calendário do
 * React Native" (REGRA CRÍTICA): esta tela não lista horários livres (o
 * módulo Professional não expõe a agenda publicamente desde a Etapa 07) —
 * o morador digita um horário candidato e pede uma verificação explícita
 * (`GET .../availability-check`); só depois de uma checagem OK para os
 * valores atuais o botão "Continuar" libera. Mudar qualquer um dos campos
 * invalida a checagem anterior (`checkedKey`), porque a resposta só vale
 * para aquela janela exata. A verificação real, que de fato impede um
 * agendamento inválido, é a repetida no servidor em `POST .../bookings`.
 */
export function TimeSelectionScreen({ professionalId, date }: TimeSelectionScreenProps) {
  const { spacing, colors } = useTheme();
  const [checkedKey, setCheckedKey] = useState<string | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<TimeSelectionFormValues>({
    resolver: zodResolver(timeSelectionSchema),
    defaultValues: { startTime: '', endTime: '' },
  });

  const startTime = useWatch({ control, name: 'startTime' });
  const endTime = useWatch({ control, name: 'endTime' });
  const currentKey = `${startTime}-${endTime}`;

  const availabilityCheck = useAvailabilityCheck(
    professionalId,
    date,
    startTime ? toApiTime(startTime) : '',
    endTime ? toApiTime(endTime) : '',
  );

  const onCheck = handleSubmit(async (values) => {
    setCheckError(null);
    try {
      const result = await availabilityCheck.refetch({ throwOnError: true });
      if (result.data) {
        setCheckedKey(`${values.startTime}-${values.endTime}`);
      }
    } catch (error) {
      setCheckError(getApiErrorMessage(error, 'Não foi possível verificar a disponibilidade.'));
    }
  });

  const isChecked = checkedKey === currentKey;
  const isAvailable = isChecked && availabilityCheck.data?.available === true;

  return (
    <Screen>
      <View style={{ flex: 1, gap: spacing.lg }}>
        <View>
          <AppText variant="title">Escolha um horário</AppText>
          <AppText variant="subtitle" color="secondary" style={{ marginTop: spacing.xxs }}>
            {formatDateDisplay(date)}
          </AppText>
        </View>

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
                  placeholder="09:00"
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
                  placeholder="10:00"
                  errorMessage={errors.endTime?.message}
                />
              )}
            />
          </View>
        </View>

        <AppButton
          label={availabilityCheck.isFetching ? 'Verificando…' : 'Verificar disponibilidade'}
          variant="secondary"
          onPress={onCheck}
          disabled={availabilityCheck.isFetching}
        />

        {availabilityCheck.isFetching ? (
          <ActivityIndicator color={colors.brand.primary} />
        ) : checkError ? (
          <AppText style={{ color: colors.semantic.error }}>{checkError}</AppText>
        ) : isChecked ? (
          <AppText style={{ color: isAvailable ? colors.semantic.success : colors.semantic.error }}>
            {isAvailable ? 'Horário disponível.' : 'Horário indisponível — escolha outro horário.'}
          </AppText>
        ) : null}

        <View style={{ gap: spacing.sm, marginTop: 'auto' }}>
          <AppButton
            label="Continuar"
            onPress={() =>
              router.push({
                pathname: '/(resident)/booking/[professionalId]/services',
                params: { professionalId, date, startTime, endTime },
              })
            }
            disabled={!isAvailable}
          />
          <AppButton label="Voltar" variant="ghost" onPress={() => router.back()} />
        </View>
      </View>
    </Screen>
  );
}
