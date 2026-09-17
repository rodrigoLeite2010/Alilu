/**
 * Geração de números de cartão SINTÉTICOS, exclusivamente para testar
 * máscaras de entrada e validações de formulário (ETAPA 5 da categoria
 * Geradores, ex-"Devs"). Mantido isolado da interface (PROMPT MESTRE, seção 14).
 *
 * RESTRIÇÕES DE SEGURANÇA (aplicadas em todo este arquivo):
 *  - Nunca gera nem aceita validade (mês/ano) ou CVV — apenas o número do
 *    cartão. Não existe, em nenhuma função deste arquivo, geração de uma
 *    combinação "número + validade + CVV" que possa simular uma credencial
 *    completa de pagamento.
 *  - Nunca consulta saldo, autorização, gateways de pagamento (de produção
 *    ou sandbox) nem verifica se um número está "ativo".
 *  - Nunca usa dados de titulares reais (nenhum nome é gerado ou aceito).
 *  - Nenhum número gerado é armazenado — cada chamada é independente, sem
 *    histórico, cache ou log.
 *  - O modo "oficial" prioriza números de teste PUBLICAMENTE DOCUMENTADOS
 *    por processadores de pagamento (fonte: documentação pública de teste
 *    da Stripe, https://docs.stripe.com/testing, que reproduz os números de
 *    teste reservados pelas próprias bandeiras — Visa, Mastercard, American
 *    Express e Discover). O modo "sintético" gera números aleatórios que
 *    apenas seguem o padrão de comprimento e o dígito de bandeira de cada
 *    rede (não são números de nenhuma faixa real de banco emissor) e nunca
 *    é apresentado como um número reconhecido por nenhum provedor de
 *    pagamento ou sandbox.
 */

import { secureRandomInt, secureRandomDigit } from "@/lib/random/secure-random";

export type CardBrand = "visa" | "mastercard" | "amex" | "discover";

export const CARD_BRAND_LABELS: Record<CardBrand, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  discover: "Discover",
};

/** Quantidade máxima de cartões que podem ser gerados em um único lote. */
export const CREDIT_CARD_GENERATOR_MAX_BATCH = 50;

interface CardTemplate {
  brand: CardBrand;
  length: number;
  /** Prefixos de rede (identificam a bandeira, não um banco emissor real). */
  prefixes: string[];
}

const CARD_TEMPLATES: Record<CardBrand, CardTemplate> = {
  visa: { brand: "visa", length: 16, prefixes: ["4"] },
  mastercard: { brand: "mastercard", length: 16, prefixes: ["51", "52", "53", "54", "55"] },
  amex: { brand: "amex", length: 15, prefixes: ["34", "37"] },
  discover: { brand: "discover", length: 16, prefixes: ["6011"] },
};

export interface OfficialTestCard {
  brand: CardBrand;
  number: string;
  description: string;
}

/**
 * Números de teste publicamente documentados por processadores de
 * pagamento (não são números sorteados por este gerador). Fonte: Stripe —
 * "Números de cartão de teste" (docs.stripe.com/testing), que reproduz os
 * números de teste reservados pelas próprias bandeiras.
 */
export const OFFICIAL_TEST_CARDS: OfficialTestCard[] = [
  { brand: "visa", number: "4242424242424242", description: "Visa — número de teste padrão" },
  { brand: "visa", number: "4000056655665556", description: "Visa (débito) — número de teste" },
  { brand: "mastercard", number: "5555555555554444", description: "Mastercard — número de teste padrão" },
  { brand: "mastercard", number: "2223003122003222", description: "Mastercard (série 2) — número de teste" },
  { brand: "amex", number: "378282246310005", description: "American Express — número de teste padrão" },
  { brand: "discover", number: "6011111111111117", description: "Discover — número de teste padrão" },
];

export type CreditCardGeneratorMode = "official" | "synthetic";

export interface CreditCardGeneratorInput {
  mode: CreditCardGeneratorMode;
  /** Bandeira desejada, ou "any" para sortear entre todas. */
  brand: CardBrand | "any";
  count: number;
  /** true => com espaços (ex.: "4242 4242 4242 4242"); false => só dígitos. */
  formatted: boolean;
}

export interface CreditCardGeneratorFieldErrors {
  count?: string;
}

export interface GeneratedCard {
  brand: CardBrand;
  number: string;
  /** Presente apenas no modo "official": descrição da fonte do número. */
  source?: string;
}

/**
 * Calcula o dígito verificador de Luhn para os dígitos informados (sem o
 * próprio dígito verificador), retornando o dígito que precisa ser
 * acrescentado ao final para o número completo passar no algoritmo de
 * Luhn.
 */
