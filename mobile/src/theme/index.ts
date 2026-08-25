import { colors } from './colors';
import { spacing, radii } from './spacing';
import { typography } from './typography';

export const theme = {
  colors,
  spacing,
  radii,
  typography,
} as const;

export type Theme = typeof theme;

export { colors, spacing, radii, typography };
export * from './ThemeProvider';
