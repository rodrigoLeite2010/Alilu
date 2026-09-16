/**
 * Conversão de valores monetários (BRL) para texto por extenso, em
 * português do Brasil — ex.: 1250.75 -> "mil duzentos e cinquenta reais e
 * setenta e cinco centavos".
 *
 * Mantido isolado da interface e de qualquer outra ferramenta (PROMPT
 * MESTRE, seção 14). Usado pelo Gerador de Recibo (ETAPA 2) e reutilizável
 * por qualquer calculadora futura que precise expressar um valor por
 * extenso.
 */

const UNITS = [
  "zero",
  "um",
  "dois",
  "três",
  "quatro",
  "cinco",
  "seis",
  "sete",
  "oito",
  "nove",
];

const TEENS = [
  "dez",
  "onze",
  "doze",
  "treze",
  "quatorze",
  "quinze",
  "dezesseis",
  "dezessete",
  "dezoito",
  "dezenove",
];

// Índice pela casa da dezena (2 a 9); índices 0 e 1 não são usados.
const TENS = [
  "",
  "",
  "vinte",
  "trinta",
  "quarenta",
  "cinquenta",
  "sessenta",
  "setenta",
  "oitenta",
  "noventa",
];

// Índice pela casa da centena (1 a 9); índice 0 não é usado (ver caso
// especial de 100 == "cem").
const HUNDREDS = [
  "",
  "cento",
  "duzentos",
  "trezentos",
  "quatrocentos",
  "quinhentos",
  "seiscentos",
  "setecentos",
  "oitocentos",
  "novecentos",
];

/** Converte um número de 1 a 99 para texto (sem tratar zero). */
function twoDigitsToWords(n: number): string {
  if (n < 10) {
    return UNITS[n];
  }
  if (n < 20) {
    return TEENS[n - 10];
  }
  const tensDigit = Math.floor(n / 10);
  const unitsDigit = n % 10;
  if (unitsDigit === 0) {
    return TENS[tensDigit];
  }
  return `${TENS[tensDigit]} e ${UNITS[unitsDigit]}`;
}

/** Converte um número de 0 a 999 para texto (grupo de três dígitos). */
function groupToWords(n: number): string {
  if (n === 0) {
    return "";
  }
  if (n === 100) {
    return "cem";
  }

  const hundredsDigit = Math.floor(n / 100);
  const rest = n % 100;

  const parts: string[] = [];
  if (hundredsDigit > 0) {
    parts.push(HUNDREDS[hundredsDigit]);
  }
  if (rest > 0) {
    if (hundredsDigit > 0) {
      parts.push("e");
    }
    parts.push(twoDigitsToWords(rest));
  }
  return parts.join(" ");
}

interface Segment {
  /** Texto já com a palavra de escala aplicada (ex.: "cem mil", "um milhão") */
  text: string;
  /** Valor numérico do grupo de três dígitos (0-999), usado só para decidir o "e" final */
  groupValue: number;
}

/** Converte um inteiro não negativo em texto por extenso (sem moeda). */
function integerToWords(value: number): string {
  if (value === 0) {
    return "zero";
  }

  const millions = Math.floor(value / 1_000_000);
  const remainderAfterMillions = value % 1_000_000;
  const thousands = Math.floor(remainderAfterMillions / 1000);
  const units = remainderAfterMillions % 1000;

  const segments: Segment[] = [];

  if (millions > 0) {
    const scale = millions === 1 ? "milhão" : "milhões";
    segments.push({
      text: `${groupToWords(millions)} ${scale}`,
      groupValue: millions,
    });
  }

  if (thousands > 0) {
    const text = thousands === 1 ? "mil" : `${groupToWords(thousands)} mil`;
    segments.push({ text, groupValue: thousands });
  }

  if (units > 0) {
    segments.push({ text: groupToWords(units), groupValue: units });
  }

  if (segments.length === 1) {
    return segments[0].text;
  }

  // Regra do português: usa-se "e" antes do último grupo quando ele é menor
  // que 100 ou é uma centena "redonda" (múltiplo de 100). Caso contrário
  // (ex.: 250 = "duzentos e cinquenta"), os grupos só são justapostos — o
  // "e" interno do próprio grupo já cumpre esse papel.
  const last = segments[segments.length - 1];
  const needsE = last.groupValue < 100 || last.groupValue % 100 === 0;

  const leading = segments
    .slice(0, -1)
    .map((segment) => segment.text)
    .join(" ");

  return needsE ? `${leading} e ${last.text}` : `${leading} ${last.text}`;
}

/**
 * Une um valor inteiro por extenso ao substantivo correto (singular/plural),
 * aplicando a regra do "de" após "milhão"/"milhões" quando não há nenhuma
 * casa de milhar/unidade abaixo dele (ex.: "um milhão de reais", mas
 * "um milhão e cem reais").
 */
function integerWithNoun(
  value: number,
  singular: string,
  plural: string
): string {
  if (value === 0) {
    return `zero ${plural}`;
  }

  const words = integerToWords(value);
  const noun = value === 1 ? singular : plural;
  const isExactMillions = value >= 1_000_000 && value % 1_000_000 === 0;

  return isExactMillions ? `${words} de ${noun}` : `${words} ${noun}`;
}

/**
 * Converte um valor monetário em reais (ex.: 1250.75) para texto por
 * extenso em português do Brasil (ex.: "mil duzentos e cinquenta reais e
 * setenta e cinco centavos").
 *
 * Valores não finitos ou negativos são tratados como 0 (não há necessidade
 * de expressar valores negativos por extenso nesta ferramenta — o valor do
 * recibo é sempre validado como positivo antes de chegar aqui).
 */
export function moneyToWordsBRL(value: number): string {
  const safeValue = Number.isFinite(value) && value > 0 ? value : 0;

  // Trabalha em centavos (inteiros) para evitar problemas de ponto
  // flutuante, ex.: 10.1 * 100 !== 1010 exatamente em alguns casos.
  const totalCents = Math.round(safeValue * 100);
  const reais = Math.floor(totalCents / 100);
  const cents = totalCents % 100;

  if (reais === 0 && cents === 0) {
    return "zero reais";
  }

  const reaisWords =
    reais > 0 ? integerWithNoun(reais, "real", "reais") : null;
  const centsWords =
    cents > 0 ? integerWithNoun(cents, "centavo", "centavos") : null;

  if (reaisWords && centsWords) {
    return `${reaisWords} e ${centsWords}`;
  }
  return reaisWords ?? centsWords ?? "zero reais";
}
