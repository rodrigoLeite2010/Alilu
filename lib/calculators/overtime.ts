/**
 * Lógica de cálculo da Calculadora de Hora Extra, isolada da interface (ver
 * PROMPT MESTRE, seção 14). Todo o processamento é síncrono e client-side.
 *
 * REGRAS UTILIZADAS (não dependem de tabela que muda todo ano — são regras
 * consolidadas de jurisprudência/Constituição, por isso podem ser
 * implementadas com segurança):
 *
 *  - Valor da hora normal = salário mensal / divisor de horas mensais.
 *    O divisor padrão de mercado (e usado por bancos de horas e folhas de
 *    pagamento) é (jornada semanal em horas) × 5 — ex.: 44h semanais => 220,
 *    40h semanais => 200, 36h => 180. Este é o mesmo divisor confirmado pela
 *    Súmula 431 do TST para jornada de 40h (divisor 200) e consolidado na
 *    prática para 44h (divisor 220).
 *  - Adicional mínimo de hora extra: 50% sobre a hora normal, por força do
 *    art. 7º, XVI, da Constituição Federal ("remuneração do serviço
 *    extraordinário superior, no mínimo, em 50% à do normal"). Convenções
 *    coletivas podem prever adicional maior (comum: 100% para horas em
 *    domingos/feriados) — por isso o percentual é um campo livre, com 50%
 *    sugerido como padrão.
 *
 * Esta calculadora NÃO aplica o divisor de nenhuma categoria com regra
 * própria (ex.: bancários com jornada de 6h) além do que o usuário
 * configurar manualmente na jornada semanal.
 */

export interface OvertimeInput {
  /** Salário mensal bruto (R$). */
  monthlySalary: number;
  /** Jornada semanal em horas (usada para calcular o divisor mensal: jornada x 5). */
  weeklyHours: number;
  /** Quantidade de horas extras trabalhadas no período. */
  overtimeHours: number;
  /** Adicional de hora extra (%), ex.: 50 ou 100. */
  overtimePercent: number;
}

export interface OvertimeFieldErrors {
  monthlySalary?: string;
  weeklyHours?: string;
  overtimeHours?: string;
  overtimePercent?: string;
}

export interface OvertimeResult {
  /** Valor total das horas extras (R$) — resultado principal. */
  headline: number;
  /** Divisor mensal de horas usado (jornada semanal x 5). */
  monthlyHoursDivisor: number;
  /** Valor da hora normal (R$). */
  normalHourValue: number;
  /** Valor da hora extra, já com o adicional (R$). */
  overtimeHourValue: number;
  /** Valor apenas do adicional (sem a hora normal), para detalhamento. */
  additionalOnlyValue: number;
}

export function validateOvertimeInput(input: OvertimeInput): OvertimeFieldErrors {
  const errors: OvertimeFieldErrors = {};

  if (!Number.isFinite(input.monthlySalary) || input.monthlySalary <= 0) {
    errors.monthlySalary = "Informe um salário mensal maior que zero.";
  }
  if (!Number.isFinite(input.weeklyHours) || input.weeklyHours <= 0) {
    errors.weeklyHours = "Informe uma jornada semanal maior que zero.";
  } else if (input.weeklyHours > 44) {
    errors.weeklyHours = "A jornada semanal não pode ser maior que 44 horas (limite constitucional, art. 7º, XIII).";
  }
  if (!Number.isFinite(input.overtimeHours) || input.overtimeHours < 0) {
    errors.overtimeHours = "A quantidade de horas extras não pode ser negativa.";
  }
  if (!Number.isFinite(input.overtimePercent) || input.overtimePercent < 50) {
    errors.overtimePercent = "O adicional de hora extra não pode ser menor que 50% (mínimo constitucional).";
  }

  return errors;
}

export function isOvertimeInputValid(input: OvertimeInput): boolean {
  return Object.keys(validateOvertimeInput(input)).length === 0;
}

/**
 * Calcula o valor das horas extras. Assume que `input` já foi validado (ver
 * validateOvertimeInput).
 */
export function calculateOvertime(input: OvertimeInput): OvertimeResult {
  const monthlyHoursDivisor = input.weeklyHours * 5;
  const normalHourValue = input.monthlySalary / monthlyHoursDivisor;
  const overtimeHourValue = normalHourValue * (1 + input.overtimePercent / 100);
  const additionalOnlyValue = overtimeHourValue - normalHourValue;
  const headline = overtimeHourValue * input.overtimeHours;

  return {
    headline,
    monthlyHoursDivisor,
    normalHourValue,
    overtimeHourValue,
    additionalOnlyValue,
  };
}
