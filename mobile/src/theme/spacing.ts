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

// Modernização visual (Etapa 20, "estilo iFood/apps atuais") — cantos mais
// arredondados em toda a escala; só a FORMA muda aqui, nenhuma cor. Valores
// antigos ficam comentados ao lado para referência de quem revisar o diff.
export const radii = {
  none: 0,
  sm: 8, // antes: 6
  md: 14, // antes: 10
  lg: 20, // antes: 16
  xl: 28, // antes: 24
  full: 999,
} as const;

export type Spacing = typeof spacing;
export type Radii = typeof radii;
