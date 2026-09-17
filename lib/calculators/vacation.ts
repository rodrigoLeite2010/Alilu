import {
  calculateINSS,
  calculateIRRF2026,
  IRRF_DEPENDENT_DEDUCTION_2026,
} from "@/lib/calculators/payroll-tables";

/**
 * Lógica de cálculo da Calculadora de Férias, isolada da interface (ver
 * PROMPT MESTRE, seção 14). Todo o processamento é síncrono e client-side.
 *
 * REGRAS UTILIZADAS (estáveis, não são tabela que muda por ano):
 *  - Terço constitucional: 1/3 sobre o valor das férias (art. 7º, XVII, CF).
 *  - Abono pecuniário ("venda de férias"): até 1/3 dos dias de férias podem
 *    ser convertidos em dinheiro (art. 143 da CLT), também com o terço
 *    constitucional sobre o valor do abono.
 *  - O abono pecuniário em si é isento de INSS e de IRRF (verba
 *    indenizatória). JÁ O TERÇO CONSTITUCIONAL INCIDENTE SOBRE O ABONO tem
 *    tratamento DIFERENTE entre as duas contribuições: é isento de INSS,
 *    mas É TRIBUTÁVEL para fins de IRRF — confirmado de forma independente
 *    em fonte contábil especializada (Guia Trabalhista/IOB, "Incidências
 *    sobre Férias": o terço sobre o abono não tem a mesma natureza
 *    indenizatória do abono principal, pois é acréscimo constitucional
 *    sobre uma verba que, não fosse a opção do empregado por vendê-la,
 *    seria tributável). Por isso as bases de INSS e de IRRF DIVERGEM aqui:
 *      • base do INSS = férias gozadas + terço constitucional sobre elas
 *        (abono e terço sobre o abono ficam de fora);
 *      • base do IRRF = férias gozadas + terço constitucional sobre elas
 *        + terço constitucional sobre o abono (o abono em si continua de
 *        fora, só o seu terço entra).
 *  - IRRF (2026): usa a regra completa de lib/calculators/payroll-tables.ts
 *    (calculateIRRF2026), incluindo a redução da Lei nº 15.270/2025 e a
 *    escolha entre dedução legal (INSS + dependentes) e desconto
 *    simplificado — aplicada de forma ISOLADA sobre o valor tributável das
 *    férias (o "rendimento bruto" desta apuração é o valor definido acima
 *    para a base do IRRF, não o salário do mês; a Receita Federal confirma
 *    que a redução de 2026 se aplica a férias de forma isolada por
 *    rendimento).
 *
 * LIMITAÇÃO DOCUMENTADA: assume período aquisitivo completo (direito a 30
 * dias) e calcula o INSS/IRRF apenas sobre o valor das férias, de forma
 * isolada do salário do mês — na folha de pagamento real, esses valores
 * costumam ser somados ao salário do mês antes de aplicar a tabela, o que
 * pode mudar o valor final do desconto. Não substitui o holerite oficial.
 */

export interface VacationInput {
  /** Salário bruto mensal (R$). */
  grossSalary: number;
  /** Dias de férias gozados (1 a 30). */
  vacationDays: number;
  /** Dias vendidos em abono pecuniário (0 a 10 — até 1/3 de 30 dias). */
  sellDays: number;
  /** Número de dependentes para fins de IRRF. */
  dependents: number;
}

export interface VacationFieldErrors {
  vacationDays?: string;
  sellDays?: string;
  grossSalary?: string;
  dependents?: string;
}

