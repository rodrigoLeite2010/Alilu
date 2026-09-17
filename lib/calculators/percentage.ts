/**
 * Lógica de cálculo da Calculadora de Porcentagem, isolada da interface (ver
 * PROMPT MESTRE, seção 14). Todo o processamento é síncrono e client-side:
 * nenhum valor digitado é enviado para servidor ou armazenado.
 *
 * Cinco modos independentes, cada um com sua própria validação e fórmula:
 *  - "percent-of": X% de Y.
 *  - "what-percent": X representa quantos % de Y.
 *  - "increase": aumentar Y em X%.
 *  - "decrease": reduzir Y em X%.
 *  - "variation": variação percentual entre um valor inicial e um valor final.
 */

export type PercentageMode =
  | "percent-of"
  | "what-percent"
  | "increase"
  | "decrease"
  | "variation";

export interface PercentageInput {
  mode: PercentageMode;
  /** Percentual (X), usado em "percent-of", "increase" e "decrease". */
  percent: number;
  /** Valor base (Y), usado em "percent-of", "increase" e "decrease". */
  base: number;
  /** Parte, usada em "what-percent" (X representa quantos % de Y). */
  part: number;
  /** Valor inicial, usado em "variation". */
  fromValue: number;
  /** Valor final, usado em "variation". */
  toValue: number;
}

export interface PercentageFieldErrors {
  percent?: string;
  base?: string;
  part?: string;
  fromValue?: string;
  toValue?: string;
}

export interface PercentageResult {
  mode: PercentageMode;
  /** Resultado principal, com o significado dependendo do modo:
   *  - percent-of: o valor de X% de Y.
   *  - what-percent: o percentual que a parte representa da base.
   *  - increase/decrease: o novo valor após o ajuste.
   *  - variation: a variação percentual entre os dois valores (pode ser negativa).
   */
  headline: number;
  /** Detalhes complementares (diferença absoluta, quando aplicável). */
  difference?: number;
}

export function validatePercentageInput(
  input: PercentageInput
): PercentageFieldErrors {
  const errors: PercentageFieldErrors = {};

  switch (input.mode) {
    case "percent-of":
    case "increase":
    case "decrease": {
      if (!Number.isFinite(input.percent)) {
        errors.percent = "Informe um percentual válido.";
      }
      if (!Number.isFinite(input.base)) {
        errors.base = "Informe um valor válido.";
      }
      break;
    }
    case "what-percent": {
      if (!Number.isFinite(input.part)) {
        errors.part = "Informe um valor válido.";
      }
      if (!Number.isFinite(input.base)) {
        errors.base = "Informe um valor válido.";
      } else if (input.base === 0) {
        errors.base = "O valor de referência não pode ser zero.";
      }
      break;
    }
    case "variation": {
      if (!Number.isFinite(input.fromValue)) {
        errors.fromValue = "Informe um valor inicial válido.";
      } else if (input.fromValue === 0) {
        errors.fromValue = "O valor inicial não pode ser zero.";
      }
      if (!Number.isFinite(input.toValue)) {
        errors.toValue = "Informe um valor final válido.";
      }
      break;
    }
  }

  return errors;
}

export function isPercentageInputValid(input: PercentageInput): boolean {
  return Object.keys(validatePercentageInput(input)).length === 0;
}

/**
 * Calcula o resultado do modo selecionado. Assume que `input` já foi
 * validado (ver validatePercentageInput) — não lança erro para entradas
 * inválidas, mas o resultado não tem significado para elas.
 */
export function calculatePercentage(input: PercentageInput): PercentageResult {
  switch (input.mode) {
    case "percent-of": {
      const headline = (input.percent / 100) * input.base;
      return { mode: input.mode, headline };
    }
    case "what-percent": {
      const headline = (input.part / input.base) * 100;
      return { mode: input.mode, headline };
    }
    case "increase": {
      const headline = input.base * (1 + input.percent / 100);
      return { mode: input.mode, headline, difference: headline - input.base };
    }
    case "decrease": {
      const headline = input.base * (1 - input.percent / 100);
      return { mode: input.mode, headline, difference: headline - input.base };
    }
    case "variation": {
      const headline = ((input.toValue - input.fromValue) / Math.abs(input.fromValue)) * 100;
      return {
        mode: input.mode,
        headline,
        difference: input.toValue - input.fromValue,
      };
    }
  }
}
