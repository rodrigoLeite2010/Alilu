import {
  calculateINSS,
  calculateIRRF2026,
  IRRF_DEPENDENT_DEDUCTION_2026,
} from "@/lib/calculators/payroll-tables";

/**
 * Lógica de cálculo da Calculadora de 13º Salário, isolada da interface (ver
 * PROMPT MESTRE, seção 14). Todo o processamento é síncrono e client-side.
 *
 * REGRAS UTILIZADAS (estáveis — Lei nº 4.090/1962 e regulamentação do MTE):
 *  - Valor bruto proporcional = (salário / 12) × meses trabalhados no ano
 *    (mês com 15 dias ou mais trabalhados conta como mês completo).
 *  - 1ª parcela: 50% do valor bruto, paga sem nenhum desconto de INSS/IRRF.
 *  - 2ª parcela: os outros 50%, MENOS o INSS e o IRRF calculados sobre o
 *    valor BRUTO TOTAL do 13º (não apenas sobre a 2ª parcela) — é assim que
 *    a 2ª parcela concentra o desconto do ano inteiro.
 *  - IRRF (2026): usa a regra completa de lib/calculators/payroll-tables.ts
 *    (calculateIRRF2026), incluindo a redução da Lei nº 15.270/2025 e a
 *    escolha entre dedução legal (INSS + dependentes) e desconto
 *    simplificado — aplicada de forma ISOLADA sobre o valor bruto total do
 *    13º (o "rendimento bruto" desta apuração é o 13º em si, não o salário
 *    do mês; a Receita Federal confirma que a redução de 2026 se aplica ao
 *    13º salário de forma isolada por rendimento — ver fonte no cabeçalho de
 *    payroll-tables.ts).
 *
 * LIMITAÇÃO DOCUMENTADA: calcula o INSS/IRRF apenas sobre o 13º, de forma
 * isolada do salário do mês do pagamento — não substitui o holerite oficial.
 */

export interface ThirteenthSalaryInput {
  /** Salário bruto mensal (R$). */
  grossSalary: number;
  /** Meses trabalhados no ano (1 a 12; mês com 15 dias ou mais conta como completo). */
  monthsWorked: number;
  /** Número de dependentes para fins de IRRF. */
  dependents: number;
}

export interface ThirteenthSalaryFieldErrors {
  grossSalary?: string;
  monthsWorked?: string;
  dependents?: string;
}

export interface ThirteenthSalaryResult {
  /** Valor líquido total (1ª + 2ª parcela) — resultado principal. */
  headline: number;
  grossTotal: number;
  firstInstallment: number;
  secondInstallmentGross: number;
  inss: number;
  dependentsDeduction: number;
  /** true quando o desconto simplificado (R$ 607,20) foi mais vantajoso que INSS + dependentes. */
  simplifiedDiscountChosen: boolean;
  irrfBase: number;
  /** IRRF pela tabela progressiva, antes da redução da Lei nº 15.270/2025. */
  irrfBeforeReduction: number;
  /** Redução aplicada (Lei nº 15.270/2025, vigente a partir de 2026). */
  irrfReduction: number;
  irrf: number;
  secondInstallmentNet: number;
  netTotal: number;
}

export function validateThirteenthSalaryInput(
  input: ThirteenthSalaryInput
): ThirteenthSalaryFieldErrors {
  const errors: ThirteenthSalaryFieldErrors = {};

  if (!Number.isFinite(input.grossSalary) || input.grossSalary <= 0) {
    errors.grossSalary = "Informe um salário bruto maior que zero.";
  }
  if (
    !Number.isFinite(input.monthsWorked) ||
    !Number.isInteger(input.monthsWorked) ||
    input.monthsWorked < 1 ||
    input.monthsWorked > 12
  ) {
    errors.monthsWorked = "Informe um número de meses trabalhados entre 1 e 12.";
  }
  if (
    !Number.isFinite(input.dependents) ||
    !Number.isInteger(input.dependents) ||
    input.dependents < 0
  ) {
    errors.dependents = "Informe um número de dependentes válido (0 ou mais).";
  }

  return errors;
}

export function isThirteenthSalaryInputValid(input: ThirteenthSalaryInput): boolean {
  return Object.keys(validateThirteenthSalaryInput(input)).length === 0;
}

/**
 * Calcula o 13º salário. Assume que `input` já foi validado (ver
 * validateThirteenthSalaryInput).
 */
export function calculateThirteenthSalary(
  input: ThirteenthSalaryInput
): ThirteenthSalaryResult {
  const grossTotal = (input.grossSalary / 12) * input.monthsWorked;
  const firstInstallment = grossTotal / 2;
  const secondInstallmentGross = grossTotal - firstInstallment;

  const inss = calculateINSS(grossTotal);
  const dependentsDeduction = input.dependents * IRRF_DEPENDENT_DEDUCTION_2026;
  const legalDeduction = inss + dependentsDeduction;

  // A redução de IRRF de 2026 é aplicada de forma isolada sobre o valor
  // bruto total do 13º (não sobre o salário do mês).
  const irrfCalculation = calculateIRRF2026(grossTotal, legalDeduction);

  const secondInstallmentNet = secondInstallmentGross - inss - irrfCalculation.finalTax;
  const netTotal = firstInstallment + secondInstallmentNet;

  return {
    headline: netTotal,
    grossTotal,
    firstInstallment,
    secondInstallmentGross,
    inss,
    dependentsDeduction,
    simplifiedDiscountChosen: irrfCalculation.simplifiedDiscountChosen,
    irrfBase: irrfCalculation.taxableBase,
    irrfBeforeReduction: irrfCalculation.taxBeforeReduction,
    irrfReduction: irrfCalculation.reduction,
    irrf: irrfCalculation.finalTax,
    secondInstallmentNet,
    netTotal,
  };
}
