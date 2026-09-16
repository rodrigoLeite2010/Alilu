/**
 * Contrato comum que toda calculadora futura deve seguir.
 *
 * Nesta primeira entrega (Fundação ALILU) nenhuma calculadora foi
 * implementada ainda — este arquivo existe apenas para fixar o contrato que
 * lib/calculators/<nome-da-calculadora>.ts deverá implementar, mantendo a
 * lógica matemática sempre separada da interface (PROMPT MESTRE, seção 14).
 */

export interface CalculatorResult<TDetails = Record<string, number>> {
  /** Valor principal, exibido com destaque no resultado da ferramenta */
  headline: number;
  /** Valores complementares do detalhamento do resultado */
  details: TDetails;
  /** Premissas e limitações que devem ser exibidas ao usuário, quando houver */
  assumptions?: string[];
}
