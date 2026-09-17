/**
 * Identificação OPCIONAL da bandeira provável de um cartão, a partir do
 * padrão numérico (prefixo/BIN) — categoria Validadores.
 *
 * IMPORTANTE: isto identifica apenas um padrão numérico público conhecido
 * (faixas de prefixo divulgadas pelas próprias bandeiras/processadoras de
 * pagamento) — não confirma que o cartão exista, esteja ativo ou tenha
 * sido de fato emitido por aquela bandeira. Nunca deve ser apresentado
 * como uma verificação oficial.
 *
 * Reaproveita `isValidLuhn` de lib/calculators/credit-card-generator.ts
 * para a validação matemática do número — este arquivo cuida só da
 * identificação de bandeira, que é uma responsabilidade separada (aqui o
 * número vem do usuário; no gerador, a bandeira é escolhida antes de gerar
 * o número).
 */

export type DetectedCardBrand =
  | "visa"
  | "mastercard"
  | "amex"
  | "elo"
  | "hipercard"
  | null;

export const CARD_BRAND_DISPLAY_LABELS: Record<Exclude<DetectedCardBrand, null>, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  elo: "Elo",
  hipercard: "Hipercard",
};

/** BINs (prefixos de 6 dígitos) Elo publicamente divulgados por adquirentes/gateways brasileiros. */
const ELO_BIN_PREFIXES = [
  "401178",
  "401179",
  "431274",
  "438935",
  "451416",
  "457393",
  "457631",
  "457632",
  "504175",
  "627780",
  "636297",
  "636368",
  "650031",
  "650032",
  "650033",
  "650035",
  "650036",
  "650037",
  "650038",
  "650039",
  "650040",
  "650041",
  "650042",
  "650043",
  "650044",
  "650045",
  "650046",
  "650047",
  "650048",
  "650049",
  "650050",
  "650051",
  "650405",
  "650406",
  "650407",
  "650408",
  "650409",
  "650485",
  "650486",
  "650487",
  "650488",
  "650541",
  "650542",
  "650543",
  "650544",
  "650545",
  "650546",
  "650547",
  "650548",
  "650549",
  "650550",
  "650700",
  "650701",
  "650702",
  "650920",
  "650921",
  "650922",
  "650923",
  "650924",
  "650925",
  "650926",
  "650927",
  "650928",
  "650929",
  "650930",
  "651652",
  "651653",
  "651654",
  "651655",
  "651656",
  "651657",
  "651658",
  "651659",
  "651660",
  "655000",
  "655001",
  "655002",
  "655003",
  "655004",
  "655005",
];

/** BIN de 6 dígitos amplamente documentado para o Hipercard. */
const HIPERCARD_BIN_PREFIX = "606282";

/**
 * Identifica a bandeira provável pelo prefixo numérico do cartão — ver
 * aviso no cabeçalho deste arquivo. Retorna `null` quando nenhum padrão
 * conhecido corresponde (o cartão continua podendo ser Luhn-válido).
 */
export function detectCardBrand(digits: string): DetectedCardBrand {
  if (!/^\d+$/.test(digits)) {
    return null;
  }

  if (digits.length === 15 && /^3[47]/.test(digits)) {
    return "amex";
  }

  const bin6 = digits.slice(0, 6);
  if (digits.length >= 16) {
    if (ELO_BIN_PREFIXES.includes(bin6)) {
      return "elo";
    }
    if (bin6 === HIPERCARD_BIN_PREFIX) {
      return "hipercard";
    }
    if (/^4/.test(digits)) {
      return "visa";
    }
    if (/^5[1-5]/.test(digits) || /^2(2[2-9]\d|[3-6]\d\d|7[01]\d|720)/.test(digits.slice(0, 4))) {
      return "mastercard";
    }
  }

  return null;
}
