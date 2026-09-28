/**
 * Gerador do payload Pix "Copia e Cola" (BR Code / EMV QR Code), no padrão
 * oficial do Banco Central do Brasil (Manual de Padrões para Iniciação do
 * Pix, formato EMVCo). Lógica pura, sem DOM — o desenho do QR Code em si
 * fica em components/donation/PixQRCode.tsx, usando a biblioteca `qrcode`
 * já presente no projeto (mesmo padrão do Gerador de QR Code, ver
 * lib/calculators/qr-code.ts).
 *
 * IMPORTANTE: o payload NUNCA inclui o campo 54 (valor da transação) — a
 * doação é sempre de valor livre, escolhido pelo doador dentro do app do
 * banco dele. "01"="11" marca o código como estático/reutilizável (o mesmo
 * QR Code vale para qualquer número de doações).
 */

const GUI_PIX = "br.gov.bcb.pix";
const MERCHANT_CATEGORY_CODE = "0000";
const TRANSACTION_CURRENCY_BRL = "986";
const COUNTRY_CODE = "BR";
const DEFAULT_TXID = "***"; // padrão do BCB para Pix estático sem txid específico de PSP
const MERCHANT_NAME_MAX_LENGTH = 25;
const MERCHANT_CITY_MAX_LENGTH = 15;

export interface PixPayloadInput {
  pixKey: string;
  receiverName: string;
  receiverCity: string;
  /** Identificador de referência (txid) opcional. */
  txid?: string;
}

/** Monta um campo TLV (Tag-Length-Value): id (2 dígitos) + tamanho (2 dígitos) + valor. */
function tlv(id: string, value: string): string {
  const length = value.length.toString().padStart(2, "0");
  return `${id}${length}${value}`;
}

/**
 * Remove acentuação e caracteres fora de um conjunto seguro (letras, números,
 * espaço e pontuação comum), e corta no tamanho máximo exigido pelo padrão
 * BR Code para os campos de nome/cidade do recebedor — nunca deixa um
 * caractere fora do padrão corromper o payload.
 */
export function sanitizePixTextField(value: string, maxLength: number): string {
  // Remove marcas diacríticas (NFD decompõe "ã" em "a" + til) por faixa de
  // code point (0x0300-0x036F, marcas de combinação Unicode) em vez de um
  // literal \\u no regex, que edições do arquivo podem acabar normalizando.
  const withoutAccents = Array.from(value.normalize("NFD"))
    .filter((char) => {
      const codePoint = char.codePointAt(0) ?? 0;
      return codePoint < 0x0300 || codePoint > 0x036f;
    })
    .join("");
  const safe = withoutAccents
    .replace(/[^A-Za-z0-9 .,-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    // Convenção do padrão BR Code: nome/cidade do recebedor em maiúsculas
    // (confirmado por interoperabilidade com outras implementações do
    // payload Pix, como a biblioteca "pix-utils").
    .toUpperCase();
  return safe.slice(0, maxLength);
}

/**
 * CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF, sem reflexão, sem XOR
 * final) — o checksum exigido no campo final (63) do payload Pix.
 * Conformidade verificada contra o valor de referência padrão da família
 * CRC-16/CCITT-FALSE: crc16CcittFalse("123456789") === "29B1".
 */
export function crc16CcittFalse(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i += 1) {
    crc ^= input.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * Monta o payload Pix completo (BR Code), pronto para virar QR Code ou ser
 * copiado como "Pix Copia e Cola". Lança se a chave Pix estiver vazia —
 * quem chama deve garantir isso antes (ver lib/donation/config.ts,
 * `getDonationConfig().enabled` só fica true com todos os dados
 * essenciais presentes).
 */
export function buildPixPayload(input: PixPayloadInput): string {
  const pixKey = input.pixKey.trim();
  if (!pixKey) {
    throw new Error("Não é possível gerar o payload Pix sem uma chave Pix configurada.");
  }

  const merchantName = sanitizePixTextField(input.receiverName, MERCHANT_NAME_MAX_LENGTH) || "ALILU";
  const merchantCity = sanitizePixTextField(input.receiverCity, MERCHANT_CITY_MAX_LENGTH) || "BRASIL";
  const txid = sanitizePixTextField(input.txid ?? DEFAULT_TXID, 25) || DEFAULT_TXID;

  const merchantAccountInfo = tlv("26", tlv("00", GUI_PIX) + tlv("01", pixKey));
  const additionalData = tlv("62", tlv("05", txid));

  const payloadWithoutCrc =
    tlv("00", "01") + // Payload Format Indicator
    tlv("01", "11") + // Point of Initiation Method: 11 = estático/reutilizável
    merchantAccountInfo +
    tlv("52", MERCHANT_CATEGORY_CODE) +
    tlv("53", TRANSACTION_CURRENCY_BRL) +
    // Campo 54 (valor) OMITIDO DE PROPÓSITO: doação sempre de valor livre.
    tlv("58", COUNTRY_CODE) +
    tlv("59", merchantName) +
    tlv("60", merchantCity) +
    additionalData +
    "6304"; // tag+tamanho do CRC — o valor (4 dígitos hex) é calculado e anexado a seguir

  return payloadWithoutCrc + crc16CcittFalse(payloadWithoutCrc);
}
