import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Linking, View } from 'react-native';

import { Avatar, AppButton, AppText, Card, Screen } from '../../../components';
import { useTheme } from '../../../theme';
import { starsForRating } from '../../../utils';
import { useProfessionalProfile } from '../hooks';

/**
 * React Native: ProfessionalProfileScreen (PROMPT 06) — "visualizar
 * perfil". Desde o PROMPT 08, também dá acesso a "Agendar" (início do
 * fluxo de agendamento, módulo Scheduling). Desde o PROMPT 10, também dá
 * acesso a "Recomendar" (RecommendProfessionalScreen, com o profissional
 * já definido — módulo Recommendations) e "Ver recomendações"
 * (ProfessionalRecommendationsScreen — "Recomendado por N moradores").
 *
 * Modernizado na Etapa 20: cabeçalho com `Avatar` grande + nome/categorias
 * dentro de um `Card`, no lugar de texto solto no topo da tela.
 *
 * Etapa 23 (pedido de Rodrigo: "avaliar qualquer profissional buscando
 * pelo nome, sem precisar ter contratado antes") — "Avaliar" agora aparece
 * SEMPRE aqui, pra qualquer profissional ativo do diretório, sem depender
 * de um agendamento Completed (ver `professionals/[id]/review.tsx` e
 * `ReviewScreen`). O fluxo original (avaliar a partir de um agendamento
 * concluído, em `bookings/[id]/review.tsx`) continua existindo do mesmo
 * jeito — os dois convivem.
 */
export function ProfessionalProfileScreen() {
  const { spacing, colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: professional, isLoading, isError, refetch } = useProfessionalProfile(id);

  return (
    <Screen>
      <View style={{ flex: 1, gap: spacing.md }}>
        {isLoading ? (
          <ActivityIndicator color={colors.brand.primary} style={{ marginTop: spacing.md }} />
        ) : isError || !professional ? (
          <View style={{ gap: spacing.xs }}>
            <AppText style={{ color: colors.semantic.error }}>Não foi possível carregar este perfil.</AppText>
            <AppButton label="Tentar de novo" variant="secondary" onPress={() => refetch()} />
          </View>
        ) : (
          <>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Avatar photoUrl={professional.photoUrl} name={professional.displayName} size={72} />
              <View style={{ flex: 1, gap: spacing.xxs }}>
                <AppText variant="title">{professional.displayName}</AppText>
                {professional.categories.length > 0 ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xxs }}>
                    {professional.categories.map((category) => (
                      <AppText key={category.id} variant="caption" color="secondary">
                        {category.name}
                      </AppText>
                    ))}
                  </View>
                ) : null}
                {/* Etapa 22 — mesma nota média já usada em ProfessionalListScreen/ProfessionalRecommendationsScreen, agora também aqui. */}
                {professional.totalReviews > 0 ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xxs }}>
                    <AppText style={{ color: colors.brand.accent }}>{starsForRating(professional.averageRating)}</AppText>
                    <AppText variant="caption" color="secondary">
                      {`${professional.averageRating.toFixed(1)} de 5 · ${professional.totalReviews} ${professional.totalReviews === 1 ? 'avaliação' : 'avaliações'}`}
                    </AppText>
                  </View>
                ) : (
                  <AppText variant="caption" color="muted">
                    Ainda sem avaliações
                  </AppText>
                )}
              </View>
            </Card>

            {professional.description ? (
              <AppText variant="body" color="secondary">
                {professional.description}
              </AppText>
            ) : null}

            {professional.phone ? (
              <AppButton label={`Ligar: ${professional.phone}`} variant="secondary" onPress={() => Linking.openURL(`tel:${professional.phone}`)} />
            ) : null}

            <AppButton
              label="Agendar"
              onPress={() => router.push({ pathname: '/(resident)/booking/[professionalId]', params: { professionalId: professional.id } })}
            />
            <AppButton
              label="Avaliar"
              variant="secondary"
              onPress={() => router.push({ pathname: '/(resident)/professionals/[id]/review', params: { id: professional.id } })}
            />
            <AppButton
              label="Ver recomendações"
              variant="secondary"
              onPress={() => router.push({ pathname: '/(resident)/professionals/[id]/recommendations', params: { id: professional.id } })}
            />
            <AppButton
              label="Recomendar"
              variant="secondary"
              onPress={() => router.push({ pathname: '/(resident)/professionals/[id]/recommend', params: { id: professional.id } })}
            />
          </>
        )}

        <AppButton label="Voltar" variant="ghost" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}
