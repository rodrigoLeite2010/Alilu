import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, KeyboardAvoidingView, Platform, View } from 'react-native';

import { AppButton, AppText, AppTextInput, Screen } from '../../../components';
import { useTheme } from '../../../theme';
import { getApiErrorMessage } from '../../../utils/apiError';
import {
  useAddProfessionalService,
  useCondominiumsForRequest,
  useCreateProfessionalProfile,
  useMyProfessionalCondominiums,
  useMyProfessionalServices,
  useRemoveProfessionalService,
  useRequestProfessionalCondominium,
  useServiceCategories,
  useUpdateProfessionalProfile,
} from '../hooks';
import { professionalProfileSchema, type ProfessionalProfileFormValues } from '../schemas';
import type { Professional } from '../types';

interface ProfessionalEditScreenProps {
  /** `null` quando o usuário ainda não criou um perfil (React Native: gate de `(professional)/index.tsx`) — o mesmo formulário serve para criar e para editar. */
  profile: Professional | null;
}

/**
 * React Native: ProfessionalEditScreen (PROMPT 06) — "editar perfil;
 * selecionar serviços" e, para quem já tem perfil, "solicitar atendimento
 * em condomínios". Sem perfil ainda, só o formulário de criação aparece
 * (as seções de serviços/condomínios/disponibilidade dependem de um
 * `professionalId` já existente — ver `IProfessionalProfileService`, que
 * resolve tudo a partir do usuário autenticado).
 *
 * Desde o PROMPT 07, quem já tem perfil também vê um atalho para
 * "Configurar disponibilidade" (AvailabilityScreen e as demais telas de
 * agenda, sob `(professional)/availability/*`).
 *
 * Desde o PROMPT 08 ("o módulo mais crítico"), também vê um atalho para
 * "Solicitações" (ProfessionalRequestsScreen — "receber solicitação →
 * aceitar ou recusar", sob `(professional)/requests/*`).
 */
