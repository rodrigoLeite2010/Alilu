// Download seguro (SSRF, tipo, tamanho, interrupção) contra um servidor HTTP local de verdade.
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const sd = await import("@/lib/instagram-import/backend/safe-download");

describe("isBlockedIp", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.16.0.9", "172.31.255.255", "192.168.0.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "::", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "64:ff9b::a00:1"])(
    "bloqueia %s",
    (ip) => expect(sd.isBlockedIp(ip)).toBe(true),
  );
  it.each(["8.8.8.8", "157.240.22.174", "172.32.0.1", "2a03:2880:f12f:83:face:b00c:0:25de"])("permite %s", (ip) => expect(sd.isBlockedIp(ip)).toBe(false));
});

describe("forma da URL", () => {
  it.each([
    "http://localhost/a.mp4",
    "http://127.0.0.1/a.mp4",
    "http://169.254.169.254/latest/meta-data",
    "http://[::1]/a.mp4",
    "http://10.0.0.5/a.mp4",
    "https://cdn.example.com:8443/a.mp4",
    "file:///etc/passwd",
    "ftp://cdn.example.com/a.mp4",
    "https://user:pw@cdn.example.com/a.mp4",
    "http://metadata.internal/x",
  ])("recusa %s", (url) => {
    expect(() => sd.assertAllowedUrlShape(url)).toThrow(expect.objectContaining({ code: "BLOCKED_URL" }));
  });

  it("nome que resolve para IP interno é bloqueado na conexão (DNS)", async () => {
    // "localhost.localdomain"/nomes locais: a checagem acontece no lookup do socket.
    const lookup = (_host: string, options: { all?: boolean }, cb: (e: NodeJS.ErrnoException | null, a: never, f?: number) => void) => {
      sd.safeLookup("localhost", options, cb as never);
    };
    await expect(
      sd.__downloadWithLookupForTests("http://cdn.example.com/a.mp4", { maxBytes: 1000, allowedContentTypes: ["video/mp4"], timeoutMs: 5000 }, lookup as never),
    ).rejects.toMatchObject({ code: "BLOCKED_URL" });
  });
});

describe("download", () => {
  let server: http.Server;
  let port = 0;
  // Nos testes o servidor é local: um lookup que aponta o nome falso para 127.0.0.1 (o resto do código é o de produção).
  const toLocal = (_host: string, options: { all?: boolean }, cb: (e: NodeJS.ErrnoException | null, a: unknown, f?: number) => void) =>
    options.all ? cb(null, [{ address: "127.0.0.1", family: 4 }]) : cb(null, "127.0.0.1", 4);
  const url = (path: string) => `http://media.test:${port}${path}`;
  const opts = { maxBytes: 1024, allowedContentTypes: ["video/mp4"], timeoutMs: 5000 };

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      if (req.url === "/ok") {
        res.writeHead(200, { "Content-Type": "video/mp4", "Content-Length": "100" });
        res.end(Buffer.alloc(100, 1));
      } else if (req.url === "/big-declared") {
        res.writeHead(200, { "Content-Type": "video/mp4", "Content-Length": "999999" });
        res.end(Buffer.alloc(10));
      } else if (req.url === "/big-stream") {
        res.writeHead(200, { "Content-Type": "video/mp4" });
        res.write(Buffer.alloc(800));
        res.end(Buffer.alloc(800));
      } else if (req.url === "/html") {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<html></html>");
      } else if (req.url === "/cut") {
        res.writeHead(200, { "Content-Type": "video/mp4", "Content-Length": "500" });
        res.write(Buffer.alloc(100));
        setTimeout(() => res.socket?.destroy(), 20);
      } else if (req.url === "/redirect-internal") {
        res.writeHead(302, { Location: "http://169.254.169.254/latest/meta-data" });
        res.end();
      } else if (req.url === "/redirect-ok") {
        res.writeHead(302, { Location: "/ok" });
        res.end();
      } else if (req.url === "/gone") {
        res.writeHead(403);
        res.end();
      }
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    port = (server.address() as AddressInfo).port;
  });
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it("baixa dentro dos limites (e segue redirecionamento válido)", async () => {
    const result = await sd.__downloadWithLookupForTests(url("/ok"), opts, toLocal as never);
    expect(result.buffer.length).toBe(100);
    expect(result.contentType).toBe("video/mp4");
    expect((await sd.__downloadWithLookupForTests(url("/redirect-ok"), opts, toLocal as never)).buffer.length).toBe(100);
  });

  it("arquivo grande demais: declarado ou em streaming", async () => {
    await expect(sd.__downloadWithLookupForTests(url("/big-declared"), opts, toLocal as never)).rejects.toMatchObject({ code: "TOO_LARGE" });
    await expect(sd.__downloadWithLookupForTests(url("/big-stream"), opts, toLocal as never)).rejects.toMatchObject({ code: "TOO_LARGE" });
  });

  it("tipo não permitido, download interrompido, redirecionamento para rede interna e link expirado", async () => {
    await expect(sd.__downloadWithLookupForTests(url("/html"), opts, toLocal as never)).rejects.toMatchObject({ code: "BAD_CONTENT_TYPE" });
    await expect(sd.__downloadWithLookupForTests(url("/cut"), opts, toLocal as never)).rejects.toMatchObject({ code: "INTERRUPTED" });
    await expect(sd.__downloadWithLookupForTests(url("/redirect-internal"), opts, toLocal as never)).rejects.toMatchObject({ code: "BLOCKED_URL" });
    await expect(sd.__downloadWithLookupForTests(url("/gone"), opts, toLocal as never)).rejects.toMatchObject({ code: "HTTP_ERROR", httpStatus: 403 });
  });

  it("produção: o lookup real recusa o servidor local", async () => {
    await expect(sd.safeDownload(`http://localhost:${port}/ok`, opts)).rejects.toMatchObject({ code: "BLOCKED_URL" });
  });
});
