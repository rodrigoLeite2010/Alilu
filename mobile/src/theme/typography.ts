import { Platform } from 'react-native';

/**
 * Tipografia do ALILU.
 *
 * Usa a fonte padrão de cada plataforma (San Francisco no iOS, Roboto no
 * Android) para manter o app leve e nativo — nenhuma fonte customizada foi
 * adicionada nesta etapa.
 */
const fontFamily = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: 'System',
});

export const typography = {
  fontFamily,
  size: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 22,
    xxl: 28,
    display: 34,
  },
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
  lineHeight: {
    tight: 1.15,
    normal: 1.35,
    relaxed: 1.6,
  },
} as const;

export type Typography = typeof typography;
