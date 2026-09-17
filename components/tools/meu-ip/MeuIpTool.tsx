"use client";

import { useConnectionInfo } from "@/components/tools/rede-internet-shared/useConnectionInfo";

/**
 * Meu IP (categoria Rede e Internet). Mostra o endereço IP detectado a
 * partir dos headers da própria requisição ao Route Handler
 * /api/informacoes-conexao — sem nenhum serviço externo de geolocalização
 * ou analytics.
 */
export function MeuIpTool() {
  const { data, loading, error } = useConnectionInfo();

  return (
    <div>
      <div className="mb-6 rounded-lg border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900">
        Seu IP é exibido apenas para você nesta consulta e não é armazenado por esta ferramenta.
      </div>

      <div className="rounded-lg border border-zinc-200 p-6 text-center">
        {loading ? (
          <p className="text-sm text-zinc-500">Detectando seu IP...</p>
        ) : error || !data ? (
          <p className="text-sm text-red-600">
            Não foi possível detectar seu IP agora. Tente recarregar a página.
          </p>
        ) : data.ip ? (
          <>
            <p className="break-all font-mono text-3xl font-bold text-zinc-900">{data.ip}</p>
            <p className="mt-2 text-sm text-zinc-500">
              {data.ipVersion ?? "Versão desconhecida"}
            </p>
          </>
        ) : (
          <p className="text-sm text-zinc-500">
            Não foi possível identificar seu IP nesta conexão (isso é comum fora de produção, quando
            não há um proxy definindo o header de IP do cliente).
          </p>
        )}
      </div>
    </div>
  );
}
