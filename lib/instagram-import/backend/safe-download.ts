import "server-only";
import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";

/**
 * Download de URL EXTERNA (devolvida pelo provedor) com proteção contra
 * SSRF e limites:
 *   - só http/https, sem usuário/senha na URL, portas 80/443;
 *   - o IP é checado NO MOMENTO DA CONEXÃO (lookup próprio do socket —
 *     resiste a DNS rebinding): bloqueia loopback, rede privada,
 *     link-local (169.254.x.x / metadados de nuvem), CGNAT, multicast,
 *     IPv6 local/ULA e IPv4 mapeado em IPv6;
 *   - redirecionamentos (máx. 3) são revalidados a cada salto;
 *   - Content-Type permitido, tamanho máximo (corta o download ao passar)
 *     e tempo máximo.
 */

export class SafeDownloadError extends Error {
  constructor(
    message: string,
    readonly code: "BLOCKED_URL" | "TOO_LARGE" | "BAD_CONTENT_TYPE" | "HTTP_ERROR" | "TIMEOUT" | "INTERRUPTED",
    readonly httpStatus: number | null = null,
  ) {
    super(message);
    this.name = "SafeDownloadError";
  }
}

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

const BLOCKED_V4: Array<[string, number]> = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

/** true = endereço que NUNCA pode ser acessado (rede interna/reservada). */
export function isBlockedIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) {
    const value = ipv4ToInt(ip);
    return BLOCKED_V4.some(([base, bits]) => {
      const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
      return (value & mask) === (ipv4ToInt(base) & mask);
    });
  }
  if (version === 6) {
    const lower = ip.toLowerCase().replace(/^\[|\]$/g, "");
    if (lower === "::" || lower === "::1") return true;
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isBlockedIp(mapped[1]);
    if (/^::ffff:[0-9a-f]{1,4}:[0-9a-f]{1,4}$/.test(lower)) return true; // v4 mapeado em hexadecimal
    const first = parseInt(lower.split(":")[0] || "0", 16);
    if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 (ULA)
    if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 (link-local)
    if ((first & 0xff00) === 0xff00) return true; // multicast
    if (lower.startsWith("64:ff9b:")) return true; // NAT64 (pode apontar para IPv4 interno)
    return false;
  }
  return true;
}

type LookupFn = (
  hostname: string,
  options: { all?: boolean; family?: number },
  callback: (error: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void,
) => void;

/** lookup usado pelo socket: resolve e REJEITA se qualquer endereço for interno. */
export const safeLookup: LookupFn = (hostname, options, callback) => {
  dnsLookup(hostname, { all: true }, (error, addresses) => {
    if (error) return callback(error, "", 0);
    const list = addresses as LookupAddress[];
    if (list.length === 0 || list.some((entry) => isBlockedIp(entry.address))) {
      const blocked = new Error("Endereço bloqueado.") as NodeJS.ErrnoException;
      blocked.code = "EBLOCKED";
      return callback(blocked, "", 0);
    }
    if (options.all) return callback(null, list);
    return callback(null, list[0].address, list[0].family);
  });
};

/** Validação sintática (antes de qualquer rede). */
export function assertAllowedUrlShape(raw: string, allowAnyPort = false): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SafeDownloadError("URL inválida.", "BLOCKED_URL");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new SafeDownloadError("Protocolo não permitido.", "BLOCKED_URL");
  if (url.username || url.password) throw new SafeDownloadError("URL não permitida.", "BLOCKED_URL");
  if (!allowAnyPort && url.port && url.port !== "80" && url.port !== "443") throw new SafeDownloadError("Porta não permitida.", "BLOCKED_URL");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
    throw new SafeDownloadError("Endereço bloqueado.", "BLOCKED_URL");
  }
  if (isIP(host) && isBlockedIp(host)) throw new SafeDownloadError("Endereço bloqueado.", "BLOCKED_URL");
  return url;
}

export interface SafeDownloadOptions {
  maxBytes: number;
  /** Prefixos aceitos, ex.: ["video/mp4", "video/quicktime"]. */
  allowedContentTypes: string[];
  timeoutMs?: number;
  maxRedirects?: number;
}

export interface SafeDownloadResult {
  buffer: Buffer;
  contentType: string;
  finalUrl: string;
}

