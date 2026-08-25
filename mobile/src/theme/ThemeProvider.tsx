import { createContext, useContext, type PropsWithChildren } from 'react';

import { theme, type Theme } from './index';

/**
 * Provider simples de tema. Nesta etapa expõe apenas o tema estático do
 * ALILU (sem dark mode / troca de tema) — preparado para evoluir depois
 * sem quebrar a API dos componentes que já usam `useTheme()`.
 */
const ThemeContext = createContext<Theme>(theme);

export function ThemeProvider({ children }: PropsWithChildren) {
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
