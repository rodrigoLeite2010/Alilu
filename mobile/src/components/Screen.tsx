import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../theme';

interface ScreenProps extends PropsWithChildren {
  style?: ViewStyle;
  padded?: boolean;
}

/**
 * Container padrão de tela: respeita safe area e aplica o fundo/padding
 * do tema. Toda tela do app deve ser envolvida por este componente.
 */
export function Screen({ children, style, padded = true }: ScreenProps) {
  const { colors, spacing } = useTheme();

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]}>
      <View
        style={[styles.flex, padded ? { padding: spacing.lg } : undefined, style]}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
});