export interface VacationResult {
  /** Valor líquido total a receber (férias + 1/3 + abono, já com descontos) — resultado principal. */
  headline: number;
  dailyRate: number;
  vacationGrossValue: number;
  oneThird: number;
  abonoValue: number;
  abonoOneThird: number;
  grossTotal: number;
  /** Valor bruto tributável das férias (gozadas + terço, sem o abono) — base do INSS. */
  taxableGrossValue: number;
  /** Rendimento bruto usado para o IRRF: taxableGrossValue + terço constitucional sobre o abono (tributável, embora isento de INSS). Igual a taxableGrossValue quando não há abono. */
  irrfGrossValue: number;
  inss: number;
  /** true quando o desconto simplificado (R$ 607,20) foi mais vantajoso que INSS + dependentes. */
  simplifiedDiscountChosen: boolean;
  irrfBase: number;
  /** IRRF pela tabela progressiva, antes da redução da Lei nº 15.270/2025. */
  irrfBeforeReduction: number;
  /** Redução aplicada (Lei nº 15.270/2025, vigente a partir de 2026). */
  irrfReduction: number;
  irrf: number;
  netTotal: number;
}

export function validateVacationInput(input: VacationInput): VacationFieldErrors {
  const errors: VacationFieldErrors = {};

  if (!Number.isFinite(input.grossSalary) || input.grossSalary <= 0) {
    errors.grossSalary = "Informe um salário bruto maior que zero.";
  }
  if (
    !Number.isFinite(input.vacationDays) ||
    !Number.isInteger(input.vacationDays) ||
    input.vacationDays < 1 ||
    input.vacationDays > 30
  ) {
    errors.vacationDays = "Informe um número de dias de férias entre 1 e 30.";
  }
  if (
    !Number.isFinite(input.sellDays) ||
    !Number.isInteger(input.sellDays) ||
    input.sellDays < 0 ||
    input.sellDays > 10
  ) {
    errors.sellDays = "O abono pecuniário pode ser de, no máximo, 10 dias (1/3 de 30).";
  }
  if (
    Number.isFinite(input.vacationDays) &&
    Number.isFinite(input.sellDays) &&
    input.vacationDays + input.sellDays > 30
  ) {
    errors.sellDays = "A soma dos dias gozados com os dias vendidos não pode passar de 30.";
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

export function isVacationInputValid(input: VacationInput): boolean {
  return Object.keys(validateVacationInput(input)).length === 0;
}

/**
 * Calcula o valor das férias. Assume que `input` já foi validado (ver
 * validateVacationInput).
 */
export function calculateVacation(input: VacationInput): VacationResult {
  const dailyRate = input.grossSalary / 30;
  const vacationGrossValue = dailyRate * input.vacationDays;
  const oneThird = vacationGrossValue / 3;
  const abonoValue = dailyRate * input.sellDays;
  const abonoOneThird = abonoValue / 3;

  const grossTotal = vacationGrossValue + oneThird + abonoValue + abonoOneThird;

  // Abono pecuniário é isento de INSS/IRRF — a base do INSS é só a parte das
  // férias efetivamente gozadas + o respectivo terço constitucional.
  const taxableGrossValue = vacationGrossValue + oneThird;
  const inss = calculateINSS(taxableGrossValue);
  const dependentsDeduction = input.dependents * IRRF_DEPENDENT_DEDUCTION_2026;
  const legalDeduction = inss + dependentsDeduction;

  // A base do IRRF diverge da base do INSS: o terço constitucional sobre o
  // abono é isento de INSS, mas é tributável para IRRF (ver cabeçalho do
  // arquivo). O abono em si continua fora de ambas as bases.
  const irrfGrossValue = taxableGrossValue + abonoOneThird;

  // A redução de IRRF de 2026 é aplicada de forma isolada sobre o
  // rendimento bruto tributável das férias (não sobre o salário do mês).
  const irrfCalculation = calculateIRRF2026(irrfGrossValue, legalDeduction);

  const netTotal = grossTotal - inss - irrfCalculation.finalTax;

  return {
    headline: netTotal,
    dailyRate,
    vacationGrossValue,
    oneThird,
    abonoValue,
    abonoOneThird,
    grossTotal,
    taxableGrossValue,
    irrfGrossValue,
    inss,
    simplifiedDiscountChosen: irrfCalculation.simplifiedDiscountChosen,
    irrfBase: irrfCalculation.taxableBase,
    irrfBeforeReduction: irrfCalculation.taxBeforeReduction,
    irrfReduction: irrfCalculation.reduction,
    irrf: irrfCalculation.finalTax,
    netTotal,
  };
}