export function calculateLuhnCheckDigit(partialDigits: number[]): number {
  let sum = 0;
  const len = partialDigits.length;
  for (let i = 0; i < len; i += 1) {
    const offsetFromRight = len - 1 - i;
    let digit = partialDigits[i];
    if (offsetFromRight % 2 === 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return (10 - (sum % 10)) % 10;
}

/**
 * Valida um número completo (incluindo o dígito verificador) pelo
 * algoritmo de Luhn. O algoritmo de Luhn verifica apenas a estrutura
 * matemática do número — não indica que o cartão exista, esteja ativo ou
 * tenha sido emitido por um banco.
 */
export function isValidLuhn(digits: string): boolean {
  if (!/^\d+$/.test(digits) || digits.length < 2) {
    return false;
  }

  const nums = digits.split("").map(Number);
  let sum = 0;
  const len = nums.length;
  for (let i = 0; i < len; i += 1) {
    const offsetFromRight = len - 1 - i;
    let digit = nums[i];
    if (offsetFromRight % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

/**
 * Gera um número de cartão SINTÉTICO, Luhn-válido, seguindo apenas o
 * comprimento e o dígito de rede (bandeira) do padrão informado — nunca uma
 * faixa real de banco emissor. Não deve ser apresentado como um número de
 * sandbox reconhecido por nenhum provedor de pagamento.
 */
export function generateSyntheticCardNumber(brand: CardBrand): string {
  const template = CARD_TEMPLATES[brand];
  const prefix = template.prefixes[secureRandomInt(template.prefixes.length)];
  const middleLength = template.length - prefix.length - 1;

  let middle = "";
  for (let i = 0; i < middleLength; i += 1) {
    middle += String(secureRandomDigit());
  }

  const partial = `${prefix}${middle}`.split("").map(Number);
  const checkDigit = calculateLuhnCheckDigit(partial);

  return `${prefix}${middle}${checkDigit}`;
}

/** Agrupa os dígitos com espaços (4-6-5 para Amex; 4-4-4-4 para as demais). */
export function formatCardNumber(digits: string, brand: CardBrand): string {
  if (brand === "amex") {
    return `${digits.slice(0, 4)} ${digits.slice(4, 10)} ${digits.slice(10, 15)}`;
  }
  return digits.match(/.{1,4}/g)?.join(" ") ?? digits;
}

function pickRandomBrand(): CardBrand {
  const brands: CardBrand[] = ["visa", "mastercard", "amex", "discover"];
  return brands[secureRandomInt(brands.length)];
}

/** Gera um único cartão, no modo e bandeira pedidos. */
export function generateCard(
  mode: CreditCardGeneratorMode,
  brand: CardBrand | "any",
  formatted = true
): GeneratedCard {
  if (mode === "official") {
    const candidates =
      brand === "any"
        ? OFFICIAL_TEST_CARDS
        : OFFICIAL_TEST_CARDS.filter((card) => card.brand === brand);
    const chosen = candidates[secureRandomInt(candidates.length)];
    return {
      brand: chosen.brand,
      number: formatted ? formatCardNumber(chosen.number, chosen.brand) : chosen.number,
      source: chosen.description,
    };
  }

  const chosenBrand = brand === "any" ? pickRandomBrand() : brand;
  const number = generateSyntheticCardNumber(chosenBrand);
  return {
    brand: chosenBrand,
    number: formatted ? formatCardNumber(number, chosenBrand) : number,
  };
}

export function validateCreditCardGeneratorInput(
  input: CreditCardGeneratorInput
): CreditCardGeneratorFieldErrors {
  const errors: CreditCardGeneratorFieldErrors = {};

  if (
    !Number.isFinite(input.count) ||
    !Number.isInteger(input.count) ||
    input.count < 1
  ) {
    errors.count = "Informe uma quantidade inteira de pelo menos 1.";
  } else if (input.count > CREDIT_CARD_GENERATOR_MAX_BATCH) {
    errors.count = `A quantidade não pode ser maior que ${CREDIT_CARD_GENERATOR_MAX_BATCH}.`;
  }

  return errors;
}

export function isCreditCardGeneratorInputValid(input: CreditCardGeneratorInput): boolean {
  return Object.keys(validateCreditCardGeneratorInput(input)).length === 0;
}

/**
 * Gera um lote de cartões sintéticos. O limite
 * (CREDIT_CARD_GENERATOR_MAX_BATCH) é aplicado ANTES de qualquer geração,
 * então nunca é criado um array maior que o limite, mesmo que a validação
 * seja pulada por algum chamador.
 */
export function generateCardBatch(input: CreditCardGeneratorInput): GeneratedCard[] {
  const safeCount = Math.min(
    Math.max(1, Math.trunc(input.count) || 1),
    CREDIT_CARD_GENERATOR_MAX_BATCH
  );

  return Array.from({ length: safeCount }, () =>
    generateCard(input.mode, input.brand, input.formatted)
  );
}
