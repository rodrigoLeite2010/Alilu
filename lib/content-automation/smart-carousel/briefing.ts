/**
 * "Briefing" do Piloto: quando o prompt da automação fala da SUA empresa e lista os
 * assuntos (ex.: "explore um tema diferente: riscos de contratar desconhecidos,
 * histórias do cotidiano, segurança nos condomínios..."), cada carrossel sai de um
 * desses assuntos — e não do banco genérico de temas da Alilu. Funções PURAS.
 */
import { createRng } from "../smart-story/random";
import { findRepeat } from "./selection";

const MIN_THEMES = 3;
const MAX_THEMES = 30;

function cleanItem(raw: string): string {
  return raw
    .replace(/^[\s\-–—•*·\d.)]+/, "")
    .replace(/^(e|ou)\s+/i, "")
    .replace(/["“”'`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.;:,!]+$/, "");
}

function splitList(segment: string): string[] {
  const parts = segment.split(/[;,]/).flatMap((part, index, all) => {
    // "a, b e c": o último item costuma vir unido por " e ".
    if (index === all.length - 1 && all.length > 1) return part.split(/\s+e\s+/i);
    return [part];
  });
  return parts.map(cleanItem).filter((item) => item.length >= 4 && item.length <= 90 && item.split(" ").length <= 12);
}

/**
 * Assuntos listados no prompt: listas depois de ":" (separadas por vírgula/";"/" e ")
 * ou linhas em tópicos ("- assunto"). Menos de 3 = o prompt não lista assuntos.
 */
export function extractBriefingThemes(prompt: string | null | undefined): string[] {
  const text = (prompt ?? "").replace(/\r/g, "");
  if (!text.trim()) return [];
  const found: string[] = [];

  const bullets = text
    .split("\n")
    .filter((line) => /^\s*([-–—•*·]|\d+[.)])\s+/.test(line))
    .map(cleanItem)
    .filter((item) => item.length >= 4 && item.length <= 90);
  if (bullets.length >= MIN_THEMES) found.push(...bullets);

  for (const match of text.matchAll(/:([^:\n]+?)(?:\.(?:\s|$)|\n|$)/g)) {
    const items = splitList(match[1]);
    if (items.length >= MIN_THEMES) found.push(...items);
  }

  const unique: string[] = [];
  for (const item of found) {
    if (!unique.some((existing) => existing.toLowerCase() === item.toLowerCase())) unique.push(item);
  }
  return unique.slice(0, MAX_THEMES);
}

/**
 * Escolhe o assunto do carrossel entre os do prompt, sem repetir os recentes
 * (mesma semente = mesmo assunto, então um retry não troca o tema). Todos usados
 * recentemente → o menos recente.
 */
export function pickBriefingTheme(themes: readonly string[], recentTopics: readonly string[], seed: string): string | null {
  if (themes.length === 0) return null;
  const free = themes.filter((theme) => !findRepeat(theme, recentTopics));
  const rng = createRng(`carousel-briefing|${seed}`);
  if (free.length > 0) return free[Math.floor(rng() * free.length)];
  const age = (theme: string) => {
    const index = recentTopics.findIndex((previous) => findRepeat(theme, [previous]));
    return index === -1 ? Number.POSITIVE_INFINITY : index;
  };
  return [...themes].sort((a, b) => age(b) - age(a))[0];
}
