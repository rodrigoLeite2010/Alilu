import { zodResolver } from '@hookform/resolvers/zod';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

import { AppButton, AppText, AppTextInput, Screen } from '../../../components';
import { useTheme } from '../../../theme';
import { getApiErrorMessage } from '../../../utils/apiError';
import { useAuth } from '../AuthProvider';
import { registerSchema, type RegisterFormValues } from '../schemas';
import type { SelfRegisterableRole } from '../types';

const ROLE_OPTIONS: { value: SelfRegisterableRole; label: string }[] = [
  { value: 'Resident', label: 'Sou morador' },
  { value: 'Professional', label: 'Sou profissional' },
];

export function RegisterScreen() {
  const { colors, spacing } = useTheme();
  const { register: registerUser } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', phone: '', password: '', confirmPassword: '', role: 'Resident' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await registerUser({
        name: values.name,
        email: values.email,
        phone: values.phone || undefined,
        password: values.password,
        role: values.role,
      });
      router.replace('/');
    } catch (error) {
      setSubmitError(getApiErrorMessage(error, 'Não foi possível concluir o cadastro.'));
    }
  });

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} keyboardShouldPersistTaps="handled">
          <View style={{ gap: spacing.md }}>
            <View style={{ marginBottom: spacing.md }}>
              <AppText variant="title">Criar conta</AppText>
              <AppText variant="subtitle" color="secondary" style={{ marginTop: spacing.xxs }}>
                Leva menos de um minuto
              </AppText>
            </View>

            <Controller
              control={control}
              name="role"
              render={({ field: { onChange, value } }) => (
                <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                  {ROLE_OPTIONS.map((option) => (
                    <View key={option.value} style={{ flex: 1 }}>
                      <AppButton
                        label={option.label}
                        variant={value === option.value ? 'primary' : 'secondary'}
                        onPress={() => onChange(option.value)}
                      />
                    </View>
                  ))}
                </View>
              )}
            />

            <Controller
              control={control}
              name="name"
              render={({ field: { onChange, onBlur, value } }) => (
                <AppTextInput
                  label="Nome completo"
                  autoComplete="name"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  errorMessage={errors.name?.message}
                />
              )}
            />

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
              name="phone"
              render={({ field: { onChange, onBlur, value } }) => (
                <AppTextInput
                  label="Telefone (opcional)"
                  autoComplete="tel"
                  keyboardType="phone-pad"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  errorMessage={errors.phone?.message}
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

            <Controller
              control={control}
              name="confirmPassword"
              render={({ field: { onChange, onBlur, value } }) => (
                <AppTextInput
                  label="Confirmar senha"
                  autoCapitalize="none"
                  secureTextEntry
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  errorMessage={errors.confirmPassword?.message}
                />
              )}
            />

            {submitError ? <AppText style={{ color: colors.semantic.error }}>{submitError}</AppText> : null}

            <AppButton
              label={isSubmitting ? 'Criando conta…' : 'Criar conta'}
              onPress={onSubmit}
              disabled={isSubmitting}
            />

            <Link href="/(auth)/login" style={{ alignSelf: 'center', marginTop: spacing.sm }}>
              <AppText color="secondary">Já tem conta? Entrar</AppText>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