export function ProfessionalEditScreen({ profile }: ProfessionalEditScreenProps) {
  const { spacing, colors } = useTheme();
  const createProfile = useCreateProfessionalProfile();
  const updateProfile = useUpdateProfessionalProfile();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProfessionalProfileFormValues>({
    resolver: zodResolver(professionalProfileSchema),
    defaultValues: {
      displayName: profile?.displayName ?? '',
      description: profile?.description ?? undefined,
      phone: profile?.phone ?? undefined,
    },
  });

  // Se o perfil chegar depois da primeira renderização (ex.: acabou de ser
  // criado), preenche o formulário com os dados reais.
  useEffect(() => {
    if (profile) {
      reset({
        displayName: profile.displayName,
        description: profile.description ?? undefined,
        phone: profile.phone ?? undefined,
      });
    }
  }, [profile, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      if (profile) {
        await updateProfile.mutateAsync(values);
      } else {
        await createProfile.mutateAsync(values);
      }
    } catch (error) {
      setSubmitError(getApiErrorMessage(error, 'Não foi possível salvar o perfil.'));
    }
  });

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ flex: 1, gap: spacing.lg }}>
          <View>
            <AppText variant="title">{profile ? 'Meu perfil profissional' : 'Criar perfil profissional'}</AppText>
            <AppText variant="subtitle" color="secondary" style={{ marginTop: spacing.xxs }}>
              {profile
                ? 'Moradores encontram você a partir destas informações'
                : 'Preencha seus dados para aparecer na busca dos moradores'}
            </AppText>
          </View>

          <View style={{ gap: spacing.sm }}>
            <Controller
              control={control}
              name="displayName"
              render={({ field: { onChange, onBlur, value } }) => (
                <AppTextInput
                  label="Nome de exibição"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  errorMessage={errors.displayName?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="phone"
              render={({ field: { onChange, onBlur, value } }) => (
                <AppTextInput
                  label="Telefone"
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
              name="description"
              render={({ field: { onChange, onBlur, value } }) => (
                <AppTextInput
                  label="Descrição"
                  multiline
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  errorMessage={errors.description?.message}
                />
              )}
            />

            {submitError ? <AppText style={{ color: colors.semantic.error }}>{submitError}</AppText> : null}

            <AppButton
              label={isSubmitting ? 'Salvando…' : profile ? 'Salvar alterações' : 'Criar perfil'}
              onPress={onSubmit}
              disabled={isSubmitting}
            />
          </View>

          {profile ? (
            <>
              <ServicesSection professionalId={profile.id} />
              <CondominiumsSection />
              <AppButton
                label="Configurar disponibilidade"
                variant="secondary"
                onPress={() => router.push('/(professional)/availability')}
              />
              <AppButton
                label="Solicitações"
                variant="secondary"
                onPress={() => router.push('/(professional)/requests')}
              />
            </>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

/** "Selecionar serviços" — cada categoria alterna entre oferecida/não oferecida. */
function ServicesSection({ professionalId }: { professionalId: string }) {
  const { spacing } = useTheme();
  const { data: categories, isLoading: isLoadingCategories } = useServiceCategories();
  const { data: myServices } = useMyProfessionalServices();
  const addService = useAddProfessionalService();
  const removeService = useRemoveProfessionalService();

  const activeServiceByCategory = new Map(
    (myServices ?? []).filter((service) => service.active).map((service) => [service.serviceCategoryId, service]),
  );

  async function toggle(categoryId: string) {
    const existing = activeServiceByCategory.get(categoryId);
    if (existing) {
      await removeService.mutateAsync(existing.id);
    } else {
      await addService.mutateAsync({ serviceCategoryId: categoryId });
    }
  }

  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="subtitle">Meus serviços</AppText>
      {isLoadingCategories ? (
        <ActivityIndicator />
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xxs }}>
          {(categories ?? []).map((category) => (
            <AppButton
              key={category.id}
              label={category.name}
              variant={activeServiceByCategory.has(category.id) ? 'primary' : 'secondary'}
              onPress={() => toggle(category.id)}
              disabled={addService.isPending || removeService.isPending}
            />
          ))}
        </View>
      )}
    </View>
  );
}

/** "Solicitar atendimento em condomínios" — cada condomínio mostra o status do vínculo, se houver, ou um botão para solicitar. */
function CondominiumsSection() {
  const { spacing } = useTheme();
  const { data: condominiums, isLoading } = useCondominiumsForRequest();
  const { data: myCondominiums } = useMyProfessionalCondominiums();
  const requestCondominium = useRequestProfessionalCondominium();

  const linkByCondominium = new Map((myCondominiums ?? []).map((link) => [link.condominiumId, link]));

  const statusLabel: Record<string, string> = {
    Pending: 'Solicitação em análise',
    Active: 'Atendendo',
    Rejected: 'Solicitação recusada',
    Inactive: 'Inativo',
  };

  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="subtitle">Atendo estes condomínios</AppText>
      {isLoading ? (
        <ActivityIndicator />
      ) : (
        <View style={{ gap: spacing.xxs }}>
          {(condominiums ?? []).map((condominium) => {
            const link = linkByCondominium.get(condominium.id);
            return (
              <View
                key={condominium.id}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <AppText>{`${condominium.name} — ${condominium.city}/${condominium.state}`}</AppText>
                {link ? (
                  <AppText variant="caption" color="secondary">
                    {statusLabel[link.status] ?? link.status}
                  </AppText>
                ) : (
                  <AppButton
                    label="Solicitar"
                    variant="secondary"
                    onPress={() => requestCondominium.mutateAsync({ condominiumId: condominium.id })}
                    disabled={requestCondominium.isPending}
                  />
                )}
              </View>
            );
          })}
          {(condominiums ?? []).length === 0 ? (
            <AppText color="muted">Nenhum condomínio disponível no momento.</AppText>
          ) : null}
        </View>
      )}
    </View>
  );
}
