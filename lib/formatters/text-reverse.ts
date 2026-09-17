/**
 * Inversão de texto (caracteres, palavras ou linhas) — ferramenta
 * "Inverter Texto" (categoria Funções String). Usa `Array.from` (iterador
 * de code points) em vez de indexação por índice de string, para lidar
 * corretamente com caracteres Unicode fora do plano básico (ex.: emojis).
 */

export type ReverseMode = "characters" | "words" | "lines";

export function reverseText(text: string, mode: ReverseMode): string {
  if (mode === "characters") {
    return Array.from(text).reverse().join("");
  }
  if (mode === "words") {
    const words = text.trim().length === 0 ? [] : text.trim().split(/\s+/);
    return words.reverse().join(" ");
  }
  return text.split(/\r\n|\r|\n/).reverse().join("\n");
}
