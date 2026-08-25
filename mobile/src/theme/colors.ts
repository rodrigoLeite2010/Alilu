/**
 * Paleta de cores do ALILU.
 *
 * Objetivo: visual moderno, limpo e elegante, adequado a condomínios de
 * alto padrão — tons neutros e sóbrios, com um único acento (dourado
 * acinzentado) usado com moderação, sem efeitos exagerados.
 */
export const colors = {
  // Marca / acento — usar com moderação (CTAs, destaques, ícones ativos)
  brand: {
    primary: '#1B2733', // grafite azulado — cor principal (texto de destaque, header)
    accent: '#B08D57', // dourado acinzentado — acento único da marca
  },

  // Neutros — base da interface
  neutral: {
    50: '#FAFAF8',
    100: '#F3F2EE',
    200: '#E6E4DD',
    300: '#D3D0C6',
    400: '#A8A499',
    500: '#7C7869',
    600: '#5B584C',
    700: '#3F3D35',
    800: '#282723',
    900: '#171615',
  },

  // Superfícies
  background: '#FAFAF8',
  surface: '#FFFFFF',
  surfaceAlt: '#F3F2EE',
  border: '#E6E4DD',

  // Texto
  text: {
    primary: '#1B2733',
    secondary: '#5B584C',
    muted: '#7C7869',
    inverse: '#FAFAF8',
  },

  // Semânticas — tons suaves, nada saturado
  semantic: {
    success: '#4C7A5B',
    warning: '#B08D57',
    error: '#A6473B',
    info: '#3C6E8F',
  },
} as const;

export type Colors = typeof colors;
