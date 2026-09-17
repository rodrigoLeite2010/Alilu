/**
 * Corte/limite de um texto por caracteres, palavras ou linhas —
 * ferramenta "Cortar Textos" (categoria Funções String). Tudo calculado
 * localmente, sem qualquer envio de dados.
 */

export type TruncateUnit = "characters" | "words" | "lines";

export interface TruncateOptions {
  unit: TruncateUnit;
  limit: number;
  addEllipsis: boolean;
  avoidCuttingWord: boolean;
}

export const DEFAULT_TRUNCATE_OPTIONS: TruncateOptions = {
  unit: "characters",
  limit: 100,
  addEllipsis: true,
  avoidCuttingWord: true,
};

/** Limite de segurança para o parâmetro `limit`, para evitar entradas absurdas. */
export const TRUNCATE_MAX_LIMIT = 100_000;

export function truncateText(text: string, options: TruncateOptions): string {
  const limit = Math.min(
    TRUNCATE_MAX_LIMIT,
    Math.max(0, Math.trunc(options.limit) || 0)
  );

  let wasTruncated = false;
  let result: string;

  if (options.unit === "characters") {
    const chars = Array.from(text);
    if (chars.length <= limit) {
      return text;
    }
    wasTruncated = true;
    let sliced = chars.slice(0, limit).join("");
    if (options.avoidCuttingWord) {
      const lastSpace = sliced.lastIndexOf(" ");
      if (lastSpace > 0) {
        sliced = sliced.slice(0, lastSpace);
      }
    }
    result = sliced;
  } else if (options.unit === "words") {
    const words = text.trim().length === 0 ? [] : text.trim().split(/\s+/);
    if (words.length <= limit) {
      return text;
    }
    wasTruncated = true;
    result = words.slice(0, limit).join(" ");
  } else {
    const lines = text.split(/\r\n|\r|\n/);
    if (lines.length <= limit) {
      return text;
    }
    wasTruncated = true;
    result = lines.slice(0, limit).join("\n");
  }

  return wasTruncated && options.addEllipsis ? `${result}…` : result;
}
