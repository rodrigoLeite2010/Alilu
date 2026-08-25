import { QueryClient } from '@tanstack/react-query';

/**
 * Cliente único do TanStack Query, usado pelo <QueryClientProvider> no
 * layout raiz. Opções conservadoras por padrão — cada módulo poderá
 * ajustar `staleTime`/`retry` por query quando implementar suas chamadas.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
