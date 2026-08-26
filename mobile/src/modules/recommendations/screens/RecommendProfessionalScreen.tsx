import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

import { AppButton, AppText, AppTextInput, Screen } from '../../../components';
import { useTheme } from '../../../theme';
import { getApiErrorMessage } from '../../../utils/apiError';
import { useCreateRecommendation } from '../hooks';
import {
  externalRecommendationFormSchema,
  internalRecommendationFormSchema,
  type ExternalRecommendationFormValues,
  type InternalRecommendationFormValues,
} from '../schemas';
import type { RecommendationServiceCategorySummary } from '../types';

interface RecommendProfessionalScreenProps {
  /**
   * Quando informado (a rota hospedeira `professionals/[id]/recommend.tsx`
   * chegou até aqui a partir de ProfessionalProfileScreen — "Recomendar"),
   * a tela entra no modo "recomendar um profissional do ALILU": o
   * profissional já está definido, só falta categoria e comentário. Sem
   * isso, entra no modo "indicação externa" — mesma composição-na-rota de
   * `ReviewScreen#professionalName`.
   */
  professionalId?: string;
  professionalName?: string;
  /**
   * Categorias oferecidas para escolha — quando `professionalId` está
   * presente, a rota hospedeira passa as categorias que o PRÓPRIO
   * profissional oferece (mesmo diretório já usado por
   * ProfessionalProfileScreen); no modo externo, passa o diretório
   * público completo (`useRecommendationCategories`), já que não há um
   * profissional específico para restringir a lista.
   */
  categories: RecommendationServiceCategorySummary[];
}

/**
 * React Native: RecommendProfessionalScreen (PROMPT 10) — "recomendar
 * profissional". Decisão de escopo (ver ARCHITECTURE.md, "Etapa 10"): o
 * prompt não pediu uma tela de busca/seleção de profissional dedicada —
 * uma recomendação vinculada a um profissional do ALILU só pode ser
 * criada a partir do próprio perfil dele (botão "Recomendar" em
 * ProfessionalProfileScreen); chegando aqui sem esse contexto (a partir de
 * "Nova recomendação" em RecommendationsScreen), a tela assume indicação
 * externa.
 */
export function RecommendProfessionalScreen({ professionalId, professionalName, categories }: RecommendProfessionalScreenProps) {
  const { spacing, colors } = useTheme();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const createRecommendation = useCreateRecommendation();

  return professionalId ? (
    <InternalForm
      professionalId={professionalId}
      professionalName={professionalName}
      categories={categories}
      submitError={submitError}
      setSubmitError={setSubmitError}
      createRecommendation={createRecommendation}
      spacing={spacing}
      colors={colors}
    />
  ) : (
    <ExternalForm
      categories={categories}
      submitError={submitError}
      setSubmitError={setSubmitError}
      createRecommendation={createRecommendation}
      spacing={spacing}
      colors={colors}
    />
  );
}

interface SharedFormProps {
  categories: RecommendationServiceCategorySummary[];
  submitError: string | null;
  setSubmitError: (message: string | null) => void;
  createRecommendation: ReturnType<typeof useCreateRecommendation>;
  spacing: ReturnType<typeof useTheme>['spacing'];
  colors: ReturnType<typeof useTheme>['colors'];
}

