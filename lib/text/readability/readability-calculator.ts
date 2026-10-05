/**
 * Índices de legibilidade — fórmulas puras, sem IA. Entradas já contadas
 * (palavras, frases, sílabas, letras, caracteres, palavras complexas).
 *
 * Referências:
 * - Flesch adaptado ao português (fórmula pedida no projeto):
 *   226 − 1,04 × (palavras/frases) − 72 × (sílabas/palavras).
 *   (Outra adaptação conhecida, Martins et al. 1996:
 *   248,835 − 1,015 × ASL − 84,6 × ASW — não usada aqui.)
 * - Gulpease (Lucisano & Piemontese, 1988 — criado para o italiano, sem
 *   contagem de sílabas): 89 + (300 × frases − 10 × letras) / palavras.
 * - Flesch-Kincaid Grade Level: 0,39 × ASL + 11,8 × ASW − 15,59.
 * - Gunning Fog: 0,4 × (ASL + 100 × complexas/palavras). "Complexa" aqui é a
 *   do detector do Alilu (pouco frequente), não "3+ sílabas" do inglês —
 *   em português quase toda palavra tem 3+ sílabas.
 * - ARI (Automated Readability Index): 4,71 × (caracteres/palavras) +
 *   0,5 × (palavras/frases) − 21,43 (caracteres = letras e dígitos).
 * - Coleman-Liau: 0,0588 × L − 0,296 × S − 15,8, com L = letras por 100
 *   palavras e S = frases por 100 palavras.
 *
 * Os índices de "série" (FK, Fog, ARI, Coleman-Liau) foram calibrados para
 * o inglês: em português servem para COMPARAR versões do mesmo texto, não
 * como série escolar exata.
 */

export interface ReadabilityCounts {
  words: number;
  sentences: number;
  syllables: number;
  letters: number;
  /** Letras + dígitos das palavras (para o ARI). */
  characters: number;
  complexWords: number;
}

export interface ReadabilityIndexes {
  flesch: number;
  gulpease: number;
  fleschKincaid: number;
  gunningFog: number;
  ari: number;
  colemanLiau: number;
}

const round1 = (value: number) => Math.round(value * 10) / 10;

export function fleschPortuguese(c: ReadabilityCounts): number {
  return 226 - 1.04 * (c.words / c.sentences) - 72 * (c.syllables / c.words);
}

export function gulpease(c: ReadabilityCounts): number {
  return 89 + (300 * c.sentences - 10 * c.letters) / c.words;
}

export function fleschKincaidGrade(c: ReadabilityCounts): number {
  return 0.39 * (c.words / c.sentences) + 11.8 * (c.syllables / c.words) - 15.59;
}

export function gunningFog(c: ReadabilityCounts): number {
  return 0.4 * (c.words / c.sentences + 100 * (c.complexWords / c.words));
}

export function automatedReadabilityIndex(c: ReadabilityCounts): number {
  return 4.71 * (c.characters / c.words) + 0.5 * (c.words / c.sentences) - 21.43;
}

export function colemanLiau(c: ReadabilityCounts): number {
  const L = (c.letters / c.words) * 100;
  const S = (c.sentences / c.words) * 100;
  return 0.0588 * L - 0.296 * S - 15.8;
}

/** Todos os índices (null quando não há palavra ou frase — divisão por zero). */
export function calculateIndexes(c: ReadabilityCounts): ReadabilityIndexes | null {
  if (c.words <= 0 || c.sentences <= 0) return null;
  return {
    flesch: round1(fleschPortuguese(c)),
    gulpease: round1(gulpease(c)),
    fleschKincaid: round1(fleschKincaidGrade(c)),
    gunningFog: round1(gunningFog(c)),
    ari: round1(automatedReadabilityIndex(c)),
    colemanLiau: round1(colemanLiau(c)),
  };
}
