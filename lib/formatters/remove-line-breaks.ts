/**
 * Remoção/substituição de quebras de linha — ferramenta "Remover Quebras
 * de Linha" (categoria Funções String). Reconhece \n, \r\n e \r.
 */

export type LineBreakReplacement = "remove" | "space" | "comma" | "custom";

export interface RemoveLineBreaksOptions {
  replacement: LineBreakReplacement;
  customReplacement: string;
  /** Reduz espaços duplicados resultantes da substituição a um só. */
  collapseSpaces: boolean;
}

export const DEFAULT_REMOVE_LINE_BREAKS_OPTIONS: RemoveLineBreaksOptions = {
  replacement: "space",
  customReplacement: "",
  collapseSpaces: true,
};

function resolveReplacement(options: RemoveLineBreaksOptions): string {
  switch (options.replacement) {
    case "remove":
      return "";
    case "space":
      return " ";
    case "comma":
      return ", ";
    case "custom":
      return options.customReplacement;
  }
}

export function removeLineBreaks(text: string, options: RemoveLineBreaksOptions): string {
  // Normaliza \r\n e \r solitário para \n antes de dividir, para nunca
  // deixar um \r "sobrando" no meio do resultado.
  const normalized = text.replace(/\r\n|\r/g, "\n");
  const replacement = resolveReplacement(options);

  let result = normalized.split("\n").join(replacement);

  if (options.collapseSpaces) {
    result = result.replace(/ {2,}/g, " ").trim();
  }

  return result;
}
