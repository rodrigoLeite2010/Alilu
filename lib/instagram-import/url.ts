/**
 * Validação/normalização do link do Instagram (módulo puro — tela e servidor).
 *
 * Aceita só https://instagram.com/… e https://www.instagram.com/… (também
 * http, normalizado para https), nos caminhos /reel/{código}, /reels/{código},
 * /p/{código} e /tv/{código} — com ou sem o nome do perfil antes
 * (/{perfil}/reel/{código}). Query string, rastreio (igsh, utm_…) e
 * fragmento são descartados. Encurtadores (instagr.am, l.instagram.com) e
 * Stories NÃO são aceitos nesta versão.
 */

export type InstagramUrlKind = "reel" | "post" | "tv";

export type ParsedInstagramUrl =
  | { ok: true; kind: InstagramUrlKind; shortcode: string; normalizedUrl: string }
  | { ok: false; code: "INVALID_URL" | "UNSUPPORTED"; message: string };

export const INSTAGRAM_URL_MESSAGES = {
  INVALID_URL: "Esse link do Instagram não foi reconhecido.",
  UNSUPPORTED: "Esse formato ainda não é suportado.",
} as const;

const ALLOWED_HOSTS = new Set(["instagram.com", "www.instagram.com"]);
const SHORTCODE_RE = /^[A-Za-z0-9_-]{5,64}$/;
const PROFILE_RE = /^[A-Za-z0-9._]{1,30}$/;

const PATH_KIND: Record<string, InstagramUrlKind> = { reel: "reel", reels: "reel", p: "post", tv: "tv" };
const CANONICAL_SEGMENT: Record<InstagramUrlKind, string> = { reel: "reel", post: "p", tv: "tv" };

export function parseInstagramUrl(raw: string): ParsedInstagramUrl {
  const invalid = { ok: false as const, code: "INVALID_URL" as const, message: INSTAGRAM_URL_MESSAGES.INVALID_URL };
  const unsupported = { ok: false as const, code: "UNSUPPORTED" as const, message: INSTAGRAM_URL_MESSAGES.UNSUPPORTED };
  const value = (raw ?? "").trim();
  if (!value || value.length > 2048) return invalid;

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return invalid;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return invalid;
  if (url.username || url.password || url.port) return invalid;
  const host = url.hostname.toLowerCase();
  if (!ALLOWED_HOSTS.has(host)) return invalid;

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments[0] === "stories") return unsupported;

  // /{tipo}/{código}  ou  /{perfil}/{tipo}/{código}
  let typeIndex = 0;
  if (!(segments[0] in PATH_KIND) && segments.length >= 3 && PROFILE_RE.test(segments[0]) && segments[1] in PATH_KIND) typeIndex = 1;
  const kind = PATH_KIND[segments[typeIndex]];
  const shortcode = segments[typeIndex + 1];
  if (!kind) return segments.length > 0 ? unsupported : invalid;
  if (!shortcode || !SHORTCODE_RE.test(shortcode)) return invalid;
  if (segments.length > typeIndex + 2) return invalid;

  return { ok: true, kind, shortcode, normalizedUrl: `https://www.instagram.com/${CANONICAL_SEGMENT[kind]}/${shortcode}/` };
}

export const INSTAGRAM_IMPORT_KIND_LABEL: Record<InstagramUrlKind | "manual", string> = {
  reel: "Reel",
  post: "Post",
  tv: "Vídeo",
  manual: "Upload manual",
};

export type InstagramImportStatus =
  | "PENDING"
  | "RESOLVING"
  | "READY"
  | "IMPORTING"
  | "COMPLETED"
  | "FAILED"
  | "UNSUPPORTED"
  | "PRIVATE_CONTENT"
  | "INVALID_URL";

export const INSTAGRAM_IMPORT_STATUS_LABEL: Record<InstagramImportStatus, string> = {
  PENDING: "Aguardando",
  RESOLVING: "Identificando",
  READY: "Pronto para importar",
  IMPORTING: "Importando",
  COMPLETED: "Importado",
  FAILED: "Falhou",
  UNSUPPORTED: "Não suportado",
  PRIVATE_CONTENT: "Indisponível",
  INVALID_URL: "Link inválido",
};

export const INSTAGRAM_IMPORT_ERROR_MESSAGES = {
  INVALID_URL: INSTAGRAM_URL_MESSAGES.INVALID_URL,
  PRIVATE_CONTENT: "Esse conteúdo não está disponível publicamente.",
  UNSUPPORTED: INSTAGRAM_URL_MESSAGES.UNSUPPORTED,
  PROVIDER_FAILED: "Não conseguimos importar agora. Tente novamente ou faça upload manual.",
} as const;
