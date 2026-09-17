/**
 * Tabelas e parâmetros legais trabalhistas/previdenciários usados pelas
 * calculadoras de Salário Líquido, Férias, 13º Salário, Custo de Funcionário
 * e Rescisão CLT.
 *
 * REGRA ESPECIAL DO PROJETO (ver docs/PROMPT_MESTRE_ALILU.md): tabelas que
 * mudam com o tempo (INSS, IRRF, salário mínimo) ficam CENTRALIZADAS aqui,
 * com o ano/referência e a fonte oficial documentados — nenhuma calculadora
 * deve embutir esses números diretamente.
 *
 * ==========================================================================
 * REFERÊNCIA: 2026 (vigente a partir de janeiro/2026)
 * ==========================================================================
 *
 * SALÁRIO MÍNIMO NACIONAL — R$ 1.621,00
 *   Fonte: Decreto nº 12.797, de 23 de dezembro de 2025 (Planalto),
 *   vigente a partir de 1º de janeiro de 2026.
 *   https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/decreto/d12797.htm
 *
 * TABELA DE CONTRIBUIÇÃO MENSAL DO INSS (empregado, doméstico e avulso) —
 * fatos geradores a partir de janeiro/2026 (tabela progressiva com parcela
 * a deduzir, mesmo modelo em vigor desde março/2020):
 *   Fonte: Portaria Interministerial MPS/MF nº 13, de 9 de janeiro de 2026
 *   (Ministério da Previdência Social), confirmada de forma independente na
 *   página oficial do INSS (gov.br/inss) e por fonte contábil especializada.
 *   https://www.gov.br/previdencia/pt-br/assuntos/rpps/destaques/publicada-a-portaria-interministerial-mps-mf-no-13-de-9-01-2026-que-dispoe-sobre-o-reajuste-dos-beneficios-pagos-pelo-inss-e-demais-valores
 *   https://www.gov.br/inss/pt-br/direitos-e-deveres/inscricao-e-contribuicao/tabela-de-contribuicao-mensal
 *
 * TABELA PROGRESSIVA MENSAL DO IRRF — vigente a partir de janeiro/2026
 *   Fonte oficial: Receita Federal do Brasil (conforme Lei nº 15.191, de 11
 *   de agosto de 2025).
 *   https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/tabelas/2026
 *
 * REDUÇÃO DO IRRF (ISENÇÃO EFETIVA ATÉ R$ 5.000 E FAIXA DE TRANSIÇÃO ATÉ
 * R$ 7.350) — vigente a partir de janeiro/2026 (art. 3º-A da Lei nº
 * 9.250/1995, incluído pela Lei nº 15.270, de 26 de novembro de 2025):
 *   Fonte oficial (texto de lei): Planalto —
 *   https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/lei/l15270.htm
 *   Fonte oficial (exemplos de cálculo confirmados pela Receita Federal):
 *   https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/tabelas/exemplos-de-aplicacao-da-lei-15-270-2025
 *   Confirmado de forma independente por fontes contábeis (Contabilizei,
 *   InfoMoney, Solides) com exemplos numéricos batendo com os 5 exemplos
 *   oficiais da Receita Federal reproduzidos abaixo.
 *
 *   Regra: para rendimentos tributáveis sujeitos à incidência mensal
 *   (o valor BRUTO do rendimento — salário, férias, 13º ou verba de
 *   rescisão — ANTES de descontar INSS/dependentes; os 5 exemplos oficiais
 *   da Receita usam sempre o valor bruto, nunca a base já com INSS
 *   descontado):
 *     - até R$ 5.000,00: reduz o IRRF calculado pela tabela progressiva de
 *       modo que o imposto devido seja ZERO;
 *     - de R$ 5.000,01 até R$ 7.350,00: reduz o IRRF calculado pela tabela
 *       progressiva no valor de R$ 978,62 − (0,133145 × rendimento bruto),
 *       decrescendo linearmente até zerar em R$ 7.350,00;
 *     - acima de R$ 7.350,00: nenhuma redução — vale a tabela progressiva
 *       normal.
 *   Esta redução é aplicada sobre o imposto já calculado pela tabela
 *   progressiva (não substitui a tabela, apenas reduz o valor devido).
 *   A Receita Federal confirmou explicitamente que a mesma redução se
 *   aplica a 13º salário e a férias, de forma isolada por rendimento (cada
 *   pagamento usa seu próprio valor bruto para a faixa/fórmula, nunca
 *   somado ao salário do mês) — e, na rescisão, às duas únicas verbas
 *   tributáveis que restam (saldo de salário e 13º proporcional).
 *
 * DESCONTO SIMPLIFICADO MENSAL DO IRRF — vigente a partir de janeiro/2026
 * (mesma Lei nº 15.270/2025): alternativa às deduções legais (INSS +
 * dependentes) para o cálculo da BASE do IRRF. O valor é fixo em
 * R$ 607,20/mês (25% do antigo limite de isenção da tabela, R$ 2.428,80) e
 * substitui INSS + dependentes (nunca soma aos dois). Usa-se sempre o que
 * for mais vantajoso ao contribuinte (a dedução que resultar em MENOR base
 * tributável, logo menor imposto) — ver exemplos oficiais na fonte da
 * Receita Federal acima. Esse desconto NÃO altera o valor de INSS
 * efetivamente retido do salário líquido (que é sempre o INSS real,
 * calculado pela tabela de contribuição): ele só decide qual dedução é
 * usada para chegar à base de cálculo do IRRF.
 *
 * Estas tabelas/regras devem ser revisadas sempre que uma nova Portaria/Lei
 * alterar os valores (normalmente todo mês de janeiro/maio). Não use estes
 * valores além de 2026 sem confirmar a regra vigente.
 */

