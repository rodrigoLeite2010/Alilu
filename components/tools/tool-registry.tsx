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
import { CpfGeneratorTool } from "@/components/tools/cpf-generator/CpfGeneratorTool";
import { CnpjGeneratorTool } from "@/components/tools/cnpj-generator/CnpjGeneratorTool";
import { CreditCardGeneratorTool } from "@/components/tools/credit-card-generator/CreditCardGeneratorTool";
import { PisPasepGeneratorTool } from "@/components/tools/pis-pasep-generator/PisPasepGeneratorTool";
import { RenavamGeneratorTool } from "@/components/tools/renavam-generator/RenavamGeneratorTool";
import { CnhGeneratorTool } from "@/components/tools/cnh-generator/CnhGeneratorTool";
import { VoterIdGeneratorTool } from "@/components/tools/voter-id-generator/VoterIdGeneratorTool";
import { LicensePlateGeneratorTool } from "@/components/tools/license-plate-generator/LicensePlateGeneratorTool";
import { PasswordGeneratorTool } from "@/components/tools/password-generator/PasswordGeneratorTool";
import { RandomNumberGeneratorTool } from "@/components/tools/random-number-generator/RandomNumberGeneratorTool";
import { NumberDrawTool } from "@/components/tools/number-draw/NumberDrawTool";
import { NameGeneratorTool } from "@/components/tools/name-generator/NameGeneratorTool";
import { CepGeneratorTool } from "@/components/tools/cep-generator/CepGeneratorTool";
import { RgGeneratorTool } from "@/components/tools/rg-generator/RgGeneratorTool";
import { BankAccountGeneratorTool } from "@/components/tools/bank-account-generator/BankAccountGeneratorTool";
import { VehicleGeneratorTool } from "@/components/tools/vehicle-generator/VehicleGeneratorTool";
import { StateTaxIdGeneratorTool } from "@/components/tools/state-tax-id-generator/StateTaxIdGeneratorTool";
import { PersonGeneratorTool } from "@/components/tools/person-generator/PersonGeneratorTool";
import { CompanyGeneratorTool } from "@/components/tools/company-generator/CompanyGeneratorTool";
import { NicknameGeneratorTool } from "@/components/tools/nickname-generator/NicknameGeneratorTool";
import { FancyTextGeneratorTool } from "@/components/tools/fancy-text-generator/FancyTextGeneratorTool";
import { SymbolPickerTool } from "@/components/tools/symbol-picker/SymbolPickerTool";
import { LoremIpsumGeneratorTool } from "@/components/tools/lorem-ipsum-generator/LoremIpsumGeneratorTool";
import { ResumeBuilderTool } from "@/components/tools/resume-builder/ResumeBuilderTool";
import { CertificateRegistryGeneratorTool } from "@/components/tools/certificate-registry-generator/CertificateRegistryGeneratorTool";
import { PlaceholderImageGeneratorTool } from "@/components/tools/placeholder-image-generator/PlaceholderImageGeneratorTool";

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
  "gerador-cpf": CpfGeneratorTool,
  "gerador-cnpj": CnpjGeneratorTool,
  "gerador-cartao-credito": CreditCardGeneratorTool,
  // FASE B: geradores com algoritmo de dígito verificador real.
  "gerador-pis-pasep": PisPasepGeneratorTool,
  "gerador-renavam": RenavamGeneratorTool,
  "gerador-cnh": CnhGeneratorTool,
  "gerador-titulo-eleitor": VoterIdGeneratorTool,
  "gerador-placa-veiculo": LicensePlateGeneratorTool,
  "gerador-senha": PasswordGeneratorTool,
  "gerador-numeros-aleatorios": RandomNumberGeneratorTool,
  "sorteador-numeros": NumberDrawTool,
  // FASE C: geradores de dados fictícios base.
  "gerador-nomes": NameGeneratorTool,
  "gerador-cep": CepGeneratorTool,
  "gerador-rg": RgGeneratorTool,
  "gerador-conta-bancaria": BankAccountGeneratorTool,
  "gerador-veiculo": VehicleGeneratorTool,
  "gerador-inscricao-estadual": StateTaxIdGeneratorTool,
  // FASE D: geradores compostos e utilidades de texto.
  "gerador-pessoas": PersonGeneratorTool,
  "gerador-empresas": CompanyGeneratorTool,
  "gerador-nicks": NicknameGeneratorTool,
  "gerador-letras-diferentes": FancyTextGeneratorTool,
  "simbolos-para-copiar": SymbolPickerTool,
  "gerador-lorem-ipsum": LoremIpsumGeneratorTool,
  "gerador-curriculo": ResumeBuilderTool,
  "gerador-certidao": CertificateRegistryGeneratorTool,
  "gerador-imagem": PlaceholderImageGeneratorTool,
};
