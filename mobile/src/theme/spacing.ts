/**
 * Escala de espaçamento (grid de 4pt). Usar sempre múltiplos desta escala
 * em vez de valores mágicos, para manter consistência visual.
 */
export const spacing = {
  none: 0,
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

export const radii = {
  none: 0,
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

export type Spacing = typeof spacing;
export type Radii = typeof radii;