export const PAYROLL_TABLE_REFERENCE_YEAR = 2026;

/** Salário mínimo nacional vigente (R$), a partir de 01/01/2026. */
export const MINIMUM_WAGE = 1621.0;

export interface ProgressiveBracket {
  /** Limite superior da faixa (R$). `Infinity` para a última faixa. */
  upTo: number;
  /** Alíquota da faixa (fração, ex.: 0.075 = 7,5%). */
  rate: number;
  /** Parcela a deduzir (R$), já calculada para manter a progressividade contínua entre faixas. */
  deduction: number;
}

/**
 * Tabela de contribuição mensal do INSS para empregados (2026). Ver fonte
 * no cabeçalho do arquivo. O cálculo usa alíquota efetiva com parcela a
 * deduzir (mesma fórmula usada oficialmente desde a Lei nº 13.982/2020):
 *   contribuição = salário-de-contribuição × alíquota da faixa − parcela a deduzir
 */
export const INSS_TABLE_2026: ProgressiveBracket[] = [
  { upTo: 1621.0, rate: 0.075, deduction: 0 },
  { upTo: 2902.84, rate: 0.09, deduction: 24.32 },
  { upTo: 4354.27, rate: 0.12, deduction: 111.4 },
  { upTo: 8475.55, rate: 0.14, deduction: 198.49 },
];

/** Teto do salário-de-contribuição do INSS (2026). Acima disso, o desconto não aumenta. */
export const INSS_CONTRIBUTION_CEILING_2026 = 8475.55;

/**
 * Calcula o desconto de INSS sobre um salário-de-contribuição, pela tabela
 * de 2026. Salários acima do teto usam o teto (o desconto máximo é fixo).
 */
export function calculateINSS(grossSalary: number): number {
  if (!Number.isFinite(grossSalary) || grossSalary <= 0) {
    return 0;
  }

  const base = Math.min(grossSalary, INSS_CONTRIBUTION_CEILING_2026);
  const bracket = INSS_TABLE_2026.find((row) => base <= row.upTo) ?? INSS_TABLE_2026[INSS_TABLE_2026.length - 1];
  const value = base * bracket.rate - bracket.deduction;
  return Math.max(value, 0);
}

/**
 * Tabela progressiva mensal do IRRF (2026). Ver fonte no cabeçalho do
 * arquivo. Fórmula: imposto = base de cálculo × alíquota da faixa − parcela
 * a deduzir (0 para a faixa isenta).
 */
