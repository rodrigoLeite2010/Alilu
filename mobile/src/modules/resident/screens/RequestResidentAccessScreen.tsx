import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';

import { AppButton, AppText, Screen } from '../../../components';
import { useTheme } from '../../../theme';
import { getApiErrorMessage } from '../../../utils/apiError';
import { useCondominiumUnits, useRequestResidentAccess } from '../hooks';
import type { CondominiumUnitSummary } from '../types';

/**
 * FLUXO 2 (PROMPT 05) — depois de escolher o condomínio em
 * ChooseCondominiumScreen, o morador escolhe a própria unidade aqui e
 * confirma a solicitação. Nome/telefone do morador não são pedidos de
 * novo nesta tela — o backend já os tem a partir do cadastro
 * (`Identity.User`, ver `ResidentMembershipsController.RequestAccess`);
 * o vínculo criado por este fluxo nasce Pending, aguardando aprovação de
 * um administrador (ver WaitingApprovalScreen).
 */
export function RequestResidentAccessScreen() {
  const { spacing, colors } = useTheme();
  const { condominiumId } = useLocalSearchParams<{ condominiumId: string }>();
  const { data: units, isLoading, isError, refetch } = useCondominiumUnits(condominiumId);
  const requestAccess = useRequestResidentAccess();
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function onConfirm() {
    if (!condominiumId || !selectedUnitId) {
      return;
    }

    setSubmitError(null);
    try {
      await requestAccess.mutateAsync({ condominiumId, unitId: selectedUnitId });
      // O gate em (resident)/index.tsx já refaz a consulta de vínculos
      // (invalidada pela mutation) e mostra WaitingApproval sozinho.
      router.replace('/(resident)');
    } catch (error) {
      setSubmitError(getApiErrorMessage(error, 'Não foi possível enviar a solicitação.'));
    }
  }

  return (
    <Screen>
      <View style={{ flex: 1, gap: spacing.md }}>
        <View>
          <AppText variant="title">Qual é a sua unidade?</AppText>
          <AppText variant="subtitle" color="secondary" style={{ marginTop: spacing.xxs }}>
            Um administrador vai analisar sua solicitação
          </AppText>
        </View>

        {isLoading ? (
          <ActivityIndicator color={colors.brand.primary} />
        ) : isError ? (
          <View style={{ gap: spacing.xs }}>
            <AppText style={{ color: colors.semantic.error }}>Não foi possível carregar as unidades.</AppText>
            <AppButton label="Tentar de novo" variant="secondary" onPress={() => refetch()} />
          </View>
        ) : (
          <FlatList
            data={units}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ gap: spacing.xs }}
            renderItem={({ item }) => (
              <UnitOption unit={item} selected={item.id === selectedUnitId} onPress={() => setSelectedUnitId(item.id)} />
            )}
            ListEmptyComponent={<AppText color="secondary">Nenhuma unidade disponível neste condomínio.</AppText>}
          />
        )}

        {submitError ? <AppText style={{ color: colors.semantic.error }}>{submitError}</AppText> : null}

        <AppButton
          label={requestAccess.isPending ? 'Enviando…' : 'Solicitar acesso'}
          onPress={onConfirm}
          disabled={!selectedUnitId || requestAccess.isPending}
        />

        <AppButton label="Voltar" variant="ghost" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

function UnitOption({
  unit,
  selected,
  onPress,
}: {
  unit: CondominiumUnitSummary;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <AppButton
      label={unit.code}
      variant={selected ? 'primary' : 'secondary'}
      onPress={onPress}
    />
  );
}
