import { zodResolver } from '@hookform/resolvers/zod';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, View } from 'react-native';

import { AppButton, AppText, AppTextInput, Screen } from '../../../components';
import { useTheme } from '../../../theme';
import { forgotPasswordSchema, type ForgotPasswordFormValues } from '../schemas';

/**
 * PROMPT 03 pede para "preparar recuperação de senha, mas não implementar
 * envio de e-mail ainda" — o backend reflete isso tendo só a porta
 * `IEmailSender` com um adapter no-op (ver
 * `Infrastructure/Email/NoOpEmailSender.cs`), sem nenhum endpoint de
 * "esqueci minha senha" (a lista de endpoints do PROMPT 03 não inclui um).
 *
 * Esta tela existe e valida o e-mail (para não travar quando o backend
 * ganhar o endpoint real, numa etapa futura), mas é honesta sobre o
 * estado atual: não finge enviar um e-mail que não existe.
 */
export function ForgotPasswordScreen() {
  const { spacing } = useTheme();
  const [submitted, setSubmitted] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(async () => {
    setSubmitted(true);
  });

  if (submitted) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm }}>
          <AppText variant="title" style={{ textAlign: 'center' }}>
            Em breve
          </AppText>
          <AppText color="muted" style={{ textAlign: 'center' }}>
            A recuperação de senha por e-mail ainda não está disponível nesta versão do ALILU.
            Assim que estiver, você poderá redefinir sua senha por aqui.
          </AppText>
          <AppButton
            label="Voltar para o login"
            variant="ghost"
            onPress={() => router.replace('/(auth)/login')}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'center' }}
      >
        <View style={{ gap: spacing.md }}>
          <View>
            <AppText variant="title">Esqueci minha senha</AppText>
            <AppText color="secondary" style={{ marginTop: spacing.xxs }}>
              Informe o e-mail cadastrado na sua conta.
            </AppText>
          </View>

          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <AppTextInput
                label="E-mail"
                autoCapitalize="none"
                keyboardType="email-address"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                errorMessage={errors.email?.message}
              />
            )}
          />

          <AppButton
            label={isSubmitting ? 'Enviando…' : 'Continuar'}
            onPress={onSubmit}
            disabled={isSubmitting}
          />

          <Link href="/(auth)/login" style={{ alignSelf: 'center', marginTop: spacing.sm }}>
            <AppText color="secondary">Voltar para o login</AppText>
          </Link>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
