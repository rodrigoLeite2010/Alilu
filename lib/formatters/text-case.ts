/**
 * Conversões de maiúsculas/minúsculas — ferramenta "Maiúsculas e
 * Minúsculas" (categoria Funções String). Usa `toUpperCase`/`toLowerCase`
 * nativos do JavaScript, que já preservam corretamente a acentuação do
 * português.
 */

export type TextCaseMode =
  | "upper"
  | "lower"
  | "capitalize-text"
  | "capitalize-sentences"
  | "title-case";

export const TEXT_CASE_MODES: { id: TextCaseMode; label: string }[] = [
  { id: "upper", label: "TUDO MAIÚSCULO" },
  { id: "lower", label: "tudo minúsculo" },
  { id: "capitalize-text", label: "Primeira letra maiúscula" },
  { id: "capitalize-sentences", label: "Primeira letra de cada frase" },
  { id: "title-case", label: "Title Case (Cada Palavra)" },
];

/** Letra minúscula acentuada ou não — cobre o alfabeto latino usado em português. */
const LOWER_LETTER = "a-zà-ÿ";

export function applyTextCase(text: string, mode: TextCaseMode): string {
  switch (mode) {
    case "upper":
      return text.toUpperCase();
    case "lower":
      return text.toLowerCase();
    case "capitalize-text": {
      const match = text.match(/^(\s*)([\s\S]*)$/);
      const leadingSpace = match?.[1] ?? "";
      const rest = match?.[2] ?? "";
      if (rest.length === 0) return text;
      const lowered = rest.toLowerCase();
      return leadingSpace + lowered.charAt(0).toUpperCase() + lowered.slice(1);
    }
    case "capitalize-sentences": {
      const lowered = text.toLowerCase();
      const regex = new RegExp(`(^\\s*[${LOWER_LETTER}]|[.!?]\\s+[${LOWER_LETTER}])`, "g");
      return lowered.replace(regex, (match) => match.toUpperCase());
    }
    case "title-case":
      // Não usa \b: em JavaScript, \b só reconhece [A-Za-z0-9_] (ASCII) como
      // caractere de palavra, então letras acentuadas no início de uma
      // palavra (ex.: "José", "área") não seriam detectadas como início de
      // palavra e ficariam com a capitalização errada. Em vez disso,
      // capturamos qualquer letra Unicode (\p{L}) que vem logo após o
      // início do texto ou um caractere que não é letra.
      return text
        .toLowerCase()
        .replace(/(^|[^\p{L}])(\p{L})/gu, (_match, pre: string, letter: string) => pre + letter.toUpperCase());
  }
}
