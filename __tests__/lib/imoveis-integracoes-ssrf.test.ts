// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

// DNS controlado: nenhum teste sai para a rede.
const dnsTable: Record<string, string[]> = {
  "interno.example.com": ["10.0.0.5"],
  "metadata.example.com": ["169.254.169.254"],
  "misto.example.com": ["93.184.216.34", "127.0.0.1"],
  "mapeado.example.com": ["::ffff:127.0.0.1"],
};
vi.mock("node:dns", async (importOriginal) => {
  const real = await importOriginal<typeof import("node:dns")>();
  const lookup = (host: string, _opts: unknown, cb: (e: Error | null, a?: unknown) => void) => {
    const list = dnsTable[host];
    if (!list) return cb(Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" }));
    cb(null, list.map((address) => ({ address, family: address.includes(":") ? 6 : 4 })));
  };
  return { ...real, lookup, default: { ...real, lookup } };
});

const { isPublicAddress, safeFetch, sanitizeHeaders, validateFeedUrl } = await import("@/lib/imoveis/integracoes/safe-fetch");

describe("Importador — proteção SSRF dos feeds", () => {
  it("classifica endereços internos, de metadados e mapeados", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.0.10", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1"])
      expect(isPublicAddress(ip), ip).toBe(false);
    for (const ip of ["93.184.216.34", "8.8.8.8", "2606:4700:4700::1111"]) expect(isPublicAddress(ip), ip).toBe(true);
  });
  it("recusa esquemas, portas, credenciais e hosts locais", () => {
    for (const url of ["http://feed.example.com/x", "file:///etc/passwd", "https://feed.example.com:8443/", "https://u:p@feed.example.com/", "https://localhost/", "https://127.0.0.1/", "https://[::1]/", "https://intranet/", "https://api.internal/", "https://169.254.169.254/latest/meta-data"])
      expect(() => validateFeedUrl(url), url).toThrow();
    expect(validateFeedUrl("https://feed.example.com/imoveis.xml").host).toBe("feed.example.com");
  });
  it("bloqueia hosts que resolvem para rede interna antes de conectar (inclusive DNS misto)", async () => {
    for (const host of ["interno.example.com", "metadata.example.com", "misto.example.com", "mapeado.example.com"])
      await expect(safeFetch(`https://${host}/feed.xml`, { timeoutMs: 3000 }), host).rejects.toThrow(/interno|conectar/);
  });
  it("aceita somente headers de autenticação conhecidos e sem injeção", () => {
    expect(sanitizeHeaders({ Authorization: "Bearer abc", "X-Api-Key": "k" })).toEqual({ Authorization: "Bearer abc", "X-Api-Key": "k" });
    expect(() => sanitizeHeaders({ Host: "evil" })).toThrow(/não permitido/);
    expect(() => sanitizeHeaders({ Authorization: "a\r\nX-Evil: 1" })).toThrow(/inválido/);
  });
});
