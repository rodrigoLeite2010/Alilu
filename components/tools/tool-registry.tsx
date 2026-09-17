import type { ComponentType } from "react";
import { ReceiptTool } from "@/components/tools/receipt/ReceiptTool";
import { CompoundInterestTool } from "@/components/tools/compound-interest/CompoundInterestTool";
import { FinancingTool } from "@/components/tools/financing/FinancingTool";
import { PercentageTool } from "@/components/tools/percentage/PercentageTool";
import { MarkupTool } from "@/components/tools/markup/MarkupTool";
import { ProfitMarginTool } from "@/components/tools/profit-margin/ProfitMarginTool";
import { BusinessDaysTool } from "@/components/tools/business-days/BusinessDaysTool";
import { BillSplitTool } from "@/components/tools/bill-split/BillSplitTool";
import { OvertimeTool } from "@/components/tools/overtime/OvertimeTool";
import { ParcelamentoTool } from "@/components/tools/parcelamento/ParcelamentoTool";
import { FinanciamentoVeiculoTool } from "@/components/tools/financiamento-veiculo/FinanciamentoVeiculoTool";
import { SavingsGoalTool } from "@/components/tools/savings-goal/SavingsGoalTool";
import { NetSalaryTool } from "@/components/tools/net-salary/NetSalaryTool";
import { VacationTool } from "@/components/tools/vacation/VacationTool";
import { ThirteenthSalaryTool } from "@/components/tools/thirteenth-salary/ThirteenthSalaryTool";
import { EmployeeCostTool } from "@/components/tools/employee-cost/EmployeeCostTool";
import { SeveranceTool } from "@/components/tools/severance/SeveranceTool";
import { QrCodeTool } from "@/components/tools/qr-code/QrCodeTool";
import { NfeReaderTool } from "@/components/tools/nfe-reader/NfeReaderTool";
import { QuoteTool } from "@/components/tools/quote/QuoteTool";

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
  porcentagem: PercentageTool,
  markup: MarkupTool,
  "margem-de-lucro": ProfitMarginTool,
  "dias-uteis": BusinessDaysTool,
  "divisao-de-despesas": BillSplitTool,
  "hora-extra": OvertimeTool,
  parcelamento: ParcelamentoTool,
  "financiamento-veiculo": FinanciamentoVeiculoTool,
  "quanto-guardar-por-mes": SavingsGoalTool,
  "salario-liquido": NetSalaryTool,
  "calculadora-ferias": VacationTool,
  "decimo-terceiro": ThirteenthSalaryTool,
  "custo-funcionario": EmployeeCostTool,
  "calculadora-rescisao": SeveranceTool,
  "qr-code": QrCodeTool,
  "leitor-xml-nfe": NfeReaderTool,
  "gerador-orcamento": QuoteTool,
};
