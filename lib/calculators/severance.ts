import {
  calculateINSS,
  calculateIRRF2026,
  FGTS_TERMINATION_FINE_RATE,
  IRRF_DEPENDENT_DEDUCTION_2026,
} from "@/lib/calculators/payroll-tables";

/**
 * Lógica de cálculo da Calculadora de Rescisão CLT, isolada da interface
 * (ver PROMPT MESTRE, seção 14). Todo o processamento é síncrono e
 * client-side. Esta é a ferramenta trabalhista mais sensível do catálogo —
 * o escopo foi deliberadamente LIMITADO aos dois tipos de desligamento mais
 * comuns e melhor definidos em lei, para não arriscar um cálculo incorreto:
 *
 *  - "sem_justa_causa": dispensa sem justa causa pelo empregador.
 *  - "pedido_demissao": pedido de demissão pelo próprio empregado.
 *
 * Tipos NÃO cobertos (fora do escopo desta simulação, por exigirem regras
 * adicionais e mais sujeitas a controvérsia/acordo específico): justa
 * causa, acordo mútuo (distrato, art. 484-A da CLT), término de contrato de
 * experiência/prazo determinado, aposentadoria e falecimento.
 *
 * REGRAS UTILIZADAS (estáveis, não são tabela que muda por ano):
 *  - Aviso prévio proporcional: 30 dias + 3 dias por ano completo de
 *    serviço, até o máximo de 90 dias (Lei nº 12.506/2011). O TST já
 *    decidiu que essa proporcionalidade é uma obrigação limitada ao
 *    empregador — por isso só é calculada para "sem_justa_causa"; no
 *    pedido de demissão, o aviso prévio do empregado é sempre de 30 dias
 *    fixos (art. 487 da CLT) e não gera valor a RECEBER (é uma obrigação
 *    do empregado, que pode ou não ser dispensada pelo empregador — por
 *    isso não é calculado aqui como verba, apenas mencionado como
 *    limitação).
 *  - Férias vencidas (não gozadas de período já completo) + 1/3 e férias
 *    proporcionais + 1/3 (art. 146 da CLT; art. 7º, XVII, CF).
 *  - 13º salário proporcional (Lei nº 4.090/1962).
 *  - Multa de 40% do FGTS sobre o saldo depositado, devida apenas na
 *    dispensa sem justa causa (art. 18, §1º, Lei nº 8.036/1990) — como o
 *    saldo do FGTS não é calculado por este simulador (depende do
 *    histórico real de depósitos), ele é um campo OPCIONAL preenchido pelo
 *    usuário a partir do extrato do FGTS.
 *  - Verbas indenizatórias (aviso prévio indenizado, férias e o respectivo
 *    1/3) não sofrem desconto de INSS/IRRF. Saldo de salário e 13º
 *    proporcional sofrem os descontos normais.
 *  - IRRF (2026): usa a regra completa de lib/calculators/payroll-tables.ts
 *    (calculateIRRF2026), incluindo a redução da Lei nº 15.270/2025 e a
 *    escolha entre dedução legal (INSS + dependentes) e desconto
 *    simplificado — aplicada de forma ISOLADA sobre cada uma das duas únicas
 *    verbas tributáveis que restam na rescisão (saldo de salário e 13º
 *    proporcional), cada uma usando seu próprio valor bruto (nunca somadas
 *    entre si nem ao salário do mês) — ver fonte no cabeçalho de
 *    payroll-tables.ts.
 *
 * LIMITAÇÃO DOCUMENTADA: calcula o INSS/IRRF do saldo de salário e do 13º
 * proporcional de forma isolada (não somados a outros rendimentos do mês) e
 * não substitui o Termo de Rescisão do Contrato de Trabalho (TRCT) oficial,
 * a homologação ou a orientação de um contador/sindicato/advogado.
 */

export type SeveranceDismissalType = "sem_justa_causa" | "pedido_demissao";

export interface SeveranceInput {
  /** Salário bruto mensal (R$). */
  grossSalary: number;
  dismissalType: SeveranceDismissalType;
  /** Anos completos de casa, usados para o aviso prévio proporcional (só "sem_justa_causa"). */
  completedYears: number;
  /** Dias trabalhados no mês da rescisão (0 a 30), para o saldo de salário. */
  workedDaysInMonth: number;
  /** Meses completos trabalhados no período aquisitivo atual de férias (0 a 12). */
  vacationProportionalMonths: number;
  /** Meses completos trabalhados no ano civil corrente, para o 13º proporcional (0 a 12). */
  thirteenthProportionalMonths: number;
  /** Se há férias vencidas (período aquisitivo completo, ainda não gozadas). */
  hasExpiredVacation: boolean;
  /** Saldo do FGTS depositado (R$), conforme extrato — opcional, usado só para a multa de 40%. */
  fgtsBalance: number;
  /** Número de dependentes para fins de IRRF. */
  dependents: number;
}

export interface SeveranceFieldErrors {
  grossSalary?: string;
  completedYears?: string;
  workedDaysInMonth?: string;
  vacationProportionalMonths?: string;
  thirteenthProportionalMonths?: string;
  fgtsBalance?: string;
  dependents?: string;
}

export interface SeveranceResult {
  /** Total líquido estimado a receber — resultado principal. */
  headline: number;
  balanceSalaryGross: number;
  balanceSalaryINSS: number;
  balanceSalaryIRRF: number;
  balanceSalaryNet: number;
  noticePeriodDays: number;
  noticePeriodAmount: number;
  expiredVacationAmount: number;
  proportionalVacationAmount: number;
  thirteenthGross: number;
  thirteenthINSS: number;
  thirteenthIRRF: number;
  thirteenthNet: number;
  fgtsFineAmount: number;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
}