export const IRRF_TABLE_2026: ProgressiveBracket[] = [
  { upTo: 2428.8, rate: 0, deduction: 0 },
  { upTo: 2826.65, rate: 0.075, deduction: 182.16 },
  { upTo: 3751.05, rate: 0.15, deduction: 394.16 },
  { upTo: 4664.68, rate: 0.225, deduction: 675.49 },
  { upTo: Infinity, rate: 0.275, deduction: 908.73 },
];

/** Dedução mensal por dependente, para fins de IRRF (2026). */
export const IRRF_DEPENDENT_DEDUCTION_2026 = 189.59;

/**
 * Calcula o IRRF aplicando SOMENTE a tabela progressiva mensal (2026) sobre
 * uma base de cálculo já pronta (o valor após a dedução escolhida). Nunca
 * retorna valor negativo.
 *
 * Esta função é um bloco de construção interno — não inclui a redução de
 * IRRF da Lei nº 15.270/2025 nem a escolha entre dedução legal e desconto
 * simplificado. Para o cálculo completo (o que toda calculadora do site
 * deve usar), use `calculateIRRF2026`.
 */
export function calculateIRRFFromTable(taxableBase: number): number {
  if (!Number.isFinite(taxableBase) || taxableBase <= 0) {
    return 0;
  }

  const bracket = IRRF_TABLE_2026.find((row) => taxableBase <= row.upTo)!;
  const value = taxableBase * bracket.rate - bracket.deduction;
  return Math.max(value, 0);
}

/**
 * Desconto simplificado mensal do IRRF (2026): alternativa fixa às deduções
 * legais (INSS + dependentes) para a base de cálculo do IRRF. Ver fonte e
 * regra completas no cabeçalho do arquivo.
 */
export const IRRF_SIMPLIFIED_MONTHLY_DISCOUNT_2026 = 607.2;

/** Limite de rendimento bruto (R$) até o qual o IRRF é integralmente reduzido a zero (2026). */
export const IRRF_REDUCTION_FULL_EXEMPTION_CEILING_2026 = 5000.0;

/** Limite de rendimento bruto (R$) acima do qual a redução deixa de existir (2026). */
export const IRRF_REDUCTION_PHASE_OUT_CEILING_2026 = 7350.0;

/** Constante da fórmula de redução na faixa de transição (2026): reducao = CONSTANTE − COEFICIENTE × rendimento bruto. */
export const IRRF_REDUCTION_CONSTANT_2026 = 978.62;

/** Coeficiente da fórmula de redução na faixa de transição (2026). */
export const IRRF_REDUCTION_COEFFICIENT_2026 = 0.133145;

export interface Irrf2026Calculation {
  /** Rendimento bruto tributável deste pagamento (salário, férias, 13º ou verba de rescisão), usado para a faixa/fórmula de redução. */
  grossAmount: number;
  /** Dedução legal (INSS + dependentes) disponível para este pagamento. */
  legalDeduction: number;
  /** Desconto simplificado mensal (fixo, 2026). */
  simplifiedDiscount: number;
  /** true quando o desconto simplificado é mais vantajoso que a dedução legal (maior dedução = menor base). */
  simplifiedDiscountChosen: boolean;
  /** Dedução efetivamente usada (a maior entre legal e simplificada). */
  deductionUsed: number;
  /** Base de cálculo do IRRF (rendimento bruto − dedução usada, nunca negativa). */
  taxableBase: number;
  /** IRRF pela tabela progressiva, antes da redução da Lei nº 15.270/2025. */
  taxBeforeReduction: number;
  /** Valor da redução aplicada (Lei nº 15.270/2025). */
  reduction: number;
  /** IRRF final devido, já com a redução aplicada. Nunca negativo. */
  finalTax: number;
}

