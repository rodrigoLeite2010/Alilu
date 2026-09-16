import type { ComponentType } from "react";
import { ReceiptTool } from "@/components/tools/receipt/ReceiptTool";
import { CompoundInterestTool } from "@/components/tools/compound-interest/CompoundInterestTool";
import { FinancingTool } from "@/components/tools/financing/FinancingTool";

/**
 * Registro central que liga o id de uma ferramenta (data/tools.ts) ao
 * componente real que implementa seu cálculo/funcionalidade.
 *
 * Ferramentas sem entrada aqui continuam mostrando o aviso "Em breve" (ver
 * ComingSoonNotice em ToolPageTemplate), mesmo que o status no catálogo já
 * esteja "ativo" — evita que uma nova ferramenta seja publicada antes de seu
 * componente existir. Esta é a única alteração necessária em
 * app/utilitarios/[categoria]/[ferramenta]/page.tsx para plugar uma nova
 * calculadora (PROMPT MESTRE, seção 2).
 */
export const toolComponents: Record<string, ComponentType> = {
  "gerador-recibo": ReceiptTool,
  "juros-compostos": CompoundInterestTool,
  // Chave = tool.id (não o slug): o id desta ferramenta continua
  // "sac-x-price" mesmo após o slug/nome terem sido atualizados na ETAPA 4
  // para /utilitarios/financeiro/financiamento-sac-price (ver comentário em
  // data/tools.ts) — auditoria da ETAPA 4 encontrou esta chave errada
  // (estava como "financiamento-sac-price", divergindo de tool.id e
  // deixando a página real sem o componente).
  "sac-x-price": FinancingTool,
};