export function validateSeveranceInput(input: SeveranceInput): SeveranceFieldErrors {
  const errors: SeveranceFieldErrors = {};

  if (!Number.isFinite(input.grossSalary) || input.grossSalary <= 0) {
    errors.grossSalary = "Informe um salário bruto maior que zero.";
  }
  if (
    !Number.isFinite(input.completedYears) ||
    !Number.isInteger(input.completedYears) ||
    input.completedYears < 0
  ) {
    errors.completedYears = "Informe um número de anos completos válido (0 ou mais).";
  }
  if (
    !Number.isFinite(input.workedDaysInMonth) ||
    !Number.isInteger(input.workedDaysInMonth) ||
    input.workedDaysInMonth < 0 ||
    input.workedDaysInMonth > 30
  ) {
    errors.workedDaysInMonth = "Informe os dias trabalhados no mês entre 0 e 30.";
  }
  if (
    !Number.isFinite(input.vacationProportionalMonths) ||
    !Number.isInteger(input.vacationProportionalMonths) ||
    input.vacationProportionalMonths < 0 ||
    input.vacationProportionalMonths > 12
  ) {
    errors.vacationProportionalMonths = "Informe um número de meses entre 0 e 12.";
  }
  if (
    !Number.isFinite(input.thirteenthProportionalMonths) ||
    !Number.isInteger(input.thirteenthProportionalMonths) ||
    input.thirteenthProportionalMonths < 0 ||
    input.thirteenthProportionalMonths > 12
  ) {
    errors.thirteenthProportionalMonths = "Informe um número de meses entre 0 e 12.";
  }
  if (!Number.isFinite(input.fgtsBalance) || input.fgtsBalance < 0) {
    errors.fgtsBalance = "O saldo do FGTS não pode ser negativo.";
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

export function isSeveranceInputValid(input: SeveranceInput): boolean {
  return Object.keys(validateSeveranceInput(input)).length === 0;
}

/** Aviso prévio proporcional (Lei nº 12.506/2011): 30 + 3 por ano completo, até 90. */
export function calculateNoticePeriodDays(completedYears: number): number {
  return Math.min(30 + 3 * completedYears, 90);
}

/**
 * Calcula as verbas rescisórias. Assume que `input` já foi validado (ver
 * validateSeveranceInput).
 */
export function calculateSeverance(input: SeveranceInput): SeveranceResult {
  const isWithoutCause = input.dismissalType === "sem_justa_causa";
  const dependentsDeduction = input.dependents * IRRF_DEPENDENT_DEDUCTION_2026;

  // Saldo de salário (tributável). A redução de IRRF de 2026 é aplicada de
  // forma isolada sobre o valor bruto do saldo de salário (não sobre o
  // salário integral do mês nem somada ao 13º proporcional).
  const balanceSalaryGross = (input.grossSalary / 30) * input.workedDaysInMonth;
  const balanceSalaryINSS = calculateINSS(balanceSalaryGross);
  const balanceSalaryIrrfCalculation = calculateIRRF2026(
    balanceSalaryGross,
    balanceSalaryINSS + dependentsDeduction
  );
  const balanceSalaryIRRF = balanceSalaryIrrfCalculation.finalTax;
  const balanceSalaryNet = balanceSalaryGross - balanceSalaryINSS - balanceSalaryIRRF;

  // Aviso prévio indenizado (só dispensa sem justa causa) — isento.
  const noticePeriodDays = isWithoutCause ? calculateNoticePeriodDays(input.completedYears) : 0;
  const noticePeriodAmount = isWithoutCause
    ? (input.grossSalary / 30) * noticePeriodDays
    : 0;

  // Férias vencidas + 1/3 — isento.
  const expiredVacationAmount = input.hasExpiredVacation
    ? input.grossSalary + input.grossSalary / 3
    : 0;

  // Férias proporcionais + 1/3 — isento.
  const proportionalVacationBase =
    (input.grossSalary / 12) * input.vacationProportionalMonths;
  const proportionalVacationAmount = proportionalVacationBase + proportionalVacationBase / 3;

  // 13º proporcional (tributável), também de forma isolada.
  const thirteenthGross = (input.grossSalary / 12) * input.thirteenthProportionalMonths;
  const thirteenthINSS = calculateINSS(thirteenthGross);
  const thirteenthIrrfCalculation = calculateIRRF2026(
    thirteenthGross,
    thirteenthINSS + dependentsDeduction
  );
  const thirteenthIRRF = thirteenthIrrfCalculation.finalTax;
  const thirteenthNet = thirteenthGross - thirteenthINSS - thirteenthIRRF;

  // Multa de 40% do FGTS (só dispensa sem justa causa, e só se o usuário
  // informar o saldo do FGTS a partir do extrato).
  const fgtsFineAmount = isWithoutCause ? input.fgtsBalance * FGTS_TERMINATION_FINE_RATE : 0;

  const totalGross =
    balanceSalaryGross +
    noticePeriodAmount +
    expiredVacationAmount +
    proportionalVacationAmount +
    thirteenthGross +
    fgtsFineAmount;

  const totalDeductions = balanceSalaryINSS + balanceSalaryIRRF + thirteenthINSS + thirteenthIRRF;
  const totalNet = totalGross - totalDeductions;

  return {
    headline: totalNet,
    balanceSalaryGross,
    balanceSalaryINSS,
    balanceSalaryIRRF,
    balanceSalaryNet,
    noticePeriodDays,
    noticePeriodAmount,
    expiredVacationAmount,
    proportionalVacationAmount,
    thirteenthGross,
    thirteenthINSS,
    thirteenthIRRF,
    thirteenthNet,
    fgtsFineAmount,
    totalGross,
    totalDeductions,
    totalNet,
  };
}
