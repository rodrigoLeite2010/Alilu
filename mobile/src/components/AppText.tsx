import { Text, type TextProps, type TextStyle } from 'react-native';

import { useTheme } from '../theme';

type Variant = 'display' | 'title' | 'subtitle' | 'body' | 'caption';

interface AppTextProps extends TextProps {
  variant?: Variant;
  color?: 'primary' | 'secondary' | 'muted' | 'inverse';
}

/**
 * Texto padrão do ALILU. Centraliza tamanho/peso/cor em vez de espalhar
 * estilos soltos pelas telas — mantém a tipografia consistente conforme o
 * tema definido em `theme/typography.ts`.
 */
export function AppText({ variant = 'body', color = 'primary', style, ...rest }: AppTextProps) {
  const { typography, colors } = useTheme();

  const variantStyle: TextStyle = (() => {
    switch (variant) {
      case 'display':
        return { fontSize: typography.size.display, fontWeight: typography.weight.bold };
      case 'title':
        return { fontSize: typography.size.xxl, fontWeight: typography.weight.semibold };
      case 'subtitle':
        return { fontSize: typography.size.lg, fontWeight: typography.weight.medium };
      case 'caption':
        return { fontSize: typography.size.xs, fontWeight: typography.weight.regular };
      case 'body':
      default:
        return { fontSize: typography.size.md, fontWeight: typography.weight.regular };
    }
  })();

  return (
    <Text
      style={[
        { fontFamily: typography.fontFamily, color: colors.text[color] },
        variantStyle,
        style,
      ]}
      {...rest}
    />
  );
}
