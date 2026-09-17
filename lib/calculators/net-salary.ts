import {
  calculateINSS,
  calculateIRRF2026,
  IRRF_DEPENDENT_DEDUCTION_2026,
} from "@/lib/calculators/payroll-tables";

/**
 * Lógica de cálculo da Calculadora de Salário Líquido, isolada da interface
 * (ver PROMPT MESTRE, seção 14). Usa as tabelas de INSS e a regra completa
 * de IRRF centralizadas em lib/calculators/payroll-tables.ts (referência
 * 2026, incluindo a redução da Lei nº 15.270/2025 e a escolha entre dedução
 * legal e desconto simplificado — ver fontes lá documentadas). Todo o
 * processamento é síncrono e client-side.
 *
 * LIMITAÇÃO DOCUMENTADA: calcula apenas o desconto mensal padrão de INSS e
 * IRRF sobre o salário bruto informado. Não substitui o holerite oficial,
 * que pode incluir outras rubricas (horas extras, comissões, adicionais,
 * pensão alimentícia etc.), nem o ajuste anual da declaração de Imposto de
 * Renda.
 */

export interface NetSalaryInput {
  /** Salário bruto mensal (R$). */
  grossSalary: number;
  /** Número de dependentes para fins de IRRF. */
  dependents: number;
  /** Outros descontos informados pelo usuário (R$), ex.: vale-transporte, plano de saúde, pensão. */
  otherDeductions: number;
}

export interface NetSalaryFieldErrors {
  grossSalary?: string;
  dependents?: string;
  otherDeductions?: string;
}

export interface NetSalaryResult {
  /** Salário líquido — resultado principal. */
  headline: number;
  grossSalary: number;
  inss: number;
  dependentsDeduction: number;
  /** true quando o desconto simplificado (R$ 607,20) foi mais vantajoso que INSS + dependentes. */
  simplifiedDiscountChosen: boolean;
  /** Dedução usada para chegar à base do IRRF (a maior entre INSS + dependentes e o desconto simplificado). */
  irrfDeductionUsed: number;
  irrfBase: number;
  /** IRRF pela tabela progressiva, antes da redução da Lei nº 15.270/2025. */
  irrfBeforeReduction: number;
  /** Redução aplicada (Lei nº 15.270/2025, vigente a partir de 2026). */
  irrfReduction: number;
  /** IRRF final, já com a redução aplicada. */
  irrf: number;
  otherDeductions: number;
  totalDeductions: number;
}

export function validateNetSalaryInput(input: NetSalaryInput): NetSalaryFieldErrors {
  const errors: NetSalaryFieldErrors = {};

  if (!Number.isFinite(input.grossSalary) || input.grossSalary <= 0) {
    errors.grossSalary = "Informe um salário bruto maior que zero.";
  }
  if (
    !Number.isFinite(input.dependents) ||
    !Number.isInteger(input.dependents) ||
    input.dependents < 0
  ) {
    errors.dependents = "Informe um número de dependentes válido (0 ou mais).";
  }
  if (!Number.isFinite(input.otherDeductions) || input.otherDeductions < 0) {
    errors.otherDeductions = "Outros descontos não podem ser negativos.";
  }

  return errors;
}

export function isNetSalaryInputValid(input: NetSalaryInput): boolean {
  return Object.keys(validateNetSalaryInput(input)).length === 0;
}

/**
 * Calcula o salário líquido. Assume que `input` já foi validado (ver
 * validateNetSalaryInput).
 */
export function calculateNetSalary(input: NetSalaryInput): NetSalaryResult {
  const inss = calculateINSS(input.grossSalary);
  const dependentsDeduction = input.dependents * IRRF_DEPENDENT_DEDUCTION_2026;
  const legalDeduction = inss + dependentsDeduction;

  const irrfCalculation = calculateIRRF2026(input.grossSalary, legalDeduction);

  const totalDeductions = inss + irrfCalculation.finalTax + input.otherDeductions;
  const headline = input.grossSalary - totalDeductions;

  return {
    headline,
    grossSalary: input.grossSalary,
    inss,
    dependentsDeduction,
    simplifiedDiscountChosen: irrfCalculation.simplifiedDiscountChosen,
    irrfDeductionUsed: irrfCalculation.deductionUsed,
    irrfBase: irrfCalculation.taxableBase,
    irrfBeforeReduction: irrfCalculation.taxBeforeReduction,
    irrfReduction: irrfCalculation.reduction,
    irrf: irrfCalculation.finalTax,
    otherDeductions: input.otherDeductions,
    totalDeductions,
  };
}
