import { router } from 'expo-router';
import { ActivityIndicator, FlatList, View } from 'react-native';

import { AppButton, AppText, Screen } from '../../../components';
import { useTheme } from '../../../theme';
import { useCondominiums } from '../hooks';
import type { CondominiumSummary } from '../types';

/**
 * Ponto de entrada do fluxo de validação do morador (PROMPT 05) — quem
 * chega aqui é um usuário autenticado sem nenhum vínculo ainda (ver o
 * gate em `(resident)/index.tsx`). Duas opções, como no prompt: "Tenho um
 * código de convite" (FLUXO 1) ou escolher o condomínio na lista para
 * solicitar acesso manualmente (FLUXO 2 — "Não encontrei minha unidade",
 * que continua em RequestResidentAccessScreen depois de escolher a
 * unidade).
 */
export function ChooseCondominiumScreen() {
  const { spacing, colors } = useTheme();
  const { data: condominiums, isLoading, isError, refetch } = useCondominiums();

  function goToRequestAccess(condominium: CondominiumSummary) {
    router.push({ pathname: '/(resident)/request-access', params: { condominiumId: condominium.id } });
  }

  return (
    <Screen>
      <View style={{ flex: 1, gap: spacing.md }}>
        <View>
          <AppText variant="title">Encontrar meu condomínio</AppText>
          <AppText variant="subtitle" color="secondary" style={{ marginTop: spacing.xxs }}>
            Para acessar a área do morador, valide seu vínculo com uma unidade
          </AppText>
        </View>

        <AppButton
          label="Tenho um código de convite"
          onPress={() => router.push('/(resident)/enter-invitation-code')}
        />

        <AppText variant="caption" color="muted" style={{ marginTop: spacing.sm }}>
          Não encontrei minha unidade — escolha seu condomínio abaixo para solicitar acesso:
        </AppText>

        {isLoading ? (
          <ActivityIndicator color={colors.brand.primary} style={{ marginTop: spacing.md }} />
        ) : isError ? (
          <View style={{ gap: spacing.xs }}>
            <AppText style={{ color: colors.semantic.error }}>Não foi possível carregar os condomínios.</AppText>
            <AppButton label="Tentar de novo" variant="secondary" onPress={() => refetch()} />
          </View>
        ) : (
          <FlatList
            data={condominiums}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ gap: spacing.xs }}
            renderItem={({ item }) => (
              <AppButton
                label={`${item.name} — ${item.city}/${item.state}`}
                variant="secondary"
                onPress={() => goToRequestAccess(item)}
              />
            )}
            ListEmptyComponent={<AppText color="secondary">Nenhum condomínio disponível no momento.</AppText>}
          />
        )}
      </View>
    </Screen>
  );
}
