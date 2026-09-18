export type PageSelectionResult =
  | { ok: true; pages: number[] }
  | { ok: false; error: string };

/**
 * Converte uma lista como "1-3, 5, 8-10" em índices de página (base 1).
 * Repetições são erros explícitos para que a pessoa nunca baixe um documento
 * com páginas duplicadas por acidente.
 */
export function parsePageSelection(value: string, pageCount: number): PageSelectionResult {
  const input = value.trim();
  if (!input) {
    return { ok: false, error: "Informe ao menos uma página ou intervalo." };
  }

  const pages: number[] = [];
  const seen = new Set<number>();
  const entries = input.split(",").map((entry) => entry.trim());

  for (const entry of entries) {
    const match = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(entry);
    if (!match) {
      return {
        ok: false,
        error: `"${entry}" não é um número de página ou intervalo válido.`,
      };
    }

    const start = Number(match[1]);
    const end = Number(match[2] ?? match[1]);

    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 1 || end < 1) {
      return { ok: false, error: "Os números de página devem começar em 1." };
    }

    if (start > end) {
      return {
        ok: false,
        error: `O intervalo "${entry}" deve começar na página menor.`,
      };
    }

    if (end > pageCount) {
      return {
        ok: false,
        error: `O PDF possui ${pageCount} ${pageCount === 1 ? "página" : "páginas"}; revise "${entry}".`,
      };
    }

    for (let page = start; page <= end; page += 1) {
      if (seen.has(page)) {
        return {
          ok: false,
          error: `A página ${page} foi informada mais de uma vez.`,
        };
      }
      seen.add(page);
      pages.push(page);
    }
  }

  return { ok: true, pages };
}

export function getAllPageNumbers(pageCount: number): number[] {
  return Array.from({ length: pageCount }, (_, index) => index + 1);
}
