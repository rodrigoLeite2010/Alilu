"use client";

import { useConnectionInfo } from "@/components/tools/rede-internet-shared/useConnectionInfo";

/**
 * Meu Sistema Operacional (categoria Rede e Internet). Usa o helper
 * `userAgent()` nativo do Next.js (via /api/informacoes-conexao) para
 * identificar o sistema operacional a partir do header User-Agent — sem
 * nenhuma coleta adicional de hardware ou fingerprinting invasivo.
 */
export function MeuSistemaOperacionalTool() {
  const { data, loading, error } = useConnectionInfo();

  if (loading) {
    return <p className="text-sm text-zinc-500">Detectando seu sistema...</p>;
  }

  if (error || !data) {
    return (
      <p className="text-sm text-red-600">
        Não foi possível detectar seu sistema operacional agora. Tente recarregar a página.
      </p>
    );
  }

  const rows: { label: string; value: string }[] = [
    { label: "Sistema operacional", value: data.os.name ?? "Não identificado" },
    { label: "Versão (quando disponível)", value: data.os.version ?? "Não identificada" },
    {
      label: "Tipo de dispositivo",
      value: data.device.type ?? "Computador (desktop)",
    },
    { label: "Arquitetura do processador", value: data.cpu.architecture ?? "Não identificada" },
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

      <p className="mt-4 text-xs text-zinc-500">
        A versão exata do sistema operacional só é exibida quando o navegador informa esse dado de
        forma confiável no User-Agent — em muitos navegadores modernos, por privacidade, essa
        informação vem reduzida ou omitida.
      </p>
    </div>
  );
}
