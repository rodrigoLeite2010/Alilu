import { ToolGrid } from "@/components/tools/ToolGrid";
import { getToolsByIds, VEHICLE_FINANCING_CLUSTER_TOOL_IDS } from "@/data/tools";

/**
 * Página hub do cluster "Financiamento de Veículos"
 * (/utilitarios/financeiro/financiamento-veiculos). Não é uma calculadora —
 * é a porta de entrada que apresenta todas as ferramentas do cluster, cada
 * uma respondendo a uma pergunta específica. A ordem dos cards vem de
 * VEHICLE_FINANCING_CLUSTER_TOOL_IDS (data/tools.ts), única fonte de
 * verdade. Ferramentas ainda "em-breve" aparecem normalmente com o selo
 * "Em breve" (mesmo comportamento do ToolCard em qualquer outra categoria)
 * — a página nunca inventa links quebrados nem esconde o que falta.
 */
export function FinanciamentoVeiculosHubTool() {
  const clusterTools = getToolsByIds([...VEHICLE_FINANCING_CLUSTER_TOOL_IDS]);

  return (
    <div>
      <p className="text-sm leading-relaxed text-zinc-700">
        Comprar ou trocar de carro financiado envolve mais de uma conta. Aqui você encontra, num só
        lugar, as calculadoras para calcular a parcela, descobrir a taxa de juros embutida, calcular
        a entrada necessária, comparar prazos e propostas, simular a antecipação de parcelas e
        analisar o custo total de ter o veículo — cada uma respondendo a uma pergunta específica,
        sem precisar preencher tudo de novo em cada uma.
      </p>

      <div className="mt-6">
        <ToolGrid tools={clusterTools} />
      </div>
    </div>
  );
}
