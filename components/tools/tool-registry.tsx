import type { ComponentType } from "react";
import { ReceiptTool } from "@/components/tools/receipt/ReceiptTool";
import { CompoundInterestTool } from "@/components/tools/compound-interest/CompoundInterestTool";

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
};
