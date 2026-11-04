import "server-only";
import { request } from "node:https";
import { lookup } from "node:dns";
import { BlockList, isIP } from "node:net";
import { createGunzip, createInflate, createBrotliDecompress } from "node:zlib";
import type { IncomingMessage } from "node:http";

// Proteção SSRF: somente https na porta 443, DNS resolvido e validado ANTES da
// conexão (o IP validado é o usado — sem DNS rebinding), redirecionamentos
// manuais revalidados, limites de tempo/tamanho e descompressão limitada.

// Listas separadas: no Node, uma regra IPv6 ::ffff:0:0/96 também casaria todo IPv4.
const blocked = new BlockList();
const blocked6 = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16],
  ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const)
  blocked.addSubnet(net, prefix, "ipv4");
for (const [net, prefix] of [
  ["::", 128], ["::1", 128], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8], ["2001:db8::", 32],
  ["100::", 64], ["64:ff9b::", 96], ["2002::", 16], ["::ffff:0:0", 96],
] as const)
  blocked6.addSubnet(net, prefix, "ipv6");

export class SafeFetchError extends Error {
  constructor(message: string, public code = "fetch") {
    super(message);
  }
}

export function isPublicAddress(address: string) {
  const family = isIP(address);
  if (!family) return false;
  if (family === 6) {
    const mapped = address.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPublicAddress(mapped[1]);
  }
  return family === 4 ? !blocked.check(address, "ipv4") : !blocked6.check(address, "ipv6");
}

export function validateFeedUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new SafeFetchError("URL inválida.", "url");
  }
  if (url.protocol !== "https:") throw new SafeFetchError("Somente URLs https são aceitas.", "url");
  if (url.username || url.password) throw new SafeFetchError("URL com credenciais não é aceita. Use os headers protegidos.", "url");
  if (url.port && url.port !== "443") throw new SafeFetchError("Somente a porta 443 é aceita.", "url");
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || !host.includes(".") && !isIP(host))
    throw new SafeFetchError("Host não permitido.", "url");
  if (isIP(host) && !isPublicAddress(host)) throw new SafeFetchError("Endereço de rede interno não permitido.", "url");
  return url;
}

type Options = {
  method?: "GET" | "POST" | "HEAD";
  headers?: Record<string, string>;
  body?: string;
  maxBytes?: number;
  timeoutMs?: number;
  maxRedirects?: number;
  accept?: RegExp;
};
export type SafeResponse = { status: number; contentType: string; body: Buffer; url: string };

const ALLOWED_HEADERS = /^(authorization|accept|x-api-key|x-auth-token|api-key|apikey|x-access-token|token)$/i;
export function sanitizeHeaders(headers: Record<string, string> = {}) {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (!ALLOWED_HEADERS.test(k)) throw new SafeFetchError(`Header não permitido: ${k}`, "header");
    if (typeof v !== "string" || /[\r\n]/.test(v) || v.length > 4096) throw new SafeFetchError(`Valor inválido no header ${k}.`, "header");
    out[k] = v;
  }
  return out;
}

function pinnedLookup(hostname: string, options: { all?: boolean }, cb: (...args: unknown[]) => void) {
  lookup(hostname, { all: true, verbatim: true }, (err, addresses) => {
    if (err) return cb(err);
    const list = addresses as { address: string; family: number }[];
    if (!list.length || list.some((a) => !isPublicAddress(a.address)))
      return cb(new SafeFetchError("O host resolve para um endereço de rede interno.", "ssrf"));
    if (options?.all) cb(null, list);
    else cb(null, list[0].address, list[0].family);
  });
}

function once(url: URL, opts: Required<Pick<Options, "method" | "maxBytes" | "timeoutMs">> & Options): Promise<{ res: IncomingMessage; body?: Buffer }> {
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        method: opts.method,
        headers: {
          "User-Agent": "AliluImoveisImporter/1.0 (+https://alilu.com.br)",
          "Accept-Encoding": "gzip, deflate, br",
          ...(opts.body ? { "Content-Type": "application/json" } : {}),
          ...opts.headers,
        },
        lookup: pinnedLookup as never,
        timeout: opts.timeoutMs,
      },
      (res) => {
        if ((res.statusCode ?? 0) >= 300 && (res.statusCode ?? 0) < 400) {
          res.resume();
          return resolve({ res });
        }
        if (opts.method === "HEAD") {
          res.resume();
          return resolve({ res, body: Buffer.alloc(0) });
        }
        const declared = Number(res.headers["content-length"] ?? 0);
        if (declared > opts.maxBytes) {
          res.destroy();
          return reject(new SafeFetchError("Resposta acima do limite de tamanho.", "size"));
        }
        const enc = String(res.headers["content-encoding"] ?? "").toLowerCase();
        const stream =
          enc === "gzip" ? res.pipe(createGunzip()) : enc === "deflate" ? res.pipe(createInflate()) : enc === "br" ? res.pipe(createBrotliDecompress()) : res;
        const chunks: Buffer[] = [];
        let size = 0;
        stream.on("data", (c: Buffer) => {
          size += c.length;
          if (size > opts.maxBytes) {
            res.destroy();
            stream.destroy();
            reject(new SafeFetchError("Resposta acima do limite de tamanho.", "size"));
          } else chunks.push(c);
        });
        stream.on("end", () => resolve({ res, body: Buffer.concat(chunks) }));
        stream.on("error", () => reject(new SafeFetchError("Falha ao ler a resposta.", "read")));
      },
    );
    const timer = setTimeout(() => req.destroy(new SafeFetchError("Tempo limite excedido.", "timeout")), opts.timeoutMs);
    req.on("timeout", () => req.destroy(new SafeFetchError("Tempo limite excedido.", "timeout")));
    req.on("error", (e) => {
      clearTimeout(timer);
      reject(e instanceof SafeFetchError ? e : new SafeFetchError("Não foi possível conectar ao feed.", "network"));
    });
    req.on("close", () => clearTimeout(timer));
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

export async function safeFetch(input: string, options: Options = {}): Promise<SafeResponse> {
  const opts = {
    method: options.method ?? "GET",
    maxBytes: options.maxBytes ?? 25 * 1024 * 1024,
    timeoutMs: options.timeoutMs ?? 25000,
    ...options,
    headers: sanitizeHeaders(options.headers),
  };
  let url = validateFeedUrl(input);
  for (let hop = 0; hop <= (options.maxRedirects ?? 3); hop++) {
    const { res, body } = await once(url, opts);
    const status = res.statusCode ?? 0;
    if (status >= 300 && status < 400) {
      const location = res.headers.location;
      if (!location) throw new SafeFetchError("Redirecionamento inválido.", "redirect");
      const next = validateFeedUrl(new URL(location, url).toString());
      // Credenciais só seguem para o mesmo host.
      if (next.host !== url.host) opts.headers = {};
      url = next;
      if (status === 303) opts.method = "GET";
      continue;
    }
    if (status < 200 || status >= 300) throw new SafeFetchError(`O servidor respondeu HTTP ${status}.`, "http");
    const contentType = String(res.headers["content-type"] ?? "");
    if (options.accept && !options.accept.test(contentType))
      throw new SafeFetchError(`Tipo de conteúdo não aceito: ${contentType.slice(0, 60) || "desconhecido"}.`, "type");
    return { status, contentType, body: body ?? Buffer.alloc(0), url: url.toString() };
  }
  throw new SafeFetchError("Redirecionamentos demais.", "redirect");
}
