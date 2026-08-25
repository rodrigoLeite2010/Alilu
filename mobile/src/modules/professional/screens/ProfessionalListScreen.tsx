import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';

import { AppButton, AppText, Screen } from '../../../components';
import { useTheme } from '../../../theme';
import { useProfessionals, useServiceCategories } from '../hooks';
import type { ProfessionalDirectoryItem } from '../types';

/**
 * React Native: ProfessionalListScreen (PROMPT 06) — "listar
 * profissionais; filtrar categoria". `categoryId` é opcional (vem de
 * ServiceCategoryScreen quando o morador filtrou, ou de "Ver todos").
 */
export function ProfessionalListScreen() {
  const { spacing, colors } = useTheme();
  const { categoryId } = useLocalSearchParams<{ categoryId?: string }>();
  const { data: categories } = useServiceCategories();
  const { data: professionals, isLoading, isError, refetch } = useProfessionals(categoryId);

  const activeCategory = categories?.find((category) => category.id === categoryId);

  function goToProfile(professional: ProfessionalDirectoryItem) {
    router.push({ pathname: '/(resident)/professionals/[id]', params: { id: professional.id } });
  }

  return (
    <Screen>
      <View style={{ flex: 1, gap: spacing.md }}>
        <View>
          <AppText variant="title">Profissionais</AppText>
          <AppText variant="subtitle" color="secondary" style={{ marginTop: spacing.xxs }}>
            {activeCategory ? `Filtrando por ${activeCategory.name}` : 'Todas as categorias'}
          </AppText>
        </View>

        {categoryId ? (
          <AppButton label="Limpar filtro" variant="ghost" onPress={() => router.push('/(resident)/professionals')} />
        ) : null}

        {isLoading ? (
          <ActivityIndicator color={colors.brand.primary} style={{ marginTop: spacing.md }} />
        ) : isError ? (
          <View style={{ gap: spacing.xs }}>
            <AppText style={{ color: colors.semantic.error }}>Não foi possível carregar os profissionais.</AppText>
            <AppButton label="Tentar de novo" variant="secondary" onPress={() => refetch()} />
          </View>
        ) : (
          <FlatList
            data={professionals}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ gap: spacing.xs }}
            renderItem={({ item }) => <ProfessionalListItem professional={item} onPress={() => goToProfile(item)} />}
            ListEmptyComponent={
              <AppText color="secondary">Nenhum profissional encontrado{activeCategory ? ` em ${activeCategory.name}` : ''}.</AppText>
            }
          />
        )}
      </View>
    </Screen>
  );
}

function ProfessionalListItem({ professional, onPress }: { professional: ProfessionalDirectoryItem; onPress: () => void }) {
  const { spacing, colors, radii } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        padding: spacing.sm,
        borderRadius: radii.md,
        backgroundColor: colors.surfaceAlt,
        opacity: pressed ? 0.85 : 1,
        gap: spacing.xxs,
      })}
    >
      <AppText variant="subtitle">{professional.displayName}</AppText>
      {professional.categories.length > 0 ? (
        <AppText variant="caption" color="secondary">
          {professional.categories.map((category) => category.name).join(', ')}
        </AppText>
      ) : null}
    </Pressable>
  );
}
