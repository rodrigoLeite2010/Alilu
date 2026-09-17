/**
 * Contagem de ocorrências de uma palavra/expressão em um texto —
 * ferramenta "Contador de Ocorrência de Palavra" (categoria Funções
 * String). Tudo calculado localmente, sem qualquer envio de dados.
 */

export interface WordOccurrenceOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
}

export const DEFAULT_WORD_OCCURRENCE_OPTIONS: WordOccurrenceOptions = {
  caseSensitive: false,
  wholeWord: false,
};

export interface WordOccurrenceMatch {
  /** Número da linha (1-based). */
  line: number;
  /** Posição do caractere dentro da linha (1-based). */
  column: number;
}

export interface WordOccurrenceResult {
  count: number;
  matches: WordOccurrenceMatch[];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Conta quantas vezes `term` aparece em `text`, com posição (linha/coluna)
 * de cada ocorrência. `term` vazio sempre resulta em zero ocorrências (não
 * é um erro, apenas um resultado vazio).
 */
export function countWordOccurrences(
  text: string,
  term: string,
  options: WordOccurrenceOptions
): WordOccurrenceResult {
  if (term.length === 0) {
    return { count: 0, matches: [] };
  }

  const flags = options.caseSensitive ? "g" : "gi";
  const escaped = escapeRegExp(term);
  const pattern = options.wholeWord ? `\\b${escaped}\\b` : escaped;

  const lines = text.split(/\r\n|\r|\n/);
  const matches: WordOccurrenceMatch[] = [];

  lines.forEach((lineText, lineIndex) => {
    const regex = new RegExp(pattern, flags);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(lineText)) !== null) {
      matches.push({ line: lineIndex + 1, column: match.index + 1 });
      if (match[0].length === 0) {
        regex.lastIndex += 1;
      }
    }
  });

  return { count: matches.length, matches };
}
