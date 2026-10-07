/**
 * Regras editoriais PURAS do Carrossel Inteligente: frases genéricas
 * proibidas, nichos sensíveis (exigem fonte), detecção de cópia e
 * normalização de hashtags/URL/@perfil. Sem rede, sem banco.
 */

/** Frases motivacionais vazias: só passam com contexto concreto ao redor (por isso a regra as sinaliza). */
export const GENERIC_PHRASES = [
  "você consegue",
  "nunca desista",
  "transforme sua vida",
  "acredite em você",
  "o sucesso é para todos",
  "seja a mudança",
  "sonhe grande",
  "foco, força e fé",
  "vai dar certo",
] as const;

export function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function normalizeForMatch(value: string): string {
  return stripAccents(value).toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

/** Frases genéricas presentes no texto (vazio = ok). */
export function findGenericPhrases(text: string): string[] {
  const normalized = normalizeForMatch(text);
  return GENERIC_PHRASES.filter((phrase) => normalized.includes(normalizeForMatch(phrase)));
}

const SENSITIVE_KEYWORDS = ["saude", "medic", "nutri", "psic", "financ", "invest", "dinheiro", "credito", "imposto", "direito", "juridic", "advog", "lei"];

/** Saúde, finanças e direito: não inventar dados — exigir fonte ou aviso de confirmação. */
export function isSensitiveNiche(niche: string | null | undefined): boolean {
  if (!niche) return false;
  const normalized = normalizeForMatch(niche);
  return SENSITIVE_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function shingles(text: string, size: number): Set<string> {
  const words = normalizeForMatch(text).split(" ").filter(Boolean);
  const set = new Set<string>();
  for (let index = 0; index + size <= words.length; index += 1) set.add(words.slice(index, index + size).join(" "));
  return set;
}

/**
 * Fração dos trechos de 5 palavras do texto gerado que aparecem
 * literalmente na fonte. Alta = cópia (o carrossel deve ser transformativo).
 */
export function copyOverlap(generated: string, source: string, size = 5): number {
  const generatedShingles = shingles(generated, size);
  if (generatedShingles.size === 0) return 0;
  const sourceShingles = shingles(source, size);
  let hits = 0;
  for (const piece of generatedShingles) if (sourceShingles.has(piece)) hits += 1;
  return hits / generatedShingles.size;
}

export const MAX_COPY_OVERLAP = 0.25;

export function normalizeHashtags(values: unknown, max = 15): string[] {
  const list = Array.isArray(values) ? values : typeof values === "string" ? values.split(/\s+/) : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    if (typeof raw !== "string") continue;
    const word = stripAccents(raw).replace(/[^A-Za-z0-9_]/g, "");
    if (!word || word.length > 40) continue;
    const tag = `#${word.toLowerCase()}`;
    if (seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
    if (out.length >= max) break;
  }
  return out;
}

/** "@perfil", "instagram.com/perfil" ou URL → "perfil" (ou null). */
export function parseInstagramTarget(input: string): string | null {
  const value = input.trim();
  const fromUrl = /^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9._]{1,30})\/?(?:[?#].*)?$/i.exec(value);
  const handle = fromUrl ? fromUrl[1] : value.replace(/^@/, "");
  if (!/^[A-Za-z0-9._]{1,30}$/.test(handle)) return null;
  if (["p", "reel", "reels", "explore", "stories", "accounts"].includes(handle.toLowerCase())) return null;
  return handle.toLowerCase();
}

const PRIVATE_HOST = /^(localhost|.*\.local|.*\.internal|.*\.localhost)$/i;

/** URL pública https aceitável para leitura (bloqueia IP literal, localhost e hosts sem ponto). */
export function parsePublicHttpsUrl(input: string): URL | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  const host = url.hostname;
  if (!host.includes(".") || PRIVATE_HOST.test(host)) return null;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":") || host.startsWith("[")) return null;
  if (url.port && url.port !== "443") return null;
  return url;
}

/** IPv4/IPv6 privado, loopback, link-local ou reservado (para checar o resultado do DNS). */
export function isPrivateAddress(address: string): boolean {
  if (address.includes(":")) {
    const lower = address.toLowerCase();
    return lower === "::1" || lower === "::" || lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80") || lower.startsWith("::ffff:");
  }
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return true;
  const [a, b] = parts;
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

/** Texto legível de um HTML (sem script/style/tags) — só para resumir; nunca republicado. */
export function htmlToText(html: string): { title: string; text: string } {
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "";
  const body = html
    .replace(/<(script|style|noscript|svg|nav|footer|header|form)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|li|h[1-6]|br|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
  const clean = (value: string) => value.replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
  return { title: clean(title).slice(0, 200), text: clean(body) };
}
