/**
 * Ordenação alfabética de uma lista de linhas — ferramenta "Ordem
 * Alfabética" (categoria Funções String). Transformação puramente local,
 * determinística, sem qualquer envio de dados.
 */

export interface AlphabeticalSortOptions {
  direction: "asc" | "desc";
  caseInsensitive: boolean;
  removeDuplicates: boolean;
  skipEmptyLines: boolean;
}

export const DEFAULT_ALPHABETICAL_SORT_OPTIONS: AlphabeticalSortOptions = {
  direction: "asc",
  caseInsensitive: true,
  removeDuplicates: false,
  skipEmptyLines: true,
};

/**
 * Ordena as linhas de `text` de acordo com as opções informadas. Usa
 * `Intl.Collator` (pt-BR) para uma ordenação alfabética correta com
 * acentuação (ex.: "é" perto de "e", não no fim do alfabeto).
 */
export function sortLinesAlphabetically(
  text: string,
  options: AlphabeticalSortOptions
): string[] {
  let lines = text.split(/\r\n|\r|\n/);

  if (options.skipEmptyLines) {
    lines = lines.filter((line) => line.trim().length > 0);
  }

  if (options.removeDuplicates) {
    const seen = new Set<string>();
    lines = lines.filter((line) => {
      const key = options.caseInsensitive ? line.toLowerCase() : line;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  const collator = new Intl.Collator("pt-BR", {
    sensitivity: options.caseInsensitive ? "base" : "variant",
  });
  const sorted = [...lines].sort((a, b) => collator.compare(a, b));

  return options.direction === "desc" ? sorted.reverse() : sorted;
}
