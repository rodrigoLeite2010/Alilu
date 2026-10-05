import type { ComplexWordHit, ReadabilityResult, SentenceBand } from "./analyze";
import { normalizeText } from "./text-analyzer";

/**
 * Divide o texto (normalizado, igual ao analisado) em trechos com o
 * destaque de cada um: banda da frase (longa/muito longa) e palavra
 * complexa. A tela renderiza cada trecho como texto puro dentro de um
 * <span> — nunca HTML do usuário (sem risco de injeção).
 */
export interface HighlightSegment {
  text: string;
  band: SentenceBand | null;
  word: ComplexWordHit | null;
}

export function buildHighlightSegments(input: string, result: Pick<ReadabilityResult, "sentenceSpans" | "complexWordHits">): HighlightSegment[] {
  const text = normalizeText(input);
  if (!text) return [];
  const longSentences = result.sentenceSpans.filter((s) => s.band === "LONGA" || s.band === "MUITO_LONGA");
  const cuts = new Set<number>([0, text.length]);
  for (const s of longSentences) cuts.add(s.start).add(s.end);
  for (const w of result.complexWordHits) cuts.add(w.start).add(w.end);
  const points = [...cuts].filter((p) => p >= 0 && p <= text.length).sort((a, b) => a - b);
  const segments: HighlightSegment[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const start = points[i];
    const end = points[i + 1];
    if (end <= start) continue;
    const band = longSentences.find((s) => s.start <= start && end <= s.end)?.band ?? null;
    const word = result.complexWordHits.find((w) => w.start <= start && end <= w.end) ?? null;
    const previous = segments.at(-1);
    if (previous && !word && !previous.word && previous.band === band) previous.text += text.slice(start, end);
    else segments.push({ text: text.slice(start, end), band, word });
  }
  return segments;
}