function InternalForm({
  professionalId,
  professionalName,
  categories,
  submitError,
  setSubmitError,
  createRecommendation,
  spacing,
  colors,
}: SharedFormProps & { professionalId: string; professionalName?: string }) {
  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<InternalRecommendationFormValues>({
    resolver: zodResolver(internalRecommendationFormSchema),
    defaultValues: { serviceCategoryId: '', comment: '' },
  });

  // `useWatch` em vez de `watch()` — mesmo ajuste (React Compiler) já feito
  // em `ReviewScreen`/`BlockedDatesScreen`/`TimeSelectionScreen`.
  const selectedCategoryId = useWatch({ control, name: 'serviceCategoryId' });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await createRecommendation.mutateAsync({ professionalId, ...values });
      router.back();
    } catch (error) {
      setSubmitError(getApiErrorMessage(error, 'Não foi possível enviar a recomendação.'));
    }
  });

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ gap: spacing.lg }}>
          <View>
            <AppText variant="title">Recomendar profissional</AppText>
            {professionalName ? (
              <AppText variant="subtitle" color="secondary" style={{ marginTop: spacing.xxs }}>
                {professionalName}
              </AppText>
            ) : null}
          </View>

          <CategoryPicker
            categories={categories}
            selectedCategoryId={selectedCategoryId}
            onSelect={(id) => setValue('serviceCategoryId', id, { shouldValidate: true })}
            errorMessage={errors.serviceCategoryId?.message}
            spacing={spacing}
            colors={colors}
          />

          <Controller
            control={control}
            name="comment"
            render={({ field: { onChange, onBlur, value } }) => (
              <AppTextInput
                label="Por que você recomenda esse profissional?"
                multiline
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                errorMessage={errors.comment?.message}
              />
            )}
          />

          {submitError ? <AppText style={{ color: colors.semantic.error }}>{submitError}</AppText> : null}

          <AppButton label={isSubmitting ? 'Enviando…' : 'Enviar recomendação'} onPress={onSubmit} disabled={isSubmitting} />
          <AppButton label="Voltar" variant="ghost" onPress={() => router.back()} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function ExternalForm({ categories, submitError, setSubmitError, createRecommendation, spacing, colors }: SharedFormProps) {
  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ExternalRecommendationFormValues>({
    resolver: zodResolver(externalRecommendationFormSchema),
    defaultValues: { externalProfessionalName: '', externalPhone: undefined, serviceCategoryId: '', comment: '' },
  });

  // `useWatch` em vez de `watch()` — mesmo ajuste (React Compiler) já feito
  // em `ReviewScreen`/`BlockedDatesScreen`/`TimeSelectionScreen`.
  const selectedCategoryId = useWatch({ control, name: 'serviceCategoryId' });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await createRecommendation.mutateAsync(values);
      router.back();
    } catch (error) {
      setSubmitError(getApiErrorMessage(error, 'Não foi possível enviar a recomendação.'));
    }
  });

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ gap: spacing.lg }}>
          <View>
            <AppText variant="title">Recomendar profissional</AppText>
            <AppText variant="subtitle" color="secondary" style={{ marginTop: spacing.xxs }}>
              Indicação de um profissional que ainda não está no ALILU
            </AppText>
          </View>

          <Controller
            control={control}
            name="externalProfessionalName"
            render={({ field: { onChange, onBlur, value } }) => (
              <AppTextInput
                label="Nome do profissional"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                errorMessage={errors.externalProfessionalName?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="externalPhone"
            render={({ field: { onChange, onBlur, value } }) => (
              <AppTextInput
                label="Telefone (opcional)"
                keyboardType="phone-pad"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                errorMessage={errors.externalPhone?.message}
              />
            )}
          />

          <CategoryPicker
            categories={categories}
            selectedCategoryId={selectedCategoryId}
            onSelect={(id) => setValue('serviceCategoryId', id, { shouldValidate: true })}
            errorMessage={errors.serviceCategoryId?.message}
            spacing={spacing}
            colors={colors}
          />

          <Controller
            control={control}
            name="comment"
            render={({ field: { onChange, onBlur, value } }) => (
              <AppTextInput
                label="Por que você recomenda esse profissional?"
                multiline
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                errorMessage={errors.comment?.message}
              />
            )}
          />

          {submitError ? <AppText style={{ color: colors.semantic.error }}>{submitError}</AppText> : null}

          <AppButton label={isSubmitting ? 'Enviando…' : 'Enviar recomendação'} onPress={onSubmit} disabled={isSubmitting} />
          <AppButton label="Voltar" variant="ghost" onPress={() => router.back()} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

interface CategoryPickerProps {
  categories: RecommendationServiceCategorySummary[];
  selectedCategoryId: string;
  onSelect: (id: string) => void;
  errorMessage?: string;
  spacing: ReturnType<typeof useTheme>['spacing'];
  colors: ReturnType<typeof useTheme>['colors'];
}

/** Lista de categorias tocáveis — mesmo espírito de `ServiceCategoryScreen` (módulo Professional), sem navegação: só marca a selecionada. */
function CategoryPicker({ categories, selectedCategoryId, onSelect, errorMessage, spacing, colors }: CategoryPickerProps) {
  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="caption" color="secondary">
        Categoria do serviço
      </AppText>
      <View style={{ gap: spacing.xxs }}>
        {categories.map((category) => (
          <AppButton
            key={category.id}
            label={category.name}
            variant={category.id === selectedCategoryId ? 'primary' : 'secondary'}
            onPress={() => onSelect(category.id)}
          />
        ))}
      </View>
      {categories.length === 0 ? <AppText color="muted">Nenhuma categoria disponível no momento.</AppText> : null}
      {errorMessage ? (
        <AppText variant="caption" style={{ color: colors.semantic.error }}>
          {errorMessage}
        </AppText>
      ) : null}
    </View>
  );
}
