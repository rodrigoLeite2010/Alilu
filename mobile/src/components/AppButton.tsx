import { Pressable, type PressableProps, StyleSheet } from 'react-native';

import { useTheme } from '../theme';
import { AppText } from './AppText';

type Variant = 'primary' | 'secondary' | 'ghost';

interface AppButtonProps extends Omit<PressableProps, 'style'> {
  label: string;
  variant?: Variant;
}

/**
 * Botão padrão do ALILU. Modernizado na Etapa 20 ("estilo iFood/apps
 * atuais", sem mudar cores da marca): cantos mais arredondados (`radii.lg`,
 * antes `radii.md`), padding maior e sombra na variante `primary` (o
 * "botão de ação" ganha profundidade; `secondary`/`ghost` continuam planas
 * de propósito, para não competir visualmente com a ação principal da
 * tela). Feedback de toque continua só opacidade — nenhuma animação nova.
 */
export function AppButton({ label, variant = 'primary', disabled, ...rest }: AppButtonProps) {
  const { colors, spacing, radii, typography, shadows } = useTheme();

  const backgroundColor = {
    primary: colors.brand.primary,
    secondary: colors.surfaceAlt,
    ghost: 'transparent',
  }[variant];

  const textColor = {
    primary: colors.text.inverse,
    secondary: colors.text.primary,
    ghost: colors.brand.primary,
  }[variant];

  const borderColor = variant === 'ghost' ? colors.border : 'transparent';

  return (
    <Pressable
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && !disabled ? shadows.md : undefined,
        {
          backgroundColor,
          borderColor,
          borderWidth: variant === 'ghost' ? 1 : 0,
          paddingVertical: spacing.sm + spacing.xxs,
          paddingHorizontal: spacing.lg,
          borderRadius: radii.lg,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
      {...rest}
    >
      <AppText
        style={{ color: textColor, fontWeight: typography.weight.semibold }}
        accessibilityRole="none"
      >
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
