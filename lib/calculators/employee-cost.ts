import {
  EMPLOYER_INSS_RATE,
  EMPLOYER_THIRD_PARTY_CONTRIBUTIONS_SUGGESTED_RATE,
  FGTS_RATE,
} from "@/lib/calculators/payroll-tables";

/**
 * Lógica de cálculo da Calculadora de Custo de Funcionário, isolada da
 * interface (ver PROMPT MESTRE, seção 14). Todo o processamento é síncrono
 * e client-side.
 *
 * REGIME TRIBUTÁRIO: esta calculadora NUNCA presume um regime — o usuário
 * escolhe explicitamente entre três opções:
 *  - "geral": empresas do Lucro Presumido/Real, que recolhem INSS patronal
 *    (20% — art. 22, I, Lei nº 8.212/1991), RAT (1% a 3%, conforme grau de
 *    risco da atividade) e contribuições a terceiros/"Sistema S" (percentual
 *    sugerido e editável, pois varia por CNAE) separadamente sobre a folha.
 *  - "simples_anexo_iv": empresas do Simples Nacional enquadradas no ANEXO
 *    IV (ex.: construção civil, limpeza, vigilância, alguns serviços). Ao
 *    contrário dos demais anexos, o Anexo IV NÃO tem a Contribuição
 *    Previdenciária Patronal (CPP) embutida na alíquota unificada do DAS —
 *    a empresa recolhe o INSS patronal (20%) e o RAT (1% a 3%) SEPARADAMENTE,
 *    da mesma forma que o regime geral. As contribuições a terceiros/
 *    "Sistema S", porém, NUNCA são cobradas de nenhuma empresa do Simples
 *    Nacional, nem mesmo do Anexo IV.
 *    Fonte oficial: Receita Federal do Brasil —
 *    https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/tributos/simples-nacional
 *    Confirmado de forma independente por fonte contábil especializada
 *    (Confirp Contabilidade, "Simples Nacional Anexo IV: como funciona").
 *  - "simples_outros": empresas do Simples Nacional nos demais anexos (I,
 *    II, III e V), cujo INSS patronal, RAT e contribuições a terceiros já
 *    estão TODOS embutidos na alíquota unificada do DAS — por isso esses
 *    três itens são exibidos como R$ 0,00 e uma observação explica o
 *    motivo, para não contar o mesmo encargo duas vezes.
 *
 * Em todos os regimes, o FGTS (8%, art. 15 da Lei nº 8.036/1990) incide
 * separadamente sobre a folha e sobre as provisões de férias/13º.
 *
 * PROVISÕES: as provisões mensais de férias (+ 1/3) e de 13º salário são
 * estimativas contábeis do custo médio mensal desses direitos (1/12 do
 * valor anual de cada um), não um desconto do salário do funcionário.
 *
 * BASE DE INCIDÊNCIA DE CPP/RAT/TERCEIROS (corrigido — auditoria): o INSS
 * patronal (CPP), o RAT e as contribuições a terceiros não incidem apenas
 * sobre o salário do mês — incidem também sobre o 13º salário e sobre as
 * férias efetivamente gozadas (+ o respectivo terço constitucional), pois
 * essas verbas integram a remuneração paga ao trabalhador ao longo do ano
 * (art. 22, I, Lei nº 8.212/1991: a CPP incide sobre "o total das
 * remunerações pagas, devidas ou creditadas a qualquer título... destinadas
 * a retribuir o trabalho", o que inclui 13º e férias gozadas + terço).
 * Como esta calculadora já provisiona o custo médio MENSAL de 13º e férias
 * (1/12 do valor anual de cada um, ver acima), a forma consistente de
 * refletir esse encargo adicional é aplicar as mesmas alíquotas de
 * CPP/RAT/terceiros sobre a MESMA base provisionada (salário do mês +
 * provisão de 13º + provisão de férias gozadas + provisão do terço sobre
 * elas), e não apenas sobre o salário do mês — do contrário o custo mensal
 * médio fica subestimado, pois ignora o CPP/RAT/terceiros que a empresa
 * efetivamente paga sobre o 13º e as férias quando são desembolsados.
 * Confirmado de forma independente por fonte contábil especializada
 * (Contabilizei/IOB, "Encargos sociais sobre férias e 13º salário").
 * Aplica-se aos regimes que recolhem CPP/RAT separadamente ("geral" e
 * "simples_anexo_iv"); as contribuições a terceiros seguem restritas ao
 * regime "geral", pois nunca são cobradas de empresas do Simples Nacional.
 */

export type EmployeeCostRegime = "geral" | "simples_anexo_iv" | "simples_outros";

export interface EmployeeCostInput {
  /** Salário bruto mensal (R$). */
  grossSalary: number;
  regime: EmployeeCostRegime;
  /**
   * Alíquota de RAT (Risco Ambiental do Trabalho): 1%, 2% ou 3%. Usado nos
   * regimes "geral" e "simples_anexo_iv" (o Anexo IV recolhe RAT separado).
   */
  ratPercent: number;
  /** Contribuições a terceiros/"Sistema S" (%), sugerido e editável. Só usado no regime "geral". */
  thirdPartyPercent: number;
  /** Benefícios mensais informados (vale-transporte, vale-refeição, plano de saúde etc.), em R$. */
  monthlyBenefits: number;
}

