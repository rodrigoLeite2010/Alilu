// @vitest-environment node
// Legibilidade — análise determinística (sem IA): tokenização, sílabas,
// palavras complexas, índices (valores conferidos à mão) e nota Alilu.
import { describe, expect, it } from "vitest";
import { READABILITY_MAX_CHARACTERS, analyzeReadability, sentenceBand } from "@/lib/text/readability/analyze";
import { evaluateWord, isCommonWord, substitutionFor } from "@/lib/text/readability/complex-words";
import { buildHighlightSegments } from "@/lib/text/readability/highlight";
import {
  automatedReadabilityIndex,
  calculateIndexes,
  colemanLiau,
  fleschKincaidGrade,
  fleschPortuguese,
  gulpease,
  gunningFog,
} from "@/lib/text/readability/readability-calculator";
import { aliluScore, levelForScore, normalizeGrade, normalizeGulpease } from "@/lib/text/readability/score";
import { countSyllablesPortuguese as syl } from "@/lib/text/readability/syllables-pt";
import { splitSentences } from "@/lib/text/readability/text-analyzer";

// 100 palavras, 5 frases, 200 sílabas, 450 letras, 460 caracteres, 10 complexas.
const C = { words: 100, sentences: 5, syllables: 200, letters: 450, characters: 460, complexWords: 10 };

describe("análise básica", () => {
  it("1. texto vazio (ou só espaços/emojis): nada quebra e não há nota", () => {
    for (const text of ["", "   \n\n ", "🚀🔥"]) {
      const result = analyzeReadability(text);
      expect(result).toMatchObject({ words: 0, sentences: 0, score: null, level: null, indexes: null, suggestions: [] });
      expect(result.summary).toMatch(/Digite um texto/);
    }
  });

  it("2. uma frase", () => {
    const result = analyzeReadability("O gato dormiu no sofá.");
    expect(result).toMatchObject({ words: 5, sentences: 1, longSentences: 0 });
    expect(result.score).toBeGreaterThanOrEqual(85);
  });

  it("3. várias frases e terminadores ! ? …", () => {
    expect(analyzeReadability("Oi! Tudo bem? Vamos lá… Até já.").sentences).toBe(4);
  });

  it("9. abreviações e decimais não quebram frase", () => {
    const sentences = splitSentences("O Dr. Silva e a Sra. Ana pagaram 3.5 mil, etc. e foram embora. Fim.");
    expect(sentences.map((s) => s.text)).toEqual(["O Dr. Silva e a Sra. Ana pagaram 3.5 mil, etc. e foram embora.", "Fim."]);
  });

  it("13. parágrafos e quebra de linha (legendas sem ponto viram frases)", () => {
    const result = analyzeReadability("Primeira linha sem ponto\nSegunda linha\n\nNovo parágrafo aqui.");
    expect(result.paragraphs).toBe(2);
    expect(result.sentences).toBe(3);
  });

  it("5/6/7/8/12. URL, e-mail, hashtag, números e emojis: nunca palavras complexas; URL/e-mail não contam como palavra", () => {
    const result = analyzeReadability("Acesse https://www.alilu.com.br/ferramentas ou escreva para contato@alilu.com.br hoje. Use #legibilidadeincrivel e pague R$ 3.500,50 😀");
    expect(result.complexWordHits).toEqual([]);
    expect(result.words).toBe(10); // Acesse ou escreva para hoje Use #legibilidadeincrivel e pague 3.500,50
    expect(result.letters).toBeGreaterThan(0);
  });

  it("10. texto muito longo continua rápido e calcula frases muito longas", () => {
    const longSentence = Array.from({ length: 40 }, (_, i) => `palavra${i}`).join(" ") + ".";
    const text = `${longSentence} ${"Frase curta e simples. ".repeat(600)}`.slice(0, READABILITY_MAX_CHARACTERS);
    const started = Date.now();
    const result = analyzeReadability(text);
    expect(Date.now() - started).toBeLessThan(1500);
    expect(result.veryLongSentences).toBe(1);
    expect(result.longestSentenceWords).toBe(40);
  });

  it("faixas de frase centralizadas: 15 boa, 25 atenção, 35 longa, 36+ muito longa", () => {
    expect([15, 16, 25, 26, 35, 36].map(sentenceBand)).toEqual(["BOA", "ATENCAO", "ATENCAO", "LONGA", "LONGA", "MUITO_LONGA"]);
  });
});

describe("sílabas (estimativa)", () => {
  it.each([
    ["casa", 2], ["computador", 4], ["que", 1], ["guerra", 2], ["linguiça", 3], ["saúde", 3], ["saída", 3], ["poeta", 3],
    ["leão", 2], ["corações", 3], ["mãe", 1], ["país", 2], ["família", 3], ["coordenação", 5], ["água", 2],
  ])("4. %s → %i (acentos, ditongos, hiatos, qu/gu, ão/ões)", (word, expected) => {
    expect(syl(word)).toBe(expected);
  });

  it("11. palavra sem vogal conta 1 sílaba", () => {
    expect(syl("pq")).toBe(1);
    expect(syl("BRT")).toBe(1);
  });
});

