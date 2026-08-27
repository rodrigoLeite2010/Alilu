import { router } from 'expo-router';
import { ActivityIndicator, FlatList, View } from 'react-native';

import { AppButton, AppText, Badge, Card, Screen } from '../../../components';
import { useTheme } from '../../../theme';
import { useMyMuralFeed } from '../hooks';
import { formatMuralPostDate, MURAL_POST_TYPE_LABEL, MURAL_POST_TYPE_TONE } from '../muralFormat';

/**
 * React Native: MuralScreen (Etapa 23, pedido 3 de Rodrigo) — feed aberto
 * do condomínio: reclamações, sugestões, avisos e comentários sobre
 * prestador não cadastrado, publicados livremente por qualquer morador
 * (sem aprovação prévia). Acessível a partir de "Mural" em
 * ResidentHomeScreen (módulo Resident), mesmo padrão de "Minhas
 * recomendações" (Etapa 10).
 *
 * Um post bloqueado pelo síndico/admin some do feed de todo mundo, EXCETO
 * do próprio autor (ver `IMuralPostRepository.ListForResidentFeedAsync`
 * no backend) — por isso o badge de status só aparece quando o post está
 * `Blocked` (o autor precisa saber que o post dele foi bloqueado; um post
 * `Visible` não precisa de nenhum destaque extra).
 */
export function MuralScreen() {
  const { spacing, colors } = useTheme();
  const { data: posts, isLoading, isError, refetch } = useMyMuralFeed();

  return (
    <Screen>
      <View style={{ flex: 1, gap: spacing.md }}>
        <AppText variant="title">Mural</AppText>
        <AppText variant="subtitle" color="secondary">
          Reclamações, sugestões e avisos dos moradores do seu condomínio
        </AppText>

        <AppButton label="Novo post" onPress={() => router.push('/(resident)/mural/new')} />

        {isLoading ? (
          <ActivityIndicator color={colors.brand.primary} style={{ marginTop: spacing.md }} />
        ) : isError ? (
          <View style={{ gap: spacing.xs }}>
            <AppText style={{ color: colors.semantic.error }}>Não foi possível carregar o mural.</AppText>
            <AppButton label="Tentar de novo" variant="secondary" onPress={() => refetch()} />
          </View>
        ) : (
          <FlatList
            data={posts}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ gap: spacing.sm }}
            renderItem={({ item }) => (
              <Card style={{ gap: spacing.xxs }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Badge label={MURAL_POST_TYPE_LABEL[item.type]} tone={MURAL_POST_TYPE_TONE[item.type]} />
                  {item.status === 'Blocked' ? <Badge label="Bloqueado pelo síndico" tone="error" /> : null}
                </View>
                <AppText variant="body">{item.content}</AppText>
                <AppText variant="caption" color="secondary">
                  {formatMuralPostDate(item.createdAt)}
                </AppText>
              </Card>
            )}
            ListEmptyComponent={<AppText color="muted">Ainda não há nenhum post no mural do seu condomínio.</AppText>}
          />
        )}
      </View>
    </Screen>
  );
}
