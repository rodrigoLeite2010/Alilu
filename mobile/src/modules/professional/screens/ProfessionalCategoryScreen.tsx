import { router } from 'expo-router';
import { ActivityIndicator, FlatList, View } from 'react-native';

import { AppButton, AppText, Screen } from '../../../components';
import { useTheme } from '../../../theme';
import { useProfessionalCategories } from '../hooks';

/**
 * React Native: ProfessionalCategoryScreen (Etapa 22, pedido de Rodrigo:
 * "cadastrar mais categorias em profissionais") — o nível de CIMA da
 * navegação "Categoria → Especialidade → Lista de profissionais". O
 * morador escolhe uma categoria (ex.: "Reparos e Manutenção") aqui, depois
 * uma especialidade (ex.: "Eletricista") em ServiceCategoryScreen, que
 * finalmente filtra ProfessionalListScreen — mesmo fluxo de três telas do
 * pedido original ("Limpeza ↓ Diarista ↓ Lista de profissionais").
 *
 * Substituiu ServiceCategoryScreen como destino de "Buscar profissional"
 * em ResidentHomeScreen (rota `/(resident)/professional-categories`) —
 * ServiceCategoryScreen passou para `/(resident)/professional-categories/[categoryId]`.
 */
export function ProfessionalCategoryScreen() {
  const { spacing, colors } = useTheme();
  const { data: categories, isLoading, isError, refetch } = useProfessionalCategories();

  return (
    <Screen>
      <View style={{ flex: 1, gap: spacing.md }}>
        <View>
          <AppText variant="title">Categorias</AppText>
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
                onPress={() =>
                  router.push({ pathname: '/(resident)/professional-categories/[categoryId]', params: { categoryId: item.id } })
                }
              />
            )}
            ListEmptyComponent={<AppText color="secondary">Nenhuma categoria disponível no momento.</AppText>}
          />
        )}
      </View>
    </Screen>
  );
}
