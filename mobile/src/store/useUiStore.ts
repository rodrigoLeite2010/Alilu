import { create } from 'zustand';

/**
 * Exemplo mínimo de store global com Zustand — estado de UI genérico
 * (overlay de carregamento global), sem nenhuma regra de negócio. Estado
 * específico de cada módulo (ex.: sessão do usuário autenticado) será
 * criado dentro do respectivo módulo quando implementado.
 */
interface UiState {
  isGlobalLoading: boolean;
  setGlobalLoading: (value: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  isGlobalLoading: false,
  setGlobalLoading: (value) => set({ isGlobalLoading: value }),
}));
