import { colors } from './colors';
import { spacing, radii } from './spacing';
import { typography } from './typography';

/**
 * Composição do tema — separada de `index.ts` de propósito (ver
 * comentário em `ThemeProvider.tsx`): `index.ts` também reexporta
 * `ThemeProvider` via `export * from './ThemeProvider'`, então se
 * `ThemeProvider.tsx` importasse `theme` de volta de `./index` haveria um
 * ciclo de módulos (index → ThemeProvider → index). Em Metro nativo isso
 * "funcionava" por acidente (resolução de `require` mais tolerante), mas
 * ao rodar como Web (`expo start --web`) o bundler resolve o ciclo com
 * semântica estrita de ESM e falha com "Cannot access 'theme' before
 * initialization". `theme.ts` não depende de nada dentro da pasta
 * `theme/` além dos arquivos de tokens (colors/spacing/typography), então
 * não participa de nenhum ciclo.
 */
export const theme = {
  colors,
  spacing,
  radii,
  typography,
} as const;

export type Theme = typeof theme;
