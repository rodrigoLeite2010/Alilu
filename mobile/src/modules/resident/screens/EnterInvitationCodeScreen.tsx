import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, View } from 'react-native';

import { AppButton, AppText, AppTextInput, Screen } from '../../../components';
import { useAuth } from '../../auth';
import { useTheme } from '../../../theme';
import { getApiErrorMessage } from '../../../utils/apiError';
import { useRedeemInvitation } from '../hooks';
import { invitationCodeSchema, type InvitationCodeFormValues } from '../schemas';

/**
 * FLUXO 1 (PROMPT 05) — "Tenho um código de convite". O e-mail enviado
 * junto do código é sempre o do próprio usuário autenticado (checagem
 * "quando aplicável" do backend, ver `InvitationRedemptionService`) —
 * o usuário nunca digita um e-mail aqui.
 */
export function EnterInvitationCodeScreen() {
  const { colors, spacing } = useTheme();
  const { user } = useAuth();
  const redeemInvitation = useRedeemInvitation();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<InvitationCodeFormValues>({
    resolver: zodResolver(invitationCodeSchema),
    defaultValues: { code: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await redeemInvitation.mutateAsync({ code: values.code.trim(), email: user?.email });
      // O gate em (resident)/index.tsx já refaz a consulta de vínculos
      // (invalidada pela mutation) e mostra a área do morador sozinho.
      router.replace('/(resident)');
    } catch (error) {
      setSubmitError(getApiErrorMessage(error, 'Não foi possível validar o convite.'));
    }
  });

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ flex: 1, justifyContent: 'center', gap: spacing.md }}>
          <View style={{ marginBottom: spacing.md }}>
            <AppText variant="title">Código de convite</AppText>
            <AppText variant="subtitle" color="secondary" style={{ marginTop: spacing.xxs }}>
              Digite o código que o síndico ou administrador te enviou
            </AppText>
          </View>

          <Controller
            control={control}
            name="code"
            render={({ field: { onChange, onBlur, value } }) => (
              <AppTextInput
                label="Código do convite"
                autoCapitalize="characters"
                autoCorrect={false}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                errorMessage={errors.code?.message}
              />
            )}
          />

          {submitError ? <AppText style={{ color: colors.semantic.error }}>{submitError}</AppText> : null}

          <AppButton
            label={isSubmitting ? 'Validando…' : 'Validar convite'}
            onPress={onSubmit}
            disabled={isSubmitting}
          />

          <AppButton label="Voltar" variant="ghost" onPress={() => router.back()} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
