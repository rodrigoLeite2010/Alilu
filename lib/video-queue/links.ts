/**
 * Leitura, validação e classificação dos links colados na fila (módulo
 * puro — tela e servidor).
 *
 * A classificação decide COMO o vídeo pode ser obtido:
 *   - DIRECT: URL de arquivo (MP4/MOV) em qualquer servidor público — baixado
 *     pelo download seguro (SSRF, tipo, tamanho e tempo checados na conexão);
 *   - INSTAGRAM: reaproveita o importador do Instagram já existente
 *     (provedor autorizado + declaração de direitos + cota diária);
 *   - YOUTUBE, TIKTOK, OTHER_PLATFORM: o Alilu NÃO baixa vídeos dessas
 *     plataformas (sem API oficial de download / sem autorização). O link
 *     fica registrado como "Aguardando autorização ou arquivo" e o usuário
 *     envia o arquivo autorizado por upload.
 *
 * A checagem de IP aqui é só a primeira barreira (IP literal e nomes
 * locais); a proteção real contra SSRF/DNS rebinding acontece no momento
 * da conexão, em lib/instagram-import/backend/safe-download.ts.
 */
import { parseInstagramUrl } from "@/lib/instagram-import/url";
import { parseYoutubeUrl } from "@/lib/youtube-import/url";
import { MAX_LINKS_PER_SUBMISSION, type VideoQueueSourceKind } from "./types";

export interface ParsedQueueLink {
  sourceUrl: string;
  normalizedUrl: string;
  kind: Exclude<VideoQueueSourceKind, "UPLOAD">;
  /** Nome da plataforma (para mensagens) quando não é arquivo direto. */
  platform: string | null;
}

export interface RejectedQueueLink {
  sourceUrl: string;
  reason: string;
}

export interface ParsedQueueLinks {
  accepted: ParsedQueueLink[];
  rejected: RejectedQueueLink[];
  /** Links repetidos no próprio texto colado (mantido só o primeiro). */
  duplicates: string[];
}

const MAX_URL_LENGTH = 2048;

const TIKTOK_HOSTS = ["tiktok.com", "vm.tiktok.com", "vt.tiktok.com"];
const OTHER_PLATFORMS: Array<{ hosts: string[]; name: string }> = [
  { hosts: ["facebook.com", "fb.watch", "fb.com"], name: "Facebook" },
  { hosts: ["x.com", "twitter.com"], name: "X (Twitter)" },
  { hosts: ["kwai.com", "kwai.me", "kw.ai"], name: "Kwai" },
  { hosts: ["twitch.tv", "clips.twitch.tv"], name: "Twitch" },
  { hosts: ["vimeo.com", "player.vimeo.com"], name: "Vimeo" },
  { hosts: ["dailymotion.com", "dai.ly"], name: "Dailymotion" },
  { hosts: ["threads.net", "threads.com"], name: "Threads" },
  { hosts: ["reddit.com", "redd.it", "v.redd.it"], name: "Reddit" },
  { hosts: ["pinterest.com", "pin.it"], name: "Pinterest" },
  { hosts: ["snapchat.com"], name: "Snapchat" },
  { hosts: ["drive.google.com", "dropbox.com", "onedrive.live.com", "1drv.ms", "mega.nz"], name: "serviço de armazenamento" },
];

function hostMatches(host: string, domains: string[]): boolean {
  return domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

function isPrivateIpv4(host: string): boolean {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!match) return false;
  const [a, b] = [Number(match[1]), Number(match[2])];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

/** Rejeita (sem rede) hosts que nunca podem ser buscados: IP literal privado/reservado, IPv6 literal, nomes locais. */
export function isForbiddenHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (!host || host === "localhost" || host.endsWith(".localhost")) return true;
  if (host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".lan") || host.endsWith(".home.arpa")) return true;
  if (host.startsWith("[") || host.includes(":")) return true; // IPv6 literal: nunca aceito na fila
  if (/^\d+$/.test(host)) return true; // IPv4 em formato decimal (ex.: 2130706433)
  if (/^0x[0-9a-f]+$/i.test(host)) return true;
  if (isPrivateIpv4(host)) return true;
  return !host.includes(".");
}

