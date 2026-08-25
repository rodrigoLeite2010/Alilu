import { Pressable, type PressableProps, StyleSheet } from 'react-native';

import { useTheme } from '../theme';
import { AppText } from './AppText';

type Variant = 'primary' | 'secondary' | 'ghost';

interface AppButtonProps extends Omit<PressableProps, 'style'> {
  label: string;
  variant?: Variant;
}

/**
 * Botão padrão do ALILU. Sem animações/efeitos além do feedback nativo de
 * toque (opacidade) — visual limpo, conforme pedido no tema.
 */
export function AppButton({ label, variant = 'primary', disabled, ...rest }: AppButtonProps) {
  const { colors, spacing, radii, typography } = useTheme();

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
        {
          backgroundColor,
          borderColor,
          borderWidth: variant === 'ghost' ? 1 : 0,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.lg,
          borderRadius: radii.md,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
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
