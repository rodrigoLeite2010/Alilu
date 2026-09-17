/**
 * Informações técnicas de um único caractere (code point, hexadecimal,
 * HTML entity, bytes UTF-8) — ferramenta "Informações de Caractere"
 * (categoria Funções String). Usa apenas APIs padrão do JavaScript
 * (String.codePointAt, TextEncoder) — nenhuma propriedade não confirmada é
 * inventada.
 */

export interface CharacterInfo {
  char: string;
  codePoint: number;
  hex: string;
  decimal: number;
  htmlEntityDecimal: string;
  htmlEntityHex: string;
  utf8Bytes: number[];
}

/**
 * Retorna as informações do primeiro caractere (code point Unicode) de
 * `input`, ou `null` se `input` estiver vazio. Quando `input` tem mais de
 * um caractere, apenas o primeiro é considerado (o campo é pensado para um
 * único caractere).
 */
export function getCharacterInfo(input: string): CharacterInfo | null {
  const chars = Array.from(input);
  if (chars.length === 0) {
    return null;
  }

  const char = chars[0];
  const codePoint = char.codePointAt(0) ?? 0;
  const hex = codePoint.toString(16).toUpperCase().padStart(4, "0");
  const utf8Bytes = Array.from(new TextEncoder().encode(char));

  return {
    char,
    codePoint,
    hex,
    decimal: codePoint,
    htmlEntityDecimal: `&#${codePoint};`,
    htmlEntityHex: `&#x${hex};`,
    utf8Bytes,
  };
}
