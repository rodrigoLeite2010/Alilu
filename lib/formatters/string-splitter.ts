/**
 * Divisão de texto em itens por um delimitador — ferramenta "Dividir
 * String" (categoria Funções String). Tudo calculado localmente, sem
 * qualquer envio de dados.
 */

export type SplitDelimiterPreset = "comma" | "semicolon" | "space" | "newline" | "custom";

export interface SplitOptions {
  preset: SplitDelimiterPreset;
  customDelimiter: string;
  trimItems: boolean;
  removeEmpty: boolean;
}

export const DEFAULT_SPLIT_OPTIONS: SplitOptions = {
  preset: "comma",
  customDelimiter: "",
  trimItems: true,
  removeEmpty: true,
};

export function splitString(text: string, options: SplitOptions): string[] {
  let parts: string[];

  switch (options.preset) {
    case "comma":
      parts = text.split(",");
      break;
    case "semicolon":
      parts = text.split(";");
      break;
    case "space":
      parts = text.split(" ");
      break;
    case "newline":
      parts = text.split(/\r\n|\r|\n/);
      break;
    case "custom":
      parts = options.customDelimiter.length > 0 ? text.split(options.customDelimiter) : [text];
      break;
  }

  if (options.trimItems) {
    parts = parts.map((part) => part.trim());
  }
  if (options.removeEmpty) {
    parts = parts.filter((part) => part.length > 0);
  }

  return parts;
}