/**
 * Calcula o IRRF mensal completo (2026): escolhe a dedução mais vantajosa
 * entre a legal (INSS + dependentes, informada pelo chamador) e o desconto
 * simplificado fixo, aplica a tabela progressiva e, por fim, aplica a
 * redução da Lei nº 15.270/2025 conforme o rendimento BRUTO deste
 * pagamento. Esta é a função que toda calculadora do site deve usar para
 * IRRF — ver fontes e regra completa no cabeçalho do arquivo.
 *
 * `legalDeduction` é o total das deduções legais disponíveis para ESTE
 * rendimento (tipicamente INSS calculado sobre o mesmo valor bruto, mais
 * a dedução por dependentes) — o chamador decide o que compõe essa soma
 * para o rendimento em questão (salário, férias, 13º ou verba de rescisão).
 */
export function calculateIRRF2026(
  grossAmount: number,
  legalDeduction: number
): Irrf2026Calculation {
  const safeGross = Number.isFinite(grossAmount) && grossAmount > 0 ? grossAmount : 0;
  const safeLegalDeduction =
    Number.isFinite(legalDeduction) && legalDeduction > 0 ? legalDeduction : 0;

  if (safeGross === 0) {
    return {
      grossAmount: 0,
      legalDeduction: safeLegalDeduction,
      simplifiedDiscount: IRRF_SIMPLIFIED_MONTHLY_DISCOUNT_2026,
      simplifiedDiscountChosen: false,
      deductionUsed: 0,
      taxableBase: 0,
      taxBeforeReduction: 0,
      reduction: 0,
      finalTax: 0,
    };
  }

  const simplifiedDiscountChosen = IRRF_SIMPLIFIED_MONTHLY_DISCOUNT_2026 > safeLegalDeduction;
  const deductionUsed = Math.max(safeLegalDeduction, IRRF_SIMPLIFIED_MONTHLY_DISCOUNT_2026);
  const taxableBase = Math.max(safeGross - deductionUsed, 0);
  const taxBeforeReduction = calculateIRRFFromTable(taxableBase);

  let reduction = 0;
  if (safeGross <= IRRF_REDUCTION_FULL_EXEMPTION_CEILING_2026) {
    reduction = taxBeforeReduction;
  } else if (safeGross <= IRRF_REDUCTION_PHASE_OUT_CEILING_2026) {
    reduction = Math.max(
      IRRF_REDUCTION_CONSTANT_2026 - IRRF_REDUCTION_COEFFICIENT_2026 * safeGross,
      0
    );
  }

  const finalTax = Math.max(taxBeforeReduction - reduction, 0);

  return {
    grossAmount: safeGross,
    legalDeduction: safeLegalDeduction,
    simplifiedDiscount: IRRF_SIMPLIFIED_MONTHLY_DISCOUNT_2026,
    simplifiedDiscountChosen,
    deductionUsed,
    taxableBase,
    taxBeforeReduction,
    reduction,
    finalTax,
  };
}

/**
 * Alíquota do FGTS sobre a remuneração mensal (8%), fixada pelo art. 15 da
 * Lei nº 8.036/1990 — não é uma tabela que muda anualmente.
 */
export const FGTS_RATE = 0.08;

/**
 * Multa rescisória do FGTS em caso de dispensa sem justa causa (40% sobre o
 * saldo do FGTS depositado durante o contrato), conforme art. 18, §1º, da
 * Lei nº 8.036/1990.
 */
export const FGTS_TERMINATION_FINE_RATE = 0.4;

/**
 * INSS patronal (parte da empresa) sobre a folha, no regime geral (Lucro
 * Presumido/Real), conforme art. 22, I, da Lei nº 8.212/1991 — alíquota
 * estrutural, não é revista anualmente como a tabela do empregado.
 * Empresas do Simples Nacional normalmente já recolhem este valor de forma
 * unificada pelo DAS (a alíquota efetiva varia por anexo/faixa).
 */
export const EMPLOYER_INSS_RATE = 0.2;

/**
 * Contribuição a terceiros/"Sistema S" (SESI/SESC/SENAI/SENAC, salário-
 * educação, INCRA etc.), percentual combinado tipicamente citado por
 * contadores para empresas comerciais/industriais do regime geral. Varia
 * conforme o CNAE da empresa — por isso é exposto como um valor SUGERIDO e
 * editável, nunca aplicado silenciosamente.
 */
export const EMPLOYER_THIRD_PARTY_CONTRIBUTIONS_SUGGESTED_RATE = 0.058;
