"use client";

import { useConnectionInfo } from "@/components/tools/rede-internet-shared/useConnectionInfo";

/**
 * Meu Navegador (categoria Rede e Internet). Usa o helper `userAgent()`
 * nativo do Next.js (via /api/informacoes-conexao) para identificar
 * navegador, engine e idioma a partir do header User-Agent da própria
 * requisição — sem nenhuma técnica de fingerprinting invasivo (canvas,
 * fontes, plugins, etc.).
 */
export function MeuNavegadorTool() {
  const { data, loading, error } = useConnectionInfo();

  if (loading) {
    return <p className="text-sm text-zinc-500">Detectando seu navegador...</p>;
  }

  if (error || !data) {
    return (
      <p className="text-sm text-red-600">
        Não foi possível detectar as informações do navegador agora. Tente recarregar a página.
      </p>
    );
  }

  // navigator.cookieEnabled só existe no navegador (não no header da
  // requisição), então é lido à parte, diretamente do próprio navigator.
  // Como este trecho só é renderizado depois que os dados do fetch chegam
  // (portanto nunca durante a renderização no servidor), lê-lo diretamente
  // aqui não causa divergência de hidratação.
  const cookiesEnabled = typeof navigator !== "undefined" ? navigator.cookieEnabled : null;

  const rows: { label: string; value: string }[] = [
    { label: "Navegador", value: data.browser.name ?? "Não identificado" },
    { label: "Versão (aproximada)", value: data.browser.version ?? "Não identificada" },
    { label: "Motor de renderização (engine)", value: data.engine.name ?? "Não identificado" },
    { label: "Idioma preferido", value: data.language ?? "Não identificado" },
    {
      label: "Cookies habilitados",
      value: cookiesEnabled === null ? "Não identificado" : cookiesEnabled ? "Sim" : "Não",
    },
  ];

  return (
    <div>
      <dl className="divide-y divide-zinc-100 rounded-lg border border-zinc-200">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3 px-4 py-3">
            <dt className="text-sm text-zinc-600">{row.label}</dt>
            <dd className="text-sm font-medium text-zinc-900">{row.value}</dd>
          </div>
        ))}
      </dl>

      <details className="mt-4 rounded-lg border border-zinc-200 p-4 text-sm text-zinc-600">
        <summary className="cursor-pointer font-medium text-zinc-800">
          Ver User-Agent completo
        </summary>
        <p className="mt-2 break-all font-mono text-xs text-zinc-500">{data.userAgentString}</p>
      </details>

      <p className="mt-4 text-xs text-zinc-500">
        Navegadores modernos podem reduzir ou &quot;congelar&quot; as informações enviadas no
        User-Agent (User-Agent Reduction), então o nome e a versão exibidos podem não refletir 100%
        a versão real instalada.
      </p>
    </div>
  );
}
