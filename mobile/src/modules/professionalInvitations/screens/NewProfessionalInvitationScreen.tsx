import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

import { AppButton, AppText, AppTextInput, Screen } from '../../../components';
import { useTheme } from '../../../theme';
import { getApiErrorMessage } from '../../../utils/apiError';
import { useCreateProfessionalInvitation } from '../hooks';
import { professionalInvitationFormSchema, type ProfessionalInvitationFormValues } from '../schemas';

/**
 * React Native: tela "Convidar prestador" — formulário (Etapa 23, pedido
 * 1 de Rodrigo). Sem aprovação de admin nem comentário obrigatório
 * (diferente de RecommendProfessionalScreen, módulo Recommendations) —
 * é só um convite direto.
 */
export function NewProfessionalInvitationScreen() {
  const { spacing, colors } = useTheme();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const createInvitation = useCreateProfessionalInvitation();

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfessionalInvitationFormValues>({
    resolver: zodResolver(professionalInvitationFormSchema),
    defaultValues: { name: '', phone: '', email: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await createInvitation.mutateAsync({
        name: values.name,
        phone: values.phone,
        email: values.email ? values.email : undefined,
      });
      router.back();
    } catch (error) {
      setSubmitError(getApiErrorMessage(error, 'Não foi possível enviar o convite.'));
    }
  });

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ gap: spacing.lg }}>
          <View>
            <AppText variant="title">Convidar prestador</AppText>
            <AppText variant="subtitle" color="secondary" style={{ marginTop: spacing.xxs }}>
              A pessoa recebe uma mensagem convidando para atender seu condomínio pelo ALILU
            </AppText>
          </View>

          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, onBlur, value } }) => (
              <AppTextInput
                label="Nome do prestador"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                errorMessage={errors.name?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="phone"
            render={({ field: { onChange, onBlur, value } }) => (
              <AppTextInput
                label="Telefone (com DDD)"
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
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <AppTextInput
                label="E-mail (opcional)"
                keyboardType="email-address"
                autoCapitalize="none"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                errorMessage={errors.email?.message}
              />
            )}
          />

          {submitError ? <AppText style={{ color: colors.semantic.error }}>{submitError}</AppText> : null}

          <AppButton label={isSubmitting ? 'Enviando…' : 'Enviar convite'} onPress={onSubmit} disabled={isSubmitting} />
          <AppButton label="Voltar" variant="ghost" onPress={() => router.back()} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
