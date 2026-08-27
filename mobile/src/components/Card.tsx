import type { PropsWithChildren } from 'react';
import { Pressable, type PressableProps, View, type ViewProps } from 'react-native';

import { useTheme } from '../theme';

interface CardProps extends PropsWithChildren, Omit<ViewProps, 'style'> {
  style?: ViewProps['style'];
  /** Quando informado, o Card vira um `Pressable` (item de lista clicável) em vez de um `View` estático. */
  onPress?: PressableProps['onPress'];
}

/**
 * React Native: Card (Etapa 20 — modernização visual "estilo iFood/apps
 * atuais"). Container elevado (sombra + cantos arredondados + fundo
 * `surface`) para substituir os `View`/`Pressable` com
 * `backgroundColor: colors.surfaceAlt` espalhados pelas telas desde os
 * primeiros prompts — mesma ideia visual, agora com profundidade (sombra)
 * em vez de só uma cor de fundo diferente do `background` da tela.
 *
 * Fica em `components/` (não em `theme/`) porque é um componente de UI, não
 * um token — mesmo critério já usado para `AppButton`/`AppTextInput`.
 */
export function Card({ children, style, onPress, ...rest }: CardProps) {
  const { colors, spacing, radii, shadows } = useTheme();

  const baseStyle = {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.sm + spacing.xxs,
    ...shadows.sm,
  };

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [baseStyle, { opacity: pressed ? 0.85 : 1 }, style]}
        {...rest}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View style={[baseStyle, style]} {...rest}>
      {children}
    </View>
  );
}