/** Valida e classifica UM link. */
export function parseQueueLink(raw: string): { ok: true; link: ParsedQueueLink } | { ok: false; reason: string } {
  const value = (raw ?? "").trim();
  if (!value) return { ok: false, reason: "Link vazio." };
  if (value.length > MAX_URL_LENGTH) return { ok: false, reason: "Link longo demais." };
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, reason: "Não é um endereço válido (use http:// ou https://)." };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return { ok: false, reason: "Só links http:// ou https://." };
  if (url.username || url.password) return { ok: false, reason: "Links com usuário/senha não são aceitos." };
  if (url.port && url.port !== "80" && url.port !== "443") return { ok: false, reason: "Links com porta não padrão não são aceitos." };
  if (isForbiddenHost(url.hostname)) return { ok: false, reason: "Endereço interno ou privado não é aceito." };

  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  url.hash = "";

  if (hostMatches(host, ["instagram.com", "instagr.am"])) {
    const parsed = parseInstagramUrl(value);
    return {
      ok: true,
      link: { sourceUrl: value, normalizedUrl: parsed.ok ? parsed.normalizedUrl : url.toString(), kind: "INSTAGRAM", platform: "Instagram" },
    };
  }
  if (hostMatches(host, ["youtube.com", "youtu.be", "youtube-nocookie.com"])) {
    const parsed = parseYoutubeUrl(value);
    return {
      ok: true,
      link: { sourceUrl: value, normalizedUrl: parsed.ok ? parsed.normalizedUrl : url.toString(), kind: "YOUTUBE", platform: "YouTube" },
    };
  }
  if (hostMatches(host, TIKTOK_HOSTS)) {
    url.search = "";
    return { ok: true, link: { sourceUrl: value, normalizedUrl: url.toString(), kind: "TIKTOK", platform: "TikTok" } };
  }
  const other = OTHER_PLATFORMS.find((platform) => hostMatches(host, platform.hosts));
  if (other) {
    return { ok: true, link: { sourceUrl: value, normalizedUrl: url.toString(), kind: "OTHER_PLATFORM", platform: other.name } };
  }
  // Arquivo direto: a query string é preservada (links assinados dependem dela).
  url.hostname = host;
  return { ok: true, link: { sourceUrl: value, normalizedUrl: url.toString(), kind: "DIRECT", platform: null } };
}

/**
 * Lê o texto colado ("um link por linha"; também aceita espaços/vírgulas
 * entre links) e devolve aceitos, recusados e repetidos.
 */
export function parseQueueLinks(text: string, limit = MAX_LINKS_PER_SUBMISSION): ParsedQueueLinks & { overLimit: boolean } {
  const tokens = (text ?? "")
    .split(/[\s,;]+/)
    .map((token) => token.trim())
    .filter(Boolean);
  const accepted: ParsedQueueLink[] = [];
  const rejected: RejectedQueueLink[] = [];
  const duplicates: string[] = [];
  const seen = new Set<string>();
  for (const token of tokens) {
    const parsed = parseQueueLink(token);
    if (!parsed.ok) {
      rejected.push({ sourceUrl: token.slice(0, 300), reason: parsed.reason });
      continue;
    }
    if (seen.has(parsed.link.normalizedUrl)) {
      duplicates.push(token.slice(0, 300));
      continue;
    }
    seen.add(parsed.link.normalizedUrl);
    accepted.push(parsed.link);
  }
  return { accepted: accepted.slice(0, limit), rejected, duplicates, overLimit: accepted.length > limit };
}

/** Mensagem para links que o Alilu não baixa (o usuário envia o arquivo autorizado). */
export function waitingFileMessage(kind: VideoQueueSourceKind, platform: string | null): string {
  if (kind === "YOUTUBE") {
    return "O YouTube não permite baixar vídeos pela API oficial. Envie o arquivo original (YouTube Studio → Conteúdo → Baixar) ou o arquivo autorizado pelo dono do vídeo.";
  }
  const name = platform ?? "esta plataforma";
  return `O Alilu não tem integração autorizada para baixar vídeos de ${name}. Envie o arquivo do vídeo (com autorização do dono) para continuar.`;
}
