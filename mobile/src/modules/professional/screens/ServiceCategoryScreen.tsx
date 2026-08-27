import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, FlatList, View } from 'react-native';

import { AppButton, AppText, Screen } from '../../../components';
import { useTheme } from '../../../theme';
import { useProfessionalCategories, useServiceCategories } from '../hooks';

/**
 * React Native: ServiceCategoryScreen (PROMPT 06) — o morador escolhe uma
 * especialidade para filtrar a busca de profissionais (React Native:
 * "filtrar categoria"). Navega para ProfessionalListScreen já com o
 * filtro aplicado; "Ver todos" pula direto para a lista sem filtro.
 *
 * Desde a Etapa 22, ganhou um nível ACIMA (ProfessionalCategoryScreen, rota
 * `/(resident)/professional-categories`) — esta tela agora vive em
 * `/(resident)/professional-categories/[categoryId]` e só mostra as
 * especialidades daquela categoria escolhida (`categoryId` é a "Categoria",
 * nunca confundir com o `categoryId` de query que `ProfessionalListScreen`
 * recebe — lá é o Id da ESPECIALIDADE, aqui é o Id da categoria-pai).
 *
 * Etapa 23 — BUG REAL encontrado por Rodrigo: "Ver todos os profissionais"
 * navegava para a lista SEM NENHUM FILTRO, então aparecia qualquer
 * profissional ativo (inclusive de outra categoria-pai, ex.: diarista
 * dentro de "Piscina"). Agora esse botão leva o `categoryId` desta tela
 * (a categoria-pai já escolhida) como `professionalCategoryId` — a lista
 * mostra só profissionais com alguma especialidade daquela categoria, em
 * vez de literalmente todo mundo.
 */
export function ServiceCategoryScreen() {
  const { spacing, colors } = useTheme();
  const { categoryId } = useLocalSearchParams<{ categoryId?: string }>();
  const { data: professionalCategories } = useProfessionalCategories();
  const { data: categories, isLoading, isError, refetch } = useServiceCategories(categoryId);

  const activeCategory = professionalCategories?.find((category) => category.id === categoryId);

  return (
    <Screen>
      <View style={{ flex: 1, gap: spacing.md }}>
        <View>
          <AppText variant="title">{activeCategory ? activeCategory.name : 'Especialidades'}</AppText>
          <AppText variant="subtitle" color="secondary" style={{ marginTop: spacing.xxs }}>
            Escolha uma especialidade para encontrar profissionais
          </AppText>
        </View>

        <AppButton
          label="Ver todos os profissionais"
          variant="secondary"
          onPress={() =>
            router.push({ pathname: '/(resident)/professionals', params: categoryId ? { professionalCategoryId: categoryId } : {} })
          }
        />

        {isLoading ? (
          <ActivityIndicator color={colors.brand.primary} style={{ marginTop: spacing.md }} />
        ) : isError ? (
          <View style={{ gap: spacing.xs }}>
            <AppText style={{ color: colors.semantic.error }}>Não foi possível carregar as categorias.</AppText>
            <AppButton label="Tentar de novo" variant="secondary" onPress={() => refetch()} />
          </View>
        ) : (
          <FlatList
            data={categories}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ gap: spacing.xs }}
            renderItem={({ item }) => (
              <AppButton
                label={item.name}
                variant="secondary"
                onPress={() => router.push({ pathname: '/(resident)/professionals', params: { categoryId: item.id } })}
              />
            )}
            ListEmptyComponent={<AppText color="secondary">Nenhuma categoria disponível no momento.</AppText>}
          />
        )}
      </View>
    </Screen>
  );
}
