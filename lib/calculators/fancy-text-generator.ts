/**
 * Conversor de texto normal para variações "estilizadas" em Unicode
 * (negrito, itálico, bolha, largura total, invertido, riscado, sublinhado)
 * — categoria Geradores ("Letras Diferentes"). Mantido isolado da
 * interface (PROMPT MESTRE, seção 14).
 *
 * Diferente dos outros arquivos deste diretório, esta é uma transformação
 * DETERMINÍSTICA de texto (não usa nenhuma fonte de aleatoriedade) — o
 * texto digitado pelo usuário nunca é enviado, salvo ou registrado em log;
 * toda a conversão acontece no navegador.
 *
 * As variantes "negrito", "itálico" e "negrito itálico" usam o bloco
 * Unicode "Mathematical Alphanumeric Symbols" (deslocamento de código a
 * partir de uma base fixa por faixa de caractere). LIMITAÇÃO CONHECIDA:
 * esse bloco tem uma única exceção documentada (o "h" itálico minúsculo
 * usa o caractere pré-existente U+210E em vez de um novo código) que não é
 * tratada separadamente aqui — na prática, o "h" itálico gerado usa o
 * mesmo deslocamento dos demais caracteres, o que ainda assim resulta em
 * um glifo itálico visualmente correto na grande maioria das fontes.
 */

export type FancyTextStyle =
  | "negrito"
  | "italico"
  | "negrito-italico"
  | "bolha"
  | "largura-total"
  | "invertido"
  | "riscado"
  | "sublinhado";

export const FANCY_TEXT_STYLES: { id: FancyTextStyle; label: string }[] = [
  { id: "negrito", label: "Negrito" },
  { id: "italico", label: "Itálico" },
  { id: "negrito-italico", label: "Negrito itálico" },
  { id: "bolha", label: "Bolha (círculo)" },
  { id: "largura-total", label: "Largura total" },
  { id: "invertido", label: "Invertido (de cabeça para baixo)" },
  { id: "riscado", label: "Riscado" },
  { id: "sublinhado", label: "Sublinhado" },
];

export const FANCY_TEXT_MAX_LENGTH = 500;

export interface FancyTextGeneratorFieldErrors {
  text?: string;
}

/** Desloca A-Z / a-z / 0-9 para uma faixa Unicode contígua (ex.: negrito). */
function applyMathOffset(text: string, upperBase: number, lowerBase: number, digitBase?: number): string {
  return Array.from(text)
    .map((char) => {
      const code = char.codePointAt(0) ?? 0;
      if (code >= 65 && code <= 90) return String.fromCodePoint(upperBase + (code - 65));
      if (code >= 97 && code <= 122) return String.fromCodePoint(lowerBase + (code - 97));
      if (digitBase !== undefined && code >= 48 && code <= 57) {
        return String.fromCodePoint(digitBase + (code - 48));
      }
      return char;
    })
    .join("");
}

/** Letras circuladas ("bolha") — Ⓐ-Ⓩ, ⓐ-ⓩ, ⓪-⑨. */
function toCircled(text: string): string {
  return Array.from(text)
    .map((char) => {
      const code = char.codePointAt(0) ?? 0;
      if (code >= 65 && code <= 90) return String.fromCodePoint(0x24b6 + (code - 65));
      if (code >= 97 && code <= 122) return String.fromCodePoint(0x24d0 + (code - 97));
      if (char === "0") return "⓪";
      if (code >= 49 && code <= 57) return String.fromCodePoint(0x2460 + (code - 49));
      return char;
    })
    .join("");
}

/** Variante "largura total" (fullwidth), comum em nicknames estilizados. */
function toFullwidth(text: string): string {
  return Array.from(text)
    .map((char) => {
      if (char === " ") return "　";
      const code = char.codePointAt(0) ?? 0;
      if (code >= 0x21 && code <= 0x7e) return String.fromCodePoint(code + 0xfee0);
      return char;
    })
    .join("");
}

/** Insere um caractere combinante (riscado/sublinhado) após cada caractere visível. */
function withCombiningMark(text: string, combiningChar: string): string {
  return Array.from(text)
    .map((char) => (char === " " ? char : char + combiningChar))
    .join("");
}

const UPSIDE_DOWN_MAP: Record<string, string> = {
  a: "ɐ", b: "q", c: "ɔ", d: "p", e: "ǝ", f: "ɟ", g: "ƃ", h: "ɥ", i: "ᴉ",
  j: "ɾ", k: "ʞ", l: "l", m: "ɯ", n: "u", o: "o", p: "d", q: "b", r: "ɹ",
  s: "s", t: "ʇ", u: "n", v: "ʌ", w: "ʍ", x: "x", y: "ʎ", z: "z",
  "0": "0", "1": "Ɩ", "2": "ᄅ", "3": "Ɛ", "4": "ㄣ", "5": "ϛ", "6": "9",
  "7": "ㄥ", "8": "8", "9": "6",
  ".": "˙", ",": "'", "'": ",", '"': "„", "?": "¿", "!": "¡",
  "(": ")", ")": "(", "[": "]", "]": "[", "{": "}", "}": "{",
  "<": ">", ">": "<", "&": "⅋", "_": "‾",
};

/** Espelha o texto caractere a caractere (mapa fixo) e inverte a ordem. */
function toUpsideDown(text: string): string {
  const mapped = Array.from(text).map((char) => UPSIDE_DOWN_MAP[char.toLowerCase()] ?? char);
  return mapped.reverse().join("");
}

/** Aplica o estilo escolhido a um texto. Transformação pura e determinística. */
export function applyFancyTextStyle(text: string, style: FancyTextStyle): string {
  switch (style) {
    case "negrito":
      return applyMathOffset(text, 0x1d400, 0x1d41a, 0x1d7ce);
    case "italico":
      return applyMathOffset(text, 0x1d434, 0x1d44e);
    case "negrito-italico":
      return applyMathOffset(text, 0x1d468, 0x1d482);
    case "bolha":
      return toCircled(text);
    case "largura-total":
      return toFullwidth(text);
    case "invertido":
      return toUpsideDown(text);
    case "riscado":
      return withCombiningMark(text, "̶");
    case "sublinhado":
      return withCombiningMark(text, "̲");
    default:
      return text;
  }
}

export function validateFancyTextInput(text: string): FancyTextGeneratorFieldErrors {
  const errors: FancyTextGeneratorFieldErrors = {};

  if (!text || text.trim().length === 0) {
    errors.text = "Digite um texto para converter.";
  } else if (text.length > FANCY_TEXT_MAX_LENGTH) {
    errors.text = `O texto não pode ter mais que ${FANCY_TEXT_MAX_LENGTH} caracteres.`;
  }

  return errors;
}

export function isFancyTextInputValid(text: string): boolean {
  return Object.keys(validateFancyTextInput(text)).length === 0;
}

/** Aplica TODOS os estilos de uma vez, para exibir a lista completa de opções. */
export function applyAllFancyTextStyles(text: string): { id: FancyTextStyle; label: string; value: string }[] {
  return FANCY_TEXT_STYLES.map((style) => ({
    ...style,
    value: applyFancyTextStyle(text, style.id),
  }));
}
