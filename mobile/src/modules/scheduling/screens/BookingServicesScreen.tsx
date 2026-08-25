import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { AppButton, AppText, AppTextInput, Screen } from '../../../components';
import { useTheme } from '../../../theme';
import type { BookingItemInput, BookingServiceCategorySummary } from '../types';

interface BookingServicesScreenProps {
  professionalId: string;
  date: string;
  startTime: string;
  endTime: string;
  /** Categorias oferecidas pelo profissional escolhido — resolvidas pela camada de rotas a partir do diretório público do módulo Professional (mesmo perfil já consultado em ProfessionalBookingScreen). */
  categories: BookingServiceCategorySummary[];
}

interface Selection {
  selected: boolean;
  quantity: string;
  description: string;
}

/**
 * React Native: BookingServicesScreen (PROMPT 08) — "selecionar
 * serviços". O morador só pode escolher entre os serviços que o próprio
 * profissional oferece (`professional.categories`) — a Api ainda assim
 * não revalida a categoria em si (ver comentário de `BookingItem` no
 * backend), então esta tela é a única barreira contra um Id de categoria
 * fora dessa lista. Precisa de ao menos um serviço selecionado
 * ("InvalidBookingItemsException" no backend se a lista vier vazia).
 */
export function BookingServicesScreen({ professionalId, date, startTime, endTime, categories }: BookingServicesScreenProps) {
  const { spacing, colors } = useTheme();
  const [selections, setSelections] = useState<Record<string, Selection>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  function toggle(categoryId: string) {
    setSubmitError(null);
    setSelections((previous) => {
      const current = previous[categoryId];
      return {
        ...previous,
        [categoryId]: current
          ? { ...current, selected: !current.selected }
          : { selected: true, quantity: '1', description: '' },
      };
    });
  }

  function setQuantity(categoryId: string, quantity: string) {
    setSelections((previous) => ({
      ...previous,
      [categoryId]: { ...previous[categoryId], quantity },
    }));
  }

  function setDescription(categoryId: string, description: string) {
    setSelections((previous) => ({
      ...previous,
      [categoryId]: { ...previous[categoryId], description },
    }));
  }

  function onContinue() {
    const chosen = Object.entries(selections).filter(([, selection]) => selection.selected);

    if (chosen.length === 0) {
      setSubmitError('Selecione ao menos um serviço.');
      return;
    }

    const items: BookingItemInput[] = [];
    for (const [categoryId, selection] of chosen) {
      const quantity = Number.parseInt(selection.quantity, 10);
      if (!Number.isInteger(quantity) || quantity < 1) {
        setSubmitError('Informe uma quantidade válida (mínimo 1) para cada serviço selecionado.');
        return;
      }
      items.push({ serviceCategoryId: categoryId, description: selection.description || undefined, quantity });
    }

    router.push({
      pathname: '/(resident)/booking/[professionalId]/confirm',
      params: { professionalId, date, startTime, endTime, items: JSON.stringify(items) },
    });
  }

  return (
    <Screen>
      <View style={{ flex: 1, gap: spacing.md }}>
        <AppText variant="title">Selecione os serviços</AppText>

        <ScrollView contentContainerStyle={{ gap: spacing.sm }}>
          {categories.length === 0 ? (
            <AppText color="muted">Este profissional ainda não cadastrou nenhum serviço.</AppText>
          ) : (
            categories.map((category) => {
              const selection = selections[category.id];
              const isSelected = selection?.selected ?? false;

              return (
                <View
                  key={category.id}
                  style={{ gap: spacing.xxs, padding: spacing.sm, borderRadius: 10, backgroundColor: colors.surfaceAlt }}
                >
                  <AppButton
                    label={category.name}
                    variant={isSelected ? 'primary' : 'secondary'}
                    onPress={() => toggle(category.id)}
                  />

                  {isSelected ? (
                    <View style={{ gap: spacing.xxs }}>
                      <AppTextInput
                        label="Quantidade"
                        keyboardType="number-pad"
                        value={selection.quantity}
                        onChangeText={(value) => setQuantity(category.id, value)}
                      />
                      <AppTextInput
                        label="Observação para este serviço (opcional)"
                        value={selection.description}
                        onChangeText={(value) => setDescription(category.id, value)}
                      />
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
        </ScrollView>

        {submitError ? <AppText style={{ color: colors.semantic.error }}>{submitError}</AppText> : null}

        <View style={{ gap: spacing.sm }}>
          <AppButton label="Continuar" onPress={onContinue} disabled={categories.length === 0} />
          <AppButton label="Voltar" variant="ghost" onPress={() => router.back()} />
        </View>
      </View>
    </Screen>
  );
}
