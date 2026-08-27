import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

import { AppButton, AppText, AppTextInput, Screen } from '../../../components';
import { useTheme } from '../../../theme';
import { getApiErrorMessage } from '../../../utils/apiError';
import { useCreateMuralPost } from '../hooks';
import { MURAL_POST_TYPE_LABEL } from '../muralFormat';
import { muralPostFormSchema, type MuralPostFormValues } from '../schemas';
import type { MuralPostType } from '../types';

const MURAL_POST_TYPES: MuralPostType[] = ['Complaint', 'Suggestion', 'Warning', 'UnregisteredProfessional'];

/**
 * React Native: tela "Novo post" do Mural (Etapa 23) — publica direto,
 * sem aprovação prévia (moderação é só pós-hoc, ver comentário em
 * `Alilu.Modules.Mural.Domain.MuralPostStatus` no backend).
 */
export function NewMuralPostScreen() {
  const { spacing, colors } = useTheme();
  const [type, setType] = useState<MuralPostType>('Complaint');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const createMuralPost = useCreateMuralPost();

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<MuralPostFormValues>({
    resolver: zodResolver(muralPostFormSchema),
    defaultValues: { content: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await createMuralPost.mutateAsync({ type, ...values });
      router.back();
    } catch (error) {
      setSubmitError(getApiErrorMessage(error, 'Não foi possível publicar o post.'));
    }
  });

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ gap: spacing.lg }}>
          <AppText variant="title">Novo post no Mural</AppText>

          <View style={{ gap: spacing.xs }}>
            <AppText variant="caption" color="secondary">
              Tipo de post
            </AppText>
            <View style={{ gap: spacing.xxs }}>
              {MURAL_POST_TYPES.map((option) => (
                <AppButton
                  key={option}
                  label={MURAL_POST_TYPE_LABEL[option]}
                  variant={option === type ? 'primary' : 'secondary'}
                  onPress={() => setType(option)}
                />
              ))}
            </View>
          </View>

          <Controller
            control={control}
            name="content"
            render={({ field: { onChange, onBlur, value } }) => (
              <AppTextInput
                label="O que você quer publicar?"
                multiline
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                errorMessage={errors.content?.message}
              />
            )}
          />

          {submitError ? <AppText style={{ color: colors.semantic.error }}>{submitError}</AppText> : null}

          <AppButton label={isSubmitting ? 'Publicando…' : 'Publicar'} onPress={onSubmit} disabled={isSubmitting} />
          <AppButton label="Voltar" variant="ghost" onPress={() => router.back()} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
