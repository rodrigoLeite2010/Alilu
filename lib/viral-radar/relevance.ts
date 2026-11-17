/**
 * Relevância por regras (sem IA): o quanto título/descrição citam o tema do
 * radar. Barata, determinística e suficiente para filtrar ruído; a IA
 * (opcional) pode refinar depois.
 */
import { THEME_ALIASES } from "./types";

export function foldText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9#]+/g, " ")
    .trim();
}

function containsPhrase(haystack: string, phrase: string): boolean {
  const needle = foldText(phrase);
  if (!needle) return false;
  return ` ${haystack} `.includes(` ${needle} `);
}

export function themeTerms(themeId: string, keywords: string[], hashtags: string[] = []): string[] {
  const terms = [...(THEME_ALIASES[themeId] ?? []), ...keywords, ...hashtags.map((tag) => tag.replace(/^#/, ""))];
  return [...new Set(terms.map((term) => foldText(term)).filter((term) => term.length >= 2))];
}

/**
 * 0..1: termo no título → 0,7 + 0,1 por termo extra (máx. 1);
 * só na descrição → 0,4 (+0,05 por termo extra, máx. 0,6); nenhum → 0.
 */
export function ruleRelevance(input: { title: string | null; description: string | null }, terms: string[]): number {
  const title = foldText(input.title);
  const description = foldText(input.description);
  const inTitle = terms.filter((term) => containsPhrase(title, term)).length;
  if (inTitle > 0) return Math.min(1, 0.7 + 0.1 * (inTitle - 1));
  const inDescription = terms.filter((term) => containsPhrase(description, term)).length;
  if (inDescription > 0) return Math.min(0.6, 0.4 + 0.05 * (inDescription - 1));
  return 0;
}
