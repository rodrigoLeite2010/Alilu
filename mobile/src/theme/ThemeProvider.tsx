import { createContext, useContext, type PropsWithChildren } from 'react';

import { theme, type Theme } from './theme';

/**
 * Provider simples de tema. Nesta etapa expõe apenas o tema estático do
 * ALILU (sem dark mode / troca de tema) — preparado para evoluir depois
 * sem quebrar a API dos componentes que já usam `useTheme()`.
 *
 * Importa `theme`/`Theme` de `./theme` (não de `./index`, o barrel deste
 * módulo) de propósito — `index.ts` reexporta este próprio arquivo via
 * `export * from './ThemeProvider'`, então importar de volta de `./index`
 * criaria um ciclo (index → ThemeProvider → index) que o bundler Web do
 * Expo resolve com semântica estrita de ESM e quebra com "Cannot access
 * 'theme' before initialization" (no Metro nativo isso não aparecia).
 */
const ThemeContext = createContext<Theme>(theme);

export function ThemeProvider({ children }: PropsWithChildren) {
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
