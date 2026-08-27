import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';

import { Avatar, AppButton, AppText, AppTextInput, Card, Screen } from '../../../components';
import { useTheme } from '../../../theme';
import { starsForRating } from '../../../utils';
import { useProfessionalCategories, useProfessionals, useServiceCategories } from '../hooks';
import type { ProfessionalDirectoryItem } from '../types';

/**
 * React Native: ProfessionalListScreen (PROMPT 06) — "listar
 * profissionais; filtrar categoria". `categoryId` (especialidade, ex.
 * "Piscineiro") é opcional (vem de ServiceCategoryScreen quando o morador
 * filtrou). `professionalCategoryId` (Etapa 23, categoria-pai, ex.
 * "Piscina") é o outro filtro possível — vem de "Ver todos os
 * profissionais" de dentro de uma categoria já escolhida (ver
 * ServiceCategoryScreen); só é considerado quando `categoryId` não vem
 * preenchido (mesma regra da Api, ver `api.ts`). Sem nenhum dos dois —
 * "Ver todos os profissionais" do nível de cima (ProfessionalCategoryScreen)
 * — devolve todo mundo, de propósito.
 *
 * Modernizado na Etapa 20: cada item vira um `Card` com `Avatar` (foto ou
 * iniciais) em vez de um retângulo de fundo plano só com texto.
 */
export function ProfessionalListScreen() {
  const { spacing, colors } = useTheme();
  const { categoryId, professionalCategoryId } = useLocalSearchParams<{ categoryId?: string; professionalCategoryId?: string }>();
  const { data: categories } = useServiceCategories();
  const { data: professionalCategories } = useProfessionalCategories();

  // Etapa 23 (pedido de Rodrigo: "buscar profissional pelo nome, sem
  // precisar entrar em uma categoria") — campo de busca livre, combinável
  // com o filtro de categoria/especialidade já ativo. Debounce simples
  // (400ms) pra não disparar uma consulta a cada tecla digitada.
  const [nameInput, setNameInput] = useState('');
  const [name, setName] = useState('');
  useEffect(() => {
    const timeout = setTimeout(() => setName(nameInput.trim()), 400);
    return () => clearTimeout(timeout);
  }, [nameInput]);

  const { data: professionals, isLoading, isError, refetch } = useProfessionals(categoryId, professionalCategoryId, name || undefined);

  const activeCategory = categoryId
    ? categories?.find((category) => category.id === categoryId)
    : professionalCategoryId
      ? professionalCategories?.find((category) => category.id === professionalCategoryId)
      : undefined;

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

        <AppTextInput
          label="Buscar por nome"
          placeholder="Digite o nome do profissional"
          value={nameInput}
          onChangeText={setNameInput}
          autoCapitalize="words"
        />

        {categoryId || professionalCategoryId ? (
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
              <AppText color="secondary">
                Nenhum profissional encontrado{activeCategory ? ` em ${activeCategory.name}` : ''}
                {name ? ` para "${name}"` : ''}.
              </AppText>
            }
          />
        )}
      </View>
    </Screen>
  );
}

function ProfessionalListItem({ professional, onPress }: { professional: ProfessionalDirectoryItem; onPress: () => void }) {
  const { spacing, colors } = useTheme();

  return (
    <Card onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <Avatar photoUrl={professional.photoUrl} name={professional.displayName} />
      <View style={{ flex: 1, gap: spacing.xxs }}>
        <AppText variant="subtitle">{professional.displayName}</AppText>
        {professional.categories.length > 0 ? (
          <AppText variant="caption" color="secondary">
            {professional.categories.map((category) => category.name).join(', ')}
          </AppText>
        ) : null}
        {/* Etapa 22, a pedido de Rodrigo: "mostrar a média de estrelas recebidas" já na busca. Sem avaliações ainda: nem mostra estrela vazia (evita parecer nota 0 real), só o texto. */}
        {professional.totalReviews > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xxs }}>
            <AppText style={{ color: colors.brand.accent }}>{starsForRating(professional.averageRating)}</AppText>
            <AppText variant="caption" color="secondary">
              {`${professional.averageRating.toFixed(1)} (${professional.totalReviews})`}
            </AppText>
          </View>
        ) : (
          <AppText variant="caption" color="muted">
            Ainda sem avaliações
          </AppText>
        )}
      </View>
    </Card>
  );
}
