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
  /**
   * Nível de escala do grupo: 0 = unidades (sem palavra de escala),
   * 1 = milhar ("mil", invariável), 2 = milhão/milhões, 3 = bilhão/bilhões,
   * 4 = trilhão/trilhões, e assim por diante.
   */
  level: number;
}

/**
 * Nomes de escala por nível (índices 2+), no singular e no plural. O nível 1
 * ("mil") é tratado à parte, pois é invariável e nunca recebe "de" antes do
 * substantivo. Cobre com folga o intervalo de valores monetários realistas
 * para um recibo (até a casa dos trilhões).
 */
const SCALE_NAMES: Record<number, { singular: string; plural: string }> = {
  2: { singular: "milhão", plural: "milhões" },
  3: { singular: "bilhão", plural: "bilhões" },
  4: { singular: "trilhão", plural: "trilhões" },
  5: { singular: "quatrilhão", plural: "quatrilhões" },
};

/**
 * Quebra um inteiro não negativo em grupos de três dígitos (base 1000),
 * do menos significativo (nível 0 = unidades) para o mais significativo.
 * `groups[0]` são as unidades/centenas, `groups[1]` os milhares,
 * `groups[2]` os milhões, `groups[3]` os bilhões, etc.
 */
function splitIntoGroupsOfThousand(value: number): number[] {
  const groups: number[] = [];
  let remaining = value;
  do {
    groups.push(remaining % 1000);
    remaining = Math.floor(remaining / 1000);
  } while (remaining > 0);
  return groups;
}

/**
 * Monta os segmentos (do mais para o menos significativo) de um inteiro
 * positivo, cada um já com sua palavra de escala aplicada quando cabível.
 * Grupos zerados são omitidos (ex.: 1.000.001 não gera segmento de milhar).
 */
function buildSegments(value: number): Segment[] {
  const groups = splitIntoGroupsOfThousand(value);
  const segments: Segment[] = [];

  for (let level = groups.length - 1; level >= 0; level -= 1) {
    const groupValue = groups[level];
    if (groupValue === 0) {
      continue;
    }

    if (level === 0) {
      segments.push({ text: groupToWords(groupValue), groupValue, level });
    } else if (level === 1) {
      const text = groupValue === 1 ? "mil" : `${groupToWords(groupValue)} mil`;
      segments.push({ text, groupValue, level });
    } else {
      const scale = SCALE_NAMES[level];
      if (!scale) {
        // Além da faixa de escalas nomeadas (muito acima de qualquer valor
        // monetário realista) — evita gerar texto incorreto silenciosamente.
        throw new RangeError(
          `Valor grande demais para converter por extenso: ${value}`
        );
      }
      const scaleWord = groupValue === 1 ? scale.singular : scale.plural;
      segments.push({
        text: `${groupToWords(groupValue)} ${scaleWord}`,
        groupValue,
        level,
      });
    }
  }

  return segments;
}

/** Converte um inteiro não negativo em texto por extenso (sem moeda). */
function integerToWords(value: number): string {
  if (value === 0) {
    return "zero";
  }

  const segments = buildSegments(value);

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
 * aplicando a regra do "de" após uma palavra de escala de milhão ou maior
 * (milhão/milhões, bilhão/bilhões, trilhão/trilhões, ...) quando ela é o
 * último grupo do número, ou seja, quando não há nenhuma casa de milhar ou
 * unidade abaixo dela (ex.: "um milhão de reais", "um bilhão de reais", mas
 * "um milhão e cem reais" e "um bilhão e cem milhões de reais"). O "mil"
 * (nível 1) nunca recebe "de" ("mil reais", nunca "mil de reais").
 */
function integerWithNoun(
  value: number,
  singular: string,
  plural: string
): string {
  if (value === 0) {
    return `zero ${plural}`;
  }

  const segments = buildSegments(value);
  const words = integerToWords(value);
  const noun = value === 1 ? singular : plural;

  const lastSegment = segments[segments.length - 1];
  const needsDe = lastSegment.level >= 2;

  return needsDe ? `${words} de ${noun}` : `${words} ${noun}`;
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
