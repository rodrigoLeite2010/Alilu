import { expect, it } from "vitest";
import { chartLines, importChart, keyOffset, transpose } from "@/lib/music/chart";
import { positionAt } from "@/lib/music/playback";
import { emptySong } from "@/lib/music/types";
import { songInput } from "@/lib/music/validation";

it("converte TXT preservando colunas, palavras e seções", () => {
  const { chart, metadata } = importChart("Título: Minha música\r\nArtista: Eu\r\nTom: C\r\n[Refrão]\r\nC    G/B\r\nAqui começa a letra");
  expect(metadata).toEqual({ title: "Minha música", artist: "Eu", originalKey: "C" });
  expect(chart).toBe("{comment: Refrão}\n[C]Aqui [G/B]começa a letra");
  expect(chartLines(chart)[1].parts.map((part) => part.text).join("")).toBe("Aqui começa a letra");
});

it("lê ChordPro, mantém acordes complexos e transpõe a inversão", () => {
  const { chart, metadata } = importChart("{t: Demo}\n{key: Ebm}\n{soc}\n[F#m7(b5)/C#]Minha letra [Bbmaj7(#11)/D]continua\n{eoc}");
  expect(metadata.originalKey).toBe("Ebm");
  const [heading, line] = chartLines(chart);
  expect(heading.heading).toBe("Refrão");
  expect(line.parts[0].text).toBe("Minha letra ");
  expect(transpose(line.parts[0].chord, keyOffset("Ebm", "Fm"), true)).toBe("Abm7(b5)/Eb");
  expect(transpose(line.parts[1].chord, 2)).toBe("Cmaj7(#11)/E");
});

it("mantém texto ambíguo para revisão e rejeita URLs executáveis", () => {
  expect(importChart("C\nPalavra").review).toBe(true);
  expect(chartLines("Letra [ao longe] <script>")[0].parts[0].text).toBe("Letra [ao longe] <script>");
  expect(() => songInput({ ...emptySong, title: "A", chart: "B", url: "javascript:alert(1)" })).toThrow();
});

it("calcula avanço por tempo, velocidade e extensão e respeita pausa e limites", () => {
  const state = { index: 0, position: 0.2, speed: 50, extent: 500, playing: true };
  expect(positionAt(state, 2000)).toBeCloseTo(0.4);
  expect(positionAt({ ...state, speed: 100 }, 2000)).toBeCloseTo(0.6);
  expect(positionAt({ ...state, playing: false }, 2000)).toBeCloseTo(0.2);
  expect(positionAt(state, -100)).toBeCloseTo(0.2);
  expect(positionAt(state, 30000)).toBe(1);
});

it("preenche os dados de uma cifra copiada com link, negrito e capotraste", () => {
  const input = [
    "Yellow", "[**Coldplay**](https://www.cifraclub.com.br/coldplay/)", "Composição de: Coldplay / A Martin",
    "", "**Tom:  G (com forma de F)**", "**Afinação: E A D G B E**", "**Capotraste: 2ª casa**",
    "", "[Intro]\u00a0**F**\u00a0\u00a0**C**\u00a0\u00a0**A#**",
    "[Primeira\u00a0Parte]", "", "**F**", "", "\u00a0\u00a0Uma frase de teste",
    "", "( **F**  **C**  **A#** )",
  ].join("\n");
  const { chart, metadata } = importChart(input);

  expect(songInput({ ...emptySong, ...metadata, chart })).toMatchObject({
    title: "Yellow", artist: "Coldplay", originalKey: "F", key: "F", capo: "2",
    source: "Cifra Club", url: "https://www.cifraclub.com.br/coldplay/",
    notes: "Composição de: Coldplay / A Martin\nTom que soa com capotraste: G\nAfinação: E A D G B E",
  });
  expect(chart).toContain("{comment: Intro}\n[F]  [C]  [A#]");
  expect(chart).toContain("{comment: Primeira Parte}\n\n[F]  Uma frase de teste");
  expect(chart).toContain("([F]  [C]  [A#])");
  expect(chart).not.toContain("Yellow");
  expect(chart).not.toContain("**");
});

it("reconhece também o cabeçalho sem Markdown", () => {
  const { metadata } = importChart("Uma música\nArtista da banda\nComposição de: Autora\nTom: D\n\n[D]Uma frase");
  expect(metadata).toMatchObject({ title: "Uma música", artist: "Artista da banda", originalKey: "D" });
});
