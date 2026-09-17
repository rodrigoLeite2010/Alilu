/**
 * Contagem de caracteres, palavras, linhas e parágrafos — ferramenta
 * "Contador de Caracteres" (categoria Funções String). Tudo calculado
 * localmente, em tempo real, sem qualquer envio de dados.
 */

export interface CharacterCounts {
  charactersWithSpaces: number;
  charactersWithoutSpaces: number;
  words: number;
  lines: number;
  paragraphs: number;
  digits: number;
}

/** Limite de segurança para não travar o navegador com textos gigantes. */
export const CHARACTER_COUNTER_MAX_LENGTH = 200_000;

export function countCharacters(text: string): CharacterCounts {
  const charactersWithSpaces = Array.from(text).length;
  const charactersWithoutSpaces = Array.from(text.replace(/\s/g, "")).length;
  const trimmed = text.trim();
  const words = trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
  const lines = text.length === 0 ? 0 : text.split(/\r\n|\r|\n/).length;
  const paragraphs =
    trimmed.length === 0
      ? 0
      : trimmed.split(/\n\s*\n/).filter((p) => p.trim().length > 0).length;
  const digits = (text.match(/\d/g) ?? []).length;

  return { charactersWithSpaces, charactersWithoutSpaces, words, lines, paragraphs, digits };
}
