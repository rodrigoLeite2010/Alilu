import { forwardRef } from 'react';
import { StyleSheet, TextInput, type TextInputProps, View } from 'react-native';

import { useTheme } from '../theme';
import { AppText } from './AppText';

interface AppTextInputProps extends TextInputProps {
  label?: string;
  errorMessage?: string;
}

/**
 * Campo de texto padrão do ALILU (label + input + mensagem de erro).
 * Primeiro uso: telas de autenticação (PROMPT 03) — fica em `components/`
 * porque qualquer formulário futuro (perfil, agendamento, etc.) vai
 * precisar do mesmo campo, junto com AppButton/AppText.
 */
export const AppTextInput = forwardRef<TextInput, AppTextInputProps>(function AppTextInput(
  { label, errorMessage, style, ...rest },
  ref,
) {
  const { colors, spacing, radii, typography } = useTheme();

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
        style={[
          styles.input,
          {
            borderColor: errorMessage ? colors.semantic.error : colors.border,
            backgroundColor: colors.surface,
            color: colors.text.primary,
            borderRadius: radii.md,
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
    borderWidth: 1,
  },
});
