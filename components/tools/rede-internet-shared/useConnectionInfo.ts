"use client";

import { useEffect, useState } from "react";
import type { ConnectionInfo } from "@/app/api/informacoes-conexao/route";

export type { ConnectionInfo };

interface ConnectionInfoState {
  data: ConnectionInfo | null;
  loading: boolean;
  error: boolean;
}

/**
 * Hook compartilhado pelas três ferramentas da categoria Rede e Internet
 * (Meu IP, Meu Navegador, Meu Sistema Operacional). Busca uma única vez o
 * Route Handler /api/informacoes-conexao — reaproveitado pelas três, em vez
 * de cada ferramenta duplicar a mesma chamada de rede.
 *
 * Nada do que é buscado aqui é armazenado: o resultado só vive no estado do
 * componente, na memória do navegador, enquanto a página está aberta.
 */
export function useConnectionInfo(): ConnectionInfoState {
  const [state, setState] = useState<ConnectionInfoState>({
    data: null,
    loading: true,
    error: false,
  });

  useEffect(() => {
    let cancelled = false;

    fetch("/api/informacoes-conexao")
      .then((response) => {
        if (!response.ok) throw new Error("Falha ao buscar informações de conexão");
        return response.json() as Promise<ConnectionInfo>;
      })
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: false });
      })
      .catch(() => {
        if (!cancelled) setState({ data: null, loading: false, error: true });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
