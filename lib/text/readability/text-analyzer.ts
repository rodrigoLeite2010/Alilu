/**
 * Tokenização para a análise de legibilidade — sem IA, determinística.
 * Responsabilidades separadas: normalizar, separar frases (com abreviações),
 * separar e classificar palavras, contar letras/caracteres/parágrafos.
 * Tudo devolve POSIÇÕES no texto original (o texto nunca é alterado — a
 * tela destaca trechos por posição).
 */

export type TokenKind = "word" | "number" | "url" | "email" | "hashtag" | "mention";

export interface Token {
  /** Texto do token sem pontuação nas pontas. */
  text: string;
  kind: TokenKind;
  start: number;
  end: number;
  /** Índice da frase a que pertence. */
  sentenceIndex: number;
  /** Primeira palavra da frase (maiúscula não indica nome próprio). */
  sentenceStart: boolean;
}

export interface SentenceSpan {
  start: number;
  end: number;
  text: string;
}

/** Abreviações comuns que terminam em ponto e NÃO encerram frase. */
const ABBREVIATIONS = new Set([
  "sr", "sra", "srta", "dr", "dra", "prof", "profa", "etc", "ex", "exa", "av", "pág", "pag", "p", "pp", "vs",
  "art", "arts", "cia", "ltda", "obs", "nº", "no", "n", "tel", "cel", "min", "máx", "max", "aprox", "dept",
  "depto", "eng", "adv", "sto", "sta", "vol", "cap", "fig", "jr", "s.a", "ed", "orgs", "org", "id", "op", "cit",
]);

export function normalizeText(text: string): string {
  return text.replace(/\r\n?/g, "\n").replace(/ /g, " ");
}

function isAbbreviationBefore(text: string, dotIndex: number): boolean {
  let start = dotIndex;
  while (start > 0 && /[\p{L}\p{N}.]/u.test(text[start - 1])) start -= 1;
  const token = text.slice(start, dotIndex).toLowerCase();
  if (!token) return false;
  if (ABBREVIATIONS.has(token)) return true;
  // Inicial de nome ("J. Silva") ou sigla com pontos ("E.U.A.").
  if (/^\p{L}$/u.test(token) && /\p{Lu}/u.test(text[dotIndex - 1])) return true;
  if (/^(\p{L}\.)+\p{L}$/u.test(token)) return true;
  return false;
}

/**
 * Frases: termina em . ! ? … (seguidos de espaço/fim) ou em quebra de linha
 * (listas e legendas costumam não ter ponto). Números decimais ("3.5"),
 * URLs e abreviações conhecidas não quebram a frase.
 */
export function splitSentences(text: string): SentenceSpan[] {
  const sentences: SentenceSpan[] = [];
  let start = 0;
  const push = (end: number) => {
    const raw = text.slice(start, end);
    const trimmedStart = start + (raw.length - raw.trimStart().length);
    const trimmed = raw.trim();
    if (/[\p{L}\p{N}]/u.test(trimmed)) sentences.push({ start: trimmedStart, end: trimmedStart + trimmed.length, text: trimmed });
    start = end;
  };
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "\n") {
      push(index);
      continue;
    }
    if (char !== "." && char !== "!" && char !== "?" && char !== "…") continue;
    const next = text[index + 1];
    if (next !== undefined && !/[\s"'”»)\]]/.test(next) && !/[.!?…]/.test(next)) continue; // 3.5, site.com
    if (char === "." && isAbbreviationBefore(text, index)) continue;
    let end = index + 1;
    while (end < text.length && /[.!?…"'”»)\]]/.test(text[end])) end += 1; // "?!", "...", aspas
    push(end);
    index = end - 1;
  }
  push(text.length);
  return sentences;
}

const URL_RE = /^(https?:\/\/|www\.)\S+$|^[\w-]+(\.[\w-]+)+\/\S*$|^[\w-]+\.(com|com\.br|br|net|org|io|gov|edu)(\.br)?$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NUMBER_RE = /^[+-]?(R\$)?\d[\d.,:/%ºª°x]*$/i;

/** Símbolo de moeda solto ("R$ 10") faz parte do número, não é palavra. */
const CURRENCY_RE = /^(R\$|US\$|U\$|\$|€|£)$/i;

function classify(raw: string): { text: string; kind: TokenKind } | null {
  if (CURRENCY_RE.test(raw)) return null;
  if (EMAIL_RE.test(raw)) return { text: raw, kind: "email" };
  if (URL_RE.test(raw)) return { text: raw, kind: "url" };
  const cleaned = raw.replace(/^[^\p{L}\p{N}#@]+|[^\p{L}\p{N}]+$/gu, "");
  if (!cleaned) return null; // pontuação, emoji
  if (cleaned.startsWith("#") && cleaned.length > 1) return { text: cleaned, kind: "hashtag" };
  if (cleaned.startsWith("@") && cleaned.length > 1) return { text: cleaned, kind: "mention" };
  if (NUMBER_RE.test(cleaned)) return { text: cleaned, kind: "number" };
  if (!/\p{L}/u.test(cleaned)) return /\p{N}/u.test(cleaned) ? { text: cleaned, kind: "number" } : null;
  return { text: cleaned, kind: "word" };
}

export function tokenize(text: string, sentences: SentenceSpan[]): Token[] {
  const tokens: Token[] = [];
  sentences.forEach((sentence, sentenceIndex) => {
    const re = /\S+/g;
    let match: RegExpExecArray | null;
    let first = true;
    while ((match = re.exec(sentence.text))) {
      const classified = classify(match[0]);
      if (!classified) continue;
      const offset = match[0].indexOf(classified.text);
      const start = sentence.start + match.index + Math.max(0, offset);
      tokens.push({ ...classified, start, end: start + classified.text.length, sentenceIndex, sentenceStart: first });
      first = false;
    }
  });
  return tokens;
}

export function countParagraphs(text: string): number {
  return text.split(/\n\s*\n/).filter((block) => /[\p{L}\p{N}]/u.test(block)).length;
}

export function countLetters(value: string): number {
  return (value.match(/\p{L}/gu) ?? []).length;
}
