import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';

import { AppButton, AppText, AppTextInput, Screen } from '../../../components';
import { useTheme } from '../../../theme';
import { getApiErrorMessage } from '../../../utils/apiError';
import { useCreateReview, useEditReview, useMyReviewForBooking, useMyReviewForProfessional } from '../hooks';
import { RATING_STARS } from '../reviewsFormat';
import { reviewFormSchema, type ReviewFormValues } from '../schemas';

interface ReviewScreenProps {
  /** Exatamente um entre `bookingId` e `professionalId` (Etapa 23) — nunca os dois, nunca nenhum. Quem decide qual é a rota hospedeira (`bookings/[id]/review.tsx` ou `professionals/[id]/review.tsx`). */
  bookingId?: string;
  /** Etapa 23 — avaliação LIVRE (sem agendamento, morador buscou o profissional pelo diretório e clicou "Avaliar" direto no perfil). */
  professionalId?: string;
  /** Resolvido pela rota hospedeira, que já tem o diretório de profissionais carregado — mesmo espírito de composição de `BookingDetailsScreen`. Opcional só para não travar a tela caso o diretório ainda não tenha carregado. */
  professionalName?: string;
}

/**
 * React Native: ReviewScreen (PROMPT 09) — "avaliar profissional" e
 * "editar avaliação dentro da regra definida" na mesma tela: se já existe
 * uma avaliação para este agendamento (`useMyReviewForBooking`), o
 * formulário abre preenchido e o envio vira PUT (editar); caso contrário,
 * abre em branco e o envio vira POST (criar) — mesmo padrão de
 * `ProfessionalEditScreen` (cria vs. edita o mesmo formulário).
 *
 * "Não permitir avaliação antes da conclusão" (REGRA do prompt, fluxo
 * original com `bookingId`): esta tela só é alcançável a partir do botão
 * "Avaliar" que `BookingDetailsScreen` mostra apenas quando
 * `booking.status === 'Completed'` (ver o slot `reviewSlot`, injetado pela
 * rota `bookings/[id]/index.tsx`) — e o servidor revalida isso de qualquer
 * forma (`IBookingService.ValidateCompletedBookingForReviewAsync`), então
 * um eventual erro 409 aqui (agendamento não mais elegível) aparece como
 * mensagem de erro comum, sem lógica duplicada nesta tela.
 *
 * Etapa 23 (pedido de Rodrigo: "avaliar qualquer profissional buscando
 * pelo nome") — segundo caminho, com `professionalId` no lugar de
 * `bookingId`: ProfessionalProfileScreen mostra "Avaliar" sempre, sem
 * exigir nenhum agendamento. As duas chamadas de `useMyReviewFor...` abaixo
 * são incondicionais (regra dos hooks do React — não dá pra chamar um hook
 * dentro de um `if`); cada uma só executa de fato quando seu próprio id
 * está presente (`enabled: Boolean(id)`, ver `hooks.ts`), então só uma das
 * duas realmente busca algo.
 */
export function ReviewScreen({ bookingId, professionalId, professionalName }: ReviewScreenProps) {
  const { spacing, colors } = useTheme();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { data: reviewForBooking, isLoading: isLoadingBookingReview } = useMyReviewForBooking(bookingId);
  const { data: reviewForProfessional, isLoading: isLoadingProfessionalReview } = useMyReviewForProfessional(professionalId);
  const existingReview = bookingId ? reviewForBooking : reviewForProfessional;
  const isLoading = bookingId ? isLoadingBookingReview : isLoadingProfessionalReview;
  const createReview = useCreateReview();
  const editReview = useEditReview();

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewFormSchema),
    // `''`, nunca `undefined` — mesmo ajuste feito em
    // `ProfessionalEditScreen` (ver comentário lá): um input controlado
    // (`value` do Controller) começando em `undefined` e só ganhando um
    // valor real depois (aqui, ao carregar `existingReview`) dispara "A
    // component is changing an uncontrolled input to be controlled" no
    // bundler Web do Expo.
    defaultValues: { rating: 5, comment: '' },
  });

  // Se a avaliação já existente chegar depois da primeira renderização,
  // preenche o formulário com os dados reais (mesmo padrão de
  // ProfessionalEditScreen ao receber um `profile` assíncrono).
  useEffect(() => {
    if (existingReview) {
      reset({ rating: existingReview.rating, comment: existingReview.comment ?? '' });
    }
  }, [existingReview, reset]);

  // `useWatch` em vez de `watch()` — o React Compiler deste projeto não
  // consegue memoizar com segurança o valor de retorno de `watch()` (ver
  // aviso do eslint-plugin-react-hooks); `useWatch` é a forma
  // memoization-safe recomendada pelo React Hook Form — mesmo ajuste já
  // feito em `BlockedDatesScreen`/`TimeSelectionScreen`.
  const rating = useWatch({ control, name: 'rating' });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      if (existingReview) {
        await editReview.mutateAsync({ id: existingReview.id, payload: values });
      } else if (bookingId) {
        await createReview.mutateAsync({ bookingId, ...values });
      } else {
        await createReview.mutateAsync({ professionalId, ...values });
      }
      router.back();
    } catch (error) {
      setSubmitError(getApiErrorMessage(error, 'Não foi possível salvar a avaliação.'));
    }
  });

  if (isLoading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.brand.primary} style={{ marginTop: spacing.md }} />
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ flex: 1, gap: spacing.lg }}>
          <View>
            <AppText variant="title">{existingReview ? 'Editar avaliação' : 'Avaliar profissional'}</AppText>
            {professionalName ? (
              <AppText variant="subtitle" color="secondary" style={{ marginTop: spacing.xxs }}>
                {professionalName}
              </AppText>
            ) : null}
          </View>

          <View style={{ gap: spacing.sm }}>
            <View style={{ gap: spacing.xxs }}>
              <AppText variant="caption" color="secondary">
                Nota
              </AppText>
              <Controller
                control={control}
                name="rating"
                render={() => (
                  <View style={{ flexDirection: 'row', gap: spacing.xxs }}>
                    {RATING_STARS.map((star) => (
                      <Pressable key={star} onPress={() => setValue('rating', star, { shouldValidate: true })} hitSlop={8}>
                        <AppText style={{ fontSize: 34, color: star <= rating ? colors.brand.accent : colors.text.muted }}>
                          {star <= rating ? '★' : '☆'}
                        </AppText>
                      </Pressable>
                    ))}
                  </View>
                )}
              />
              {errors.rating ? (
                <AppText variant="caption" style={{ color: colors.semantic.error }}>
                  {errors.rating.message}
                </AppText>
              ) : null}
            </View>

            <Controller
              control={control}
              name="comment"
              render={({ field: { onChange, onBlur, value } }) => (
                <AppTextInput
                  label="Comentário (opcional)"
                  multiline
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  errorMessage={errors.comment?.message}
                />
              )}
            />

            {submitError ? <AppText style={{ color: colors.semantic.error }}>{submitError}</AppText> : null}

            <AppButton
              label={isSubmitting ? 'Salvando…' : existingReview ? 'Salvar alterações' : 'Enviar avaliação'}
              onPress={onSubmit}
              disabled={isSubmitting}
            />
            <AppButton label="Voltar" variant="ghost" onPress={() => router.back()} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