function requestOnce(url: URL, options: SafeDownloadOptions, lookup: LookupFn): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: http.IncomingMessage }> {
  return new Promise((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http;
    const request = client.get(
      url,
      {
        lookup: lookup as unknown as typeof dnsLookup,
        headers: { "User-Agent": "AliluImporter/1.0", Accept: "*/*" },
        timeout: options.timeoutMs ?? 45_000,
      },
      (response) => resolve({ status: response.statusCode ?? 0, headers: response.headers, body: response }),
    );
    request.on("timeout", () => request.destroy(new SafeDownloadError("Tempo esgotado ao baixar o arquivo.", "TIMEOUT")));
    request.on("error", (error: NodeJS.ErrnoException) => {
      if (error instanceof SafeDownloadError) return reject(error);
      if (error.code === "EBLOCKED") return reject(new SafeDownloadError("Endereço bloqueado.", "BLOCKED_URL"));
      reject(new SafeDownloadError("Falha de conexão ao baixar o arquivo.", "INTERRUPTED"));
    });
  });
}

async function download(raw: string, options: SafeDownloadOptions, lookup: LookupFn, allowAnyPort = false): Promise<SafeDownloadResult> {
  let url = assertAllowedUrlShape(raw, allowAnyPort);
  const deadline = Date.now() + (options.timeoutMs ?? 45_000);
  for (let hop = 0; hop <= (options.maxRedirects ?? 3); hop += 1) {
    const { status, headers, body } = await requestOnce(url, options, lookup);
    if (status >= 300 && status < 400 && headers.location) {
      body.resume();
      url = assertAllowedUrlShape(new URL(headers.location, url).toString(), allowAnyPort);
      continue;
    }
    if (status < 200 || status >= 300) {
      body.resume();
      throw new SafeDownloadError(`O servidor respondeu ${status}.`, "HTTP_ERROR", status);
    }
    const contentType = String(headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
    if (!options.allowedContentTypes.some((allowed) => contentType === allowed)) {
      body.resume();
      throw new SafeDownloadError("Tipo de arquivo não permitido.", "BAD_CONTENT_TYPE");
    }
    const declared = Number(headers["content-length"] ?? NaN);
    if (Number.isFinite(declared) && declared > options.maxBytes) {
      body.destroy();
      throw new SafeDownloadError("Arquivo grande demais.", "TOO_LARGE");
    }
    return await new Promise<SafeDownloadResult>((resolve, reject) => {
      const chunks: Buffer[] = [];
      let total = 0;
      let settled = false;
      let failure: SafeDownloadError | null = null;
      const finish = (error: SafeDownloadError | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (error) reject(error);
        else resolve({ buffer: Buffer.concat(chunks), contentType, finalUrl: url.toString() });
      };
      const abort = (error: SafeDownloadError) => {
        failure = failure ?? error;
        body.destroy();
        finish(failure);
      };
      const timer = setTimeout(() => abort(new SafeDownloadError("Tempo esgotado ao baixar o arquivo.", "TIMEOUT")), Math.max(1, deadline - Date.now()));
      body.on("data", (chunk: Buffer) => {
        if (failure) return;
        total += chunk.length;
        if (total > options.maxBytes) {
          abort(new SafeDownloadError("Arquivo grande demais.", "TOO_LARGE"));
          return;
        }
        chunks.push(chunk);
      });
      const interrupted = () => finish(failure ?? new SafeDownloadError("O download foi interrompido.", "INTERRUPTED"));
      body.on("error", interrupted);
      body.on("aborted", interrupted);
      body.on("end", () => {
        if (!body.complete || (Number.isFinite(declared) && total !== declared)) return interrupted();
        finish(null);
      });
    });
  }
  throw new SafeDownloadError("Redirecionamentos demais.", "BLOCKED_URL");
}

export function safeDownload(url: string, options: SafeDownloadOptions): Promise<SafeDownloadResult> {
  return download(url, options, safeLookup);
}

/** Só para testes: troca a resolução de nomes e aceita a porta do servidor local (limites, tipos e redirecionamentos são o mesmo código). */
export function __downloadWithLookupForTests(url: string, options: SafeDownloadOptions, lookup: LookupFn): Promise<SafeDownloadResult> {
  return download(url, options, lookup, true);
}
