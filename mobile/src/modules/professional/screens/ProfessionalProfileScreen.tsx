import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Linking, View } from 'react-native';

import { AppButton, AppText, Screen } from '../../../components';
import { useTheme } from '../../../theme';
import { useProfessionalProfile } from '../hooks';

/** React Native: ProfessionalProfileScreen (PROMPT 06) — "visualizar perfil". */
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

            {professional.description ? (
              <AppText variant="body" color="secondary">
                {professional.description}
              </AppText>
            ) : null}

            {professional.phone ? (
              <AppButton label={`Ligar: ${professional.phone}`} variant="secondary" onPress={() => Linking.openURL(`tel:${professional.phone}`)} />
            ) : null}
          </>
        )}

        <AppButton label="Voltar" variant="ghost" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}