describe("palavras complexas", () => {
  const token = (text: string, sentenceStart = false) => ({ text, kind: "word" as const, start: 0, end: text.length, sentenceIndex: 0, sentenceStart });

  it("pouco frequente e longa = complexa; comum (inclusive conjugada/plural) não", () => {
    expect(evaluateWord(token("imprescindibilidade")).complex).toBe(true);
    expect(isCommonWord("trabalhando")).toBe(true);
    expect(isCommonWord("crianças")).toBe(true);
    expect(evaluateWord(token("computador")).complex).toBe(false);
  });

  it("nome próprio e sigla não são complexos; início de frase pode ser", () => {
    expect(evaluateWord(token("Albuquerque")).complex).toBe(false);
    expect(evaluateWord(token("ONU")).complex).toBe(false);
    expect(evaluateWord(token("Imprescindibilidade", true)).complex).toBe(true);
  });

  it("dicionário de trocas: sugere (inclusive conjugado), nunca substitui", () => {
    expect(substitutionFor("utilizar")).toBe("usar");
    expect(substitutionFor("efetuem")).toBe("fazer");
    expect(evaluateWord(token("posteriormente"))).toEqual({ complex: true, suggestion: "depois" });
    const text = "Vamos utilizar o carro.";
    const result = analyzeReadability(text);
    expect(result.complexWordHits[0]).toMatchObject({ word: "utilizar", suggestion: "usar" });
    expect(text.slice(result.complexWordHits[0].start, result.complexWordHits[0].end)).toBe("utilizar");
  });
});

describe("índices (contas conferidas à mão)", () => {
  it("14. Flesch adaptado: 226 − 1,04×20 − 72×2 = 61,2", () => expect(fleschPortuguese(C)).toBeCloseTo(61.2, 5));
  it("15. Gulpease: 89 + (300×5 − 10×450)/100 = 59", () => expect(gulpease(C)).toBeCloseTo(59, 5));
  it("16. Flesch-Kincaid: 0,39×20 + 11,8×2 − 15,59 = 15,81", () => expect(fleschKincaidGrade(C)).toBeCloseTo(15.81, 5));
  it("17. Gunning Fog: 0,4×(20 + 10) = 12", () => expect(gunningFog(C)).toBeCloseTo(12, 5));
  it("18. ARI: 4,71×4,6 + 0,5×20 − 21,43 = 10,236", () => expect(automatedReadabilityIndex(C)).toBeCloseTo(10.236, 5));
  it("19. Coleman-Liau: 0,0588×450 − 0,296×5 − 15,8 = 9,18", () => expect(colemanLiau(C)).toBeCloseTo(9.18, 5));
  it("sem palavras ou frases não divide por zero", () => {
    expect(calculateIndexes({ ...C, words: 0 })).toBeNull();
    expect(calculateIndexes({ ...C, sentences: 0 })).toBeNull();
  });
});

describe("20. nota Alilu (normalizada, não média cega)", () => {
  it("combina 40% Flesch + 30% Gulpease + 30% anos de estudo → 55 (moderado)", () => {
    const indexes = calculateIndexes(C)!;
    expect(normalizeGulpease(59)).toBeCloseTo(65, 5);
    expect(normalizeGrade(4)).toBe(100);
    expect(normalizeGrade(16)).toBe(0);
    expect(aliluScore(indexes)).toBe(55);
    expect(levelForScore(55)).toBe("MODERADO");
  });

  it("faixas: 0–29, 30–49, 50–69, 70–84, 85–100", () => {
    expect([0, 29, 30, 49, 50, 69, 70, 84, 85, 100].map(levelForScore)).toEqual([
      "MUITO_DIFICIL", "MUITO_DIFICIL", "DIFICIL", "DIFICIL", "MODERADO", "MODERADO", "FACIL", "FACIL", "MUITO_FACIL", "MUITO_FACIL",
    ]);
  });

  it("texto simples > texto burocrático, sempre entre 0 e 100", () => {
    const simple = analyzeReadability("O gato subiu no muro. Ele viu um pássaro. Depois desceu e foi dormir.");
    const hard = analyzeReadability(
      "Considerando-se a imprescindibilidade da implementação de metodologias concernentes à otimização dos procedimentos administrativos, faz-se necessário que os colaboradores supracitados efetuem a verificação minuciosa das funcionalidades disponibilizadas.",
    );
    expect(simple.score!).toBeGreaterThan(hard.score!);
    expect(hard.score!).toBeGreaterThanOrEqual(0);
    expect(simple.score!).toBeLessThanOrEqual(100);
    expect(hard.suggestions.join(" ")).toMatch(/Troque/);
  });
});

describe("destaques na tela", () => {
  it("trechos cobrem o texto inteiro, sem alterar nada, marcando palavra e frase longa", () => {
    const text = "Vamos utilizar " + Array.from({ length: 30 }, () => "isso").join(" ") + ". Fim.";
    const result = analyzeReadability(text);
    const segments = buildHighlightSegments(text, result);
    expect(segments.map((s) => s.text).join("")).toBe(text);
    expect(segments.find((s) => s.word)?.text).toBe("utilizar");
    expect(segments.some((s) => s.band === "LONGA")).toBe(true);
  });

  it("texto com HTML é tratado como texto (nada é interpretado)", () => {
    const text = "<script>alert(1)</script> Olá.";
    const segments = buildHighlightSegments(text, analyzeReadability(text));
    expect(segments.map((s) => s.text).join("")).toBe(text);
  });
});