export interface EmployeeCostFieldErrors {
  grossSalary?: string;
  ratPercent?: string;
  thirdPartyPercent?: string;
  monthlyBenefits?: string;
}

export interface EmployeeCostResult {
  /** Custo total estimado da empresa com o funcionário no mês — resultado principal. */
  headline: number;
  grossSalary: number;
  /** Base de incidência de CPP/RAT/terceiros: salário do mês + provisões tributáveis de 13º e férias (gozadas + terço). */
  chargesBase: number;
  employerINSS: number;
  rat: number;
  thirdParty: number;
  fgtsOnSalary: number;
  vacationProvision: number;
  vacationOneThirdProvision: number;
  thirteenthProvision: number;
  fgtsOnProvisions: number;
  monthlyBenefits: number;
  totalCharges: number;
}

export function validateEmployeeCostInput(
  input: EmployeeCostInput
): EmployeeCostFieldErrors {
  const errors: EmployeeCostFieldErrors = {};

  if (!Number.isFinite(input.grossSalary) || input.grossSalary <= 0) {
    errors.grossSalary = "Informe um salário bruto maior que zero.";
  }
  const chargesCPPAndRAT = input.regime === "geral" || input.regime === "simples_anexo_iv";
  if (
    chargesCPPAndRAT &&
    (!Number.isFinite(input.ratPercent) || input.ratPercent < 1 || input.ratPercent > 3)
  ) {
    errors.ratPercent = "O RAT deve ser 1%, 2% ou 3%, conforme o grau de risco da atividade.";
  }
  if (
    input.regime === "geral" &&
    (!Number.isFinite(input.thirdPartyPercent) || input.thirdPartyPercent < 0)
  ) {
    errors.thirdPartyPercent = "As contribuições a terceiros não podem ser negativas.";
  }
  if (!Number.isFinite(input.monthlyBenefits) || input.monthlyBenefits < 0) {
    errors.monthlyBenefits = "Os benefícios mensais não podem ser negativos.";
  }

  return errors;
}

export function isEmployeeCostInputValid(input: EmployeeCostInput): boolean {
  return Object.keys(validateEmployeeCostInput(input)).length === 0;
}

/**
 * Calcula o custo estimado total do funcionário. Assume que `input` já foi
 * validado (ver validateEmployeeCostInput).
 */
export function calculateEmployeeCost(input: EmployeeCostInput): EmployeeCostResult {
  const isGeneral = input.regime === "geral";
  // Simples Nacional Anexo IV recolhe CPP (INSS patronal) e RAT separados,
  // fora do DAS — só as contribuições a terceiros ficam sempre de fora do
  // Simples Nacional, em qualquer anexo.
  const chargesCPPAndRAT = isGeneral || input.regime === "simples_anexo_iv";

  const vacationProvision = input.grossSalary / 12;
  const vacationOneThirdProvision = vacationProvision / 3;
  const thirteenthProvision = input.grossSalary / 12;

  // CPP, RAT e terceiros incidem sobre o salário do mês + as provisões
  // tributáveis de 13º e férias (gozadas + terço) — ver cabeçalho do
  // arquivo. Sem isso, o custo mensal médio subestima o que a empresa
  // efetivamente paga de encargos ao longo do ano.
  const chargesBase =
    input.grossSalary + vacationProvision + vacationOneThirdProvision + thirteenthProvision;

  const employerINSS = chargesCPPAndRAT ? chargesBase * EMPLOYER_INSS_RATE : 0;
  const rat = chargesCPPAndRAT ? chargesBase * (input.ratPercent / 100) : 0;
  const thirdParty = isGeneral ? chargesBase * (input.thirdPartyPercent / 100) : 0;

  const fgtsOnSalary = input.grossSalary * FGTS_RATE;
  const fgtsOnProvisions =
    (vacationProvision + vacationOneThirdProvision + thirteenthProvision) * FGTS_RATE;

  const totalCharges =
    employerINSS +
    rat +
    thirdParty +
    fgtsOnSalary +
    vacationProvision +
    vacationOneThirdProvision +
    thirteenthProvision +
    fgtsOnProvisions;

  const headline = input.grossSalary + totalCharges + input.monthlyBenefits;

  return {
    headline,
    grossSalary: input.grossSalary,
    chargesBase,
    employerINSS,
    rat,
    thirdParty,
    fgtsOnSalary,
    vacationProvision,
    vacationOneThirdProvision,
    thirteenthProvision,
    fgtsOnProvisions,
    monthlyBenefits: input.monthlyBenefits,
    totalCharges,
  };
}

export const EMPLOYEE_COST_SUGGESTED_THIRD_PARTY_PERCENT =
  EMPLOYER_THIRD_PARTY_CONTRIBUTIONS_SUGGESTED_RATE * 100;
