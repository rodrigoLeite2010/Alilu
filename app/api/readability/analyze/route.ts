import { NextResponse } from "next/server";
import { READABILITY_MAX_CHARACTERS, analyzeReadability } from "@/lib/text/readability/analyze";

export const dynamic = "force-dynamic";

/**
 * POST { text } → análise de legibilidade (a MESMA biblioteca usada no
 * navegador). Gratuita, sem login, sem IA. O texto é processado e
 * descartado: nunca é salvo nem registrado em log (só tamanho e duração).
 */
export async function POST(request: Request): Promise<NextResponse> {
  const startedAt = Date.now();
  let body: { text?: unknown };
  try {
    body = (await request.json()) as { text?: unknown };
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }
  const text = typeof body?.text === "string" ? body.text : "";
  if (!text.trim()) return NextResponse.json({ error: "Digite um texto para analisar." }, { status: 400 });
  if (text.length > READABILITY_MAX_CHARACTERS) {
    return NextResponse.json({ error: `O texto passa do limite de ${READABILITY_MAX_CHARACTERS.toLocaleString("pt-BR")} caracteres.` }, { status: 413 });
  }
  const result = analyzeReadability(text);
  console.info(JSON.stringify({ scope: "readability", operation: "analyze", characterCount: text.length, durationMs: Date.now() - startedAt, success: true }));
  return NextResponse.json({
    score: result.score,
    level: result.level,
    levelLabel: result.levelLabel,
    words: result.words,
    sentences: result.sentences,
    paragraphs: result.paragraphs,
    syllables: result.syllables,
    complexWords: result.complexWords,
    longSentences: result.longSentences,
    averageWordsPerSentence: result.averageWordsPerSentence,
    averageSyllablesPerWord: result.averageSyllablesPerWord,
    indexes: result.indexes,
    suggestions: result.suggestions,
  });
}
