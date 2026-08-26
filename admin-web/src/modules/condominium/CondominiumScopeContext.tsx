import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import { condominiumApi } from './api';
import type { Condominium } from './types';

interface CondominiumScopeContextValue {
  /** Todos os condomínios que o usuário autenticado enxerga — um só para CondominiumAdmin (a Api já restringe, PROMPT 12), um ou mais para SuperAdmin. */
  condominiums: Condominium[];
  /** O condomínio sendo administrado agora nesta tela. `null` só enquanto carrega ou se não houver nenhum condomínio cadastrado. */
  selected: Condominium | null;
  selectCondominium: (condominiumId: string) => void;
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}

const CondominiumScopeContext = createContext<CondominiumScopeContextValue | undefined>(undefined);

/**
 * Resolve "qual condomínio este administrador está vendo agora" —
 * reaproveita `GET /api/admin/condominiums`, que a própria Api já filtra
 * pelo escopo do usuário (PROMPT 12, `IAdminScopeService`): um
 * CondominiumAdmin recebe sempre uma lista de UM item (o próprio
 * condomínio — nunca confiamos em nada vindo do cliente para decidir
 * isso), enquanto um SuperAdmin recebe todos e escolhe pelo seletor (ver
 * `CondominiumPicker`, mostrado só quando há mais de uma opção).
 */
export function CondominiumScopeProvider({ children }: PropsWithChildren) {
  const [condominiums, setCondominiums] = useState<Condominium[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const list = await condominiumApi.list();
        if (cancelled) {
          return;
        }

        setCondominiums(list);
        setSelectedId((current) => {
          if (current && list.some((condominium) => condominium.id === current)) {
            return current;
          }
          return list[0]?.id ?? null;
        });
      } catch {
        if (!cancelled) {
          setError('Não foi possível carregar a lista de condomínios.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const selectCondominium = useCallback((condominiumId: string) => {
    setSelectedId(condominiumId);
  }, []);

  const reload = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  const value = useMemo<CondominiumScopeContextValue>(
    () => ({
      condominiums,
      selected: condominiums.find((condominium) => condominium.id === selectedId) ?? null,
      selectCondominium,
      isLoading,
      error,
      reload,
    }),
    [condominiums, selectedId, selectCondominium, isLoading, error, reload],
  );

  return <CondominiumScopeContext.Provider value={value}>{children}</CondominiumScopeContext.Provider>;
}

export function useCondominiumScope(): CondominiumScopeContextValue {
  const context = useContext(CondominiumScopeContext);

  if (!context) {
    throw new Error('useCondominiumScope precisa ser usado dentro de um <CondominiumScopeProvider>.');
  }

  return context;
}
