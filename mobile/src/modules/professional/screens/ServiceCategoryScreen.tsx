import { router } from 'expo-router';
import { ActivityIndicator, FlatList, View } from 'react-native';

import { AppButton, AppText, Screen } from '../../../components';
import { useTheme } from '../../../theme';
import { useServiceCategories } from '../hooks';

/**
 * React Native: ServiceCategoryScreen (PROMPT 06) — o morador escolhe uma
 * categoria para filtrar a busca de profissionais (React Native:
 * "filtrar categoria"). Navega para ProfessionalListScreen já com o
 * filtro aplicado; "Ver todos" pula direto para a lista sem filtro.
 */
export function ServiceCategoryScreen() {
  const { spacing, colors } = useTheme();
  const { data: categories, isLoading, isError, refetch } = useServiceCategories();

  return (
    <Screen>
      <View style={{ flex: 1, gap: spacing.md }}>
        <View>
          <AppText variant="title">Categorias de serviço</AppText>
          <AppText variant="subtitle" color="secondary" style={{ marginTop: spacing.xxs }}>
            Escolha uma categoria para encontrar profissionais
          </AppText>
        </View>

        <AppButton
          label="Ver todos os profissionais"
          variant="secondary"
          onPress={() => router.push('/(resident)/professionals')}
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
