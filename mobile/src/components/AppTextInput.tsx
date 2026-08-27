import { forwardRef, useState } from 'react';
import { StyleSheet, TextInput, type TextInputProps, View } from 'react-native';

import { useTheme } from '../theme';
import { AppText } from './AppText';

interface AppTextInputProps extends TextInputProps {
  label?: string;
  errorMessage?: string;
}

/**
 * Campo de texto padrão do ALILU (label + input + mensagem de erro).
 * Modernizado na Etapa 20 ("estilo iFood/apps atuais"): fundo preenchido
 * (`surfaceAlt`) em vez de caixa branca com borda — a borda só aparece em
 * erro ou quando o campo está focado, no lugar de estar sempre visível.
 * Cantos mais arredondados (`radii.lg`, antes `radii.md`). Continua sem
 * nenhuma dependência nova — só `useState` local para o estado de foco.
 */
export const AppTextInput = forwardRef<TextInput, AppTextInputProps>(function AppTextInput(
  { label, errorMessage, style, onFocus, onBlur, ...rest },
  ref,
) {
  const { colors, spacing, radii, typography } = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  const borderColor = errorMessage ? colors.semantic.error : isFocused ? colors.brand.accent : 'transparent';

  return (
    <View style={{ gap: spacing.xxs }}>
      {label ? (
        <AppText variant="caption" color="secondary">
          {label}
        </AppText>
      ) : null}

      <TextInput
        ref={ref}
        placeholderTextColor={colors.text.muted}
        onFocus={(event) => {
          setIsFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setIsFocused(false);
          onBlur?.(event);
        }}
        style={[
          styles.input,
          {
            borderColor,
            backgroundColor: colors.surfaceAlt,
            color: colors.text.primary,
            borderRadius: radii.lg,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.sm,
            fontSize: typography.size.md,
            fontFamily: typography.fontFamily,
          },
          style,
        ]}
        {...rest}
      />

      {errorMessage ? (
        <AppText variant="caption" style={{ color: colors.semantic.error }}>
          {errorMessage}
        </AppText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  input: {
    borderWidth: 1.5,
  },
});
