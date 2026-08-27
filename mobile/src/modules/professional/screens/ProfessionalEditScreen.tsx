import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

import { AppButton, AppText, AppTextInput, Badge, Screen } from '../../../components';
import { EditableAvatar, useAuth } from '../../auth';
import { useTheme } from '../../../theme';
import { getApiErrorMessage } from '../../../utils/apiError';
import { formatPhoneNumber } from '../../../utils/phone';
import {
  useAddProfessionalService,
  useCondominiumsForRequest,
  useCreateProfessionalProfile,
  useMyProfessionalCondominiums,
  useMyProfessionalServices,
  useProfessionalCategories,
  useRemoveProfessionalService,
  useRequestProfessionalCondominium,
  useServiceCategories,
  useUpdateProfessionalProfile,
} from '../hooks';
import { professionalProfileSchema, type ProfessionalProfileFormValues } from '../schemas';
import type { Professional, ServiceCategory } from '../types';

interface ProfessionalEditScreenProps {
  /** `null` quando o usuário ainda não criou um perfil (React Native: gate de `(professional)/index.tsx`) — o mesmo formulário serve para criar e para editar. */
  profile: Professional | null;
  /**
   * Slot para o NotificationBadge (módulo Notifications, PROMPT 11) —
   * passado pela camada de rotas (`(professional)/index.tsx`), mesmo
   * padrão de composição já usado em `(resident)/bookings/[id]/index.tsx`
   * para o módulo Reviews: este módulo não pode importar Notifications
   * diretamente (independência de módulos), só Auth (fundação
   * compartilhada).
   */
  headerSlot?: () => ReactNode;
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
 * "Configurar disponibilidade" — desde a Etapa 19, este atalho ("Minha
 * Agenda") leva para o novo hub `(professional)/agenda/*`
 * (MyAgendaScreen/AddAvailabilityScreen), que por sua vez tem um link
 * "Avançado" para as telas granulares originais deste PROMPT
 * (AvailabilityScreen/AvailabilityEditor/BlockedDatesScreen/
 * CalendarAvailabilityScreen, sob `(professional)/availability/*`) — nada
 * foi removido, só ganhou uma porta de entrada mais simples na frente.
 *
 * Desde o PROMPT 08 ("o módulo mais crítico"), também vê um atalho para
 * "Solicitações" (ProfessionalRequestsScreen — "receber solicitação →
 * aceitar ou recusar", sob `(professional)/requests/*`).
 *
 * Desde o PROMPT 09, também vê um atalho para "Avaliações"
 * (ProfessionalReviewsScreen — "visualizar avaliações recebidas; visualizar
 * média", sob `(professional)/reviews/*`).
 *
 * Desde o PROMPT 10, também vê um atalho para "Recomendações"
 * (ProfessionalRecommendationsScreen — o mesmo "perfil de recomendações"
 * público que o morador vê a partir de ProfessionalProfileScreen, só que
 * para o próprio profissional, sob `(professional)/recommendations`).
 *
 * Desde o PROMPT 11, também exibe o NotificationBadge (via `headerSlot`,
 * composto pela camada de rotas — ver `(professional)/index.tsx`).
 */
export function ProfessionalEditScreen({ profile, headerSlot }: ProfessionalEditScreenProps) {
  const { spacing, colors } = useTheme();
  const { user } = useAuth();
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
    // `''` (nunca `undefined`) nos três campos — mesmo que
    // `description`/`phone` sejam opcionais no schema Zod, o React exige
    // que um input controlado (`value` vindo do Controller) comece com um
    // valor definido; começar em `undefined` e só ganhar um valor real ao
    // digitar dispara o aviso "A component is changing an uncontrolled
    // input to be controlled" (`AppTextInput`/`TextInput` via
    // react-native-web, visível no `expo start --web`).
    defaultValues: {
      displayName: profile?.displayName ?? '',
      description: profile?.description ?? '',
      phone: profile?.phone ?? '',
    },
  });

  // Se o perfil chegar depois da primeira renderização (ex.: acabou de ser
  // criado), preenche o formulário com os dados reais.
  useEffect(() => {
    if (profile) {
      reset({
        displayName: profile.displayName,
        description: profile.description ?? '',
        phone: profile.phone ?? '',
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
        {/*
          Achado testando no celular (Rodrigo): a tela tinha crescido demais
          (foto/crop da Etapa 21 + agenda/solicitações/avaliações/
          recomendações já empilhadas) sem nenhum jeito de rolar — o
          conteúdo de baixo (Minha Agenda/Solicitações/…) ficava cortado
          fora da tela. Mesmo padrão de RegisterScreen (auth): ScrollView
          com `flexGrow: 1` dentro do KeyboardAvoidingView, para continuar
          empurrando o conteúdo para cima quando o teclado abre (campos de
          texto no topo do formulário) e ainda assim rolar o resto.
        */}
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View style={{ flex: 1, gap: spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
                {user ? <EditableAvatar name={profile?.displayName ?? user.name} size={56} /> : null}
                <View style={{ flex: 1 }}>
                  <AppText variant="title">{profile ? 'Meu perfil profissional' : 'Criar perfil profissional'}</AppText>
                  <AppText variant="subtitle" color="secondary" style={{ marginTop: spacing.xxs }}>
                    {profile
                      ? 'Moradores encontram você a partir destas informações'
                      : 'Preencha seus dados para aparecer na busca dos moradores'}
                  </AppText>
                </View>
              </View>
              {headerSlot?.()}
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
                    onChangeText={(text) => onChange(formatPhoneNumber(text))}
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
                  label="Minha Agenda"
                  variant="secondary"
                  onPress={() => router.push('/(professional)/agenda')}
                />
                <AppButton
                  label="Solicitações"
                  variant="secondary"
                  onPress={() => router.push('/(professional)/requests')}
                />
                <AppButton
                  label="Avaliações"
                  variant="secondary"
                  onPress={() => router.push('/(professional)/reviews')}
                />
                <AppButton
                  label="Recomendações"
                  variant="secondary"
                  onPress={() => router.push('/(professional)/recommendations')}
                />
              </>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

/**
 * "Selecionar serviços" — cada especialidade alterna entre oferecida/não
 * oferecida. Desde a Etapa 22 (pedido de Rodrigo: "cadastrar mais
 * categorias em profissionais"), agrupada por categoria-pai em vez de uma
 * lista plana única — com ~100 especialidades cadastradas, uma lista sem
 * agrupamento ficaria impossível de escanear visualmente. Não existe um
 * "selecionar categoria" separado: escolher qualquer especialidade de uma
 * categoria já é, na prática, "atuar" naquela categoria (mesmo raciocínio
 * de não duplicar o vínculo Profissional↔Categoria quando o vínculo
 * Profissional↔Especialidade já implica isso via `ServiceCategory.categoryId`).
 */
function ServicesSection({ professionalId }: { professionalId: string }) {
  const { spacing } = useTheme();
  const { data: professionalCategories, isLoading: isLoadingCategories } = useProfessionalCategories();
  const { data: specialties, isLoading: isLoadingSpecialties } = useServiceCategories();
  const { data: myServices } = useMyProfessionalServices();
  const addService = useAddProfessionalService();
  const removeService = useRemoveProfessionalService();

  const activeServiceByCategory = new Map(
    (myServices ?? []).filter((service) => service.active).map((service) => [service.serviceCategoryId, service]),
  );

  async function toggle(serviceCategoryId: string) {
    const existing = activeServiceByCategory.get(serviceCategoryId);
    if (existing) {
      await removeService.mutateAsync(existing.id);
    } else {
      await addService.mutateAsync({ serviceCategoryId });
    }
  }

  const specialtiesByCategoryId = new Map<string, ServiceCategory[]>();
  for (const specialty of specialties ?? []) {
    const list = specialtiesByCategoryId.get(specialty.categoryId) ?? [];
    list.push(specialty);
    specialtiesByCategoryId.set(specialty.categoryId, list);
  }

  const isLoading = isLoadingCategories || isLoadingSpecialties;

  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="subtitle">Meus serviços</AppText>
      {isLoading ? (
        <ActivityIndicator />
      ) : (
        (professionalCategories ?? [])
          .filter((category) => (specialtiesByCategoryId.get(category.id) ?? []).length > 0)
          .map((category) => (
            <View key={category.id} style={{ gap: spacing.xxs }}>
              <AppText variant="caption" color="secondary">
                {category.name}
              </AppText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xxs }}>
                {(specialtiesByCategoryId.get(category.id) ?? []).map((specialty) => (
                  <AppButton
                    key={specialty.id}
                    label={specialty.name}
                    variant={activeServiceByCategory.has(specialty.id) ? 'primary' : 'secondary'}
                    onPress={() => toggle(specialty.id)}
                    disabled={addService.isPending || removeService.isPending}
                  />
                ))}
              </View>
            </View>
          ))
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

  // Etapa 20 (modernização visual) — mesmo padrão de tom por status já usado em scheduling/recommendations.
  const statusTone: Record<string, 'success' | 'accent' | 'error' | 'neutral'> = {
    Pending: 'accent',
    Active: 'success',
    Rejected: 'error',
    Inactive: 'neutral',
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
                  <Badge label={statusLabel[link.status] ?? link.status} tone={statusTone[link.status] ?? 'neutral'} />
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
