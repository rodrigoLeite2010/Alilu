import { zodResolver } from '@hookform/resolvers/zod';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, View } from 'react-native';

import { AppButton, AppText, AppTextInput, Screen } from '../../../components';
import { useTheme } from '../../../theme';
import { getApiErrorMessage } from '../../../utils/apiError';
import { useAuth } from '../AuthProvider';
import { loginSchema, type LoginFormValues } from '../schemas';

export function LoginScreen() {
  const { colors, spacing } = useTheme();
  const { login } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await login(values);
      router.replace('/');
    } catch (error) {
      setSubmitError(getApiErrorMessage(error, 'Não foi possível entrar. Verifique suas credenciais.'));
    }
  });

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'center' }}
      >
        <View style={{ gap: spacing.md }}>
          <View style={{ marginBottom: spacing.md }}>
            <AppText variant="display">ALILU</AppText>
            <AppText variant="subtitle" color="secondary" style={{ marginTop: spacing.xxs }}>
              Entre na sua conta
            </AppText>
          </View>

          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <AppTextInput
                label="E-mail"
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                errorMessage={errors.email?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <AppTextInput
                label="Senha"
                autoCapitalize="none"
                secureTextEntry
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                errorMessage={errors.password?.message}
              />
            )}
          />

          {submitError ? <AppText style={{ color: colors.semantic.error }}>{submitError}</AppText> : null}

          <AppButton
            label={isSubmitting ? 'Entrando…' : 'Entrar'}
            onPress={onSubmit}
            disabled={isSubmitting}
          />

          <View style={{ alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm }}>
            <Link href="/(auth)/forgot-password">
              <AppText color="secondary">Esqueci minha senha</AppText>
            </Link>
            <Link href="/(auth)/register">
              <AppText color="secondary">Não tem conta? Cadastre-se</AppText>
            </Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
