/**
 * Validação/normalização do link do YouTube (módulo puro — tela e servidor).
 *
 * Aceita só domínios oficiais do YouTube:
 *   youtube.com, www.youtube.com, m.youtube.com  → /watch?v=ID, /shorts/ID, /live/ID, /embed/ID
 *   youtu.be                                    → /ID
 *   www.youtube-nocookie.com                    → /embed/ID
 * `http` vira `https`; usuário/senha na URL e portas não padrão são recusados;
 * parâmetros extras (t, si, feature, list, utm_…) e fragmento são descartados.
 *
 * O que sai daqui é SÓ o ID do vídeo (11 caracteres [A-Za-z0-9_-]). O servidor
 * nunca acessa a URL colada pelo usuário: ele monta a chamada à API oficial a
 * partir do ID validado — por isso não há superfície de SSRF neste fluxo.
 */

export type YoutubeUrlKind = "video" | "short" | "live";

export type ParsedYoutubeUrl =
  | { ok: true; kind: YoutubeUrlKind; videoId: string; normalizedUrl: string }
  | { ok: false; code: "INVALID_URL" | "UNSUPPORTED"; message: string };

export const YOUTUBE_URL_MESSAGES = {
  INVALID_URL: "Esse link do YouTube não foi reconhecido. Cole o link de um vídeo, Short ou live.",
  UNSUPPORTED: "Esse tipo de link do YouTube ainda não é suportado. Use o link de um vídeo específico (não de canal ou playlist).",
} as const;

export const YOUTUBE_KIND_LABEL: Record<YoutubeUrlKind, string> = {
  video: "Vídeo",
  short: "Short",
  live: "Live",
};

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const WATCH_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com"]);
const NOCOOKIE_HOSTS = new Set(["youtube-nocookie.com", "www.youtube-nocookie.com"]);
const SHORT_HOSTS = new Set(["youtu.be", "www.youtu.be"]);

export function isValidYoutubeVideoId(value: unknown): value is string {
  return typeof value === "string" && VIDEO_ID_RE.test(value);
}

export function canonicalYoutubeUrl(videoId: string, kind: YoutubeUrlKind): string {
  return kind === "short" ? `https://www.youtube.com/shorts/${videoId}` : `https://www.youtube.com/watch?v=${videoId}`;
}

export function parseYoutubeUrl(raw: string): ParsedYoutubeUrl {
  const invalid = { ok: false as const, code: "INVALID_URL" as const, message: YOUTUBE_URL_MESSAGES.INVALID_URL };
  const unsupported = { ok: false as const, code: "UNSUPPORTED" as const, message: YOUTUBE_URL_MESSAGES.UNSUPPORTED };
  const value = (raw ?? "").trim();
  if (!value || value.length > 2048 || /\s/.test(value)) return invalid;

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return invalid;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return invalid;
  if (url.username || url.password) return invalid;
  if (url.port && url.port !== "80" && url.port !== "443") return invalid;

  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  const segments = url.pathname.split("/").filter(Boolean);
  const ok = (videoId: string | null | undefined, kind: YoutubeUrlKind): ParsedYoutubeUrl =>
    isValidYoutubeVideoId(videoId) ? { ok: true, kind, videoId, normalizedUrl: canonicalYoutubeUrl(videoId, kind) } : invalid;

  if (SHORT_HOSTS.has(host)) {
    if (segments.length !== 1) return invalid;
    return ok(segments[0], "video");
  }

  if (NOCOOKIE_HOSTS.has(host)) {
    if (segments[0] === "embed" && segments.length === 2) return ok(segments[1], "video");
    return invalid;
  }

  if (!WATCH_HOSTS.has(host)) return invalid;

  const [first, second] = segments;
  if (first === "watch" && segments.length === 1) return ok(url.searchParams.get("v"), "video");
  if (first === "shorts" && segments.length === 2) return ok(second, "short");
  if (first === "live" && segments.length === 2) return ok(second, "live");
  if ((first === "embed" || first === "v") && segments.length === 2) return ok(second, "video");
  // Canal, playlist, busca, home, @perfil, etc.: domínio certo, formato não suportado.
  return unsupported;
}
