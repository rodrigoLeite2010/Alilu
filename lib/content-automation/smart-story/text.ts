/** Utilitários de texto do Story (puros). */

const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu;

/** Remove markdown/aspas/emoji e espaços duplicados, mantendo quebras de linha simples. */
export function cleanStoryText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/\r\n?/g, "\n")
    .replace(EMOJI_RE, "")
    .replace(/[*_`#>]+/g, "")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .replace(/^["“”']+|["“”']+$/g, "")
    .trim();
}

/**
 * Corta em `max` caracteres SEM quebrar palavra, terminando em "…" quando
 * cortou. Texto que já cabe volta intacto.
 */
export function truncateSafely(text: string, max: number): string {
  if (text.length <= max) return text;
  const limit = Math.max(1, max - 1);
  const slice = text.slice(0, limit);
  const lastSpace = slice.search(/\s\S*$/);
  const base = lastSpace > limit * 0.5 ? slice.slice(0, lastSpace) : slice;
  return `${base.replace(/[\s,;:.\-–—]+$/, "")}…`;
}

/** Forma comparável: minúsculas, sem acento/pontuação, espaços únicos. */
export function normalizeForCompare(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function sameText(a: string, b: string): boolean {
  const left = normalizeForCompare(a);
  return left.length > 0 && left === normalizeForCompare(b);
}
