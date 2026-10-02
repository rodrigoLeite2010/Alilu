// Importar do Instagram: validação/normalização do link e provedor Apify (fetch falso).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseInstagramUrl } from "@/lib/instagram-import/url";

const apify = await import("@/lib/instagram-import/backend/providers/apify-provider");
const { InstagramImportProviderError } = await import("@/lib/instagram-import/backend/providers/provider");

describe("parseInstagramUrl", () => {
  it.each([
    ["https://www.instagram.com/reel/DbDp7T4olyC/", "reel", "https://www.instagram.com/reel/DbDp7T4olyC/"],
    ["https://instagram.com/reels/DbDp7T4olyC", "reel", "https://www.instagram.com/reel/DbDp7T4olyC/"],
    ["https://www.instagram.com/p/C1a2B3c4D5e/?igsh=MWx0cGx&utm_source=ig_web_copy_link#comentarios", "post", "https://www.instagram.com/p/C1a2B3c4D5e/"],
    ["http://www.instagram.com/tv/CAbcdEf1234/", "tv", "https://www.instagram.com/tv/CAbcdEf1234/"],
    ["www.instagram.com/alilu.oficial/reel/DbDp7T4olyC/", "reel", "https://www.instagram.com/reel/DbDp7T4olyC/"],
  ])("aceita e normaliza %s", (raw, kind, normalized) => {
    expect(parseInstagramUrl(raw)).toMatchObject({ ok: true, kind, normalizedUrl: normalized });
  });

  it.each([
    "https://evil.com/reel/DbDp7T4olyC/",
    "https://instagram.com.evil.com/reel/DbDp7T4olyC/",
    "https://www.instagram.com.br/reel/DbDp7T4olyC/",
    "https://user:pass@www.instagram.com/reel/DbDp7T4olyC/",
    "https://www.instagram.com:8443/reel/DbDp7T4olyC/",
    "ftp://www.instagram.com/reel/DbDp7T4olyC/",
    "javascript:alert(1)",
    "https://www.instagram.com/reel/abc/",
    "https://www.instagram.com/reel/DbDp7T4olyC/extra/",
    "",
    "não é link",
  ])("recusa como link inválido: %s", (raw) => {
    expect(parseInstagramUrl(raw)).toMatchObject({ ok: false, code: "INVALID_URL" });
  });

  it("perfil e Stories ainda não são suportados", () => {
    expect(parseInstagramUrl("https://www.instagram.com/stories/alilu/123456789/")).toMatchObject({ ok: false, code: "UNSUPPORTED" });
    expect(parseInstagramUrl("https://www.instagram.com/alilu.oficial/")).toMatchObject({ ok: false, code: "UNSUPPORTED" });
  });
});

describe("provedor Apify", () => {
  const originalFetch = global.fetch;
  const originalToken = process.env.APIFY_TOKEN;
  const fetchMock = vi.fn();
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    process.env.APIFY_TOKEN = "apify_api_segredo";
  });
  afterEach(() => {
    global.fetch = originalFetch;
    process.env.APIFY_TOKEN = originalToken;
  });

  it("chama o Actor documentado com o token no cabeçalho (nunca na URL) e lê vídeo", async () => {
    fetchMock.mockResolvedValueOnce(
      json(200, [{ status: true, sourceUrl: "x", media: [{ url: "https://cdn.example/video.mp4", thumbnail: "https://cdn.example/t.jpg", fileType: "video/mp4" }], requestId: "req-1" }]),
    );
    const result = await apify.apifyInstagramProvider.resolve("https://www.instagram.com/reel/DbDp7T4olyC/");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.apify.com/v2/acts/snapinsta~instagram-downloader-api/run-sync-get-dataset-items?timeout=45&clean=true");
    expect(String(url)).not.toContain("segredo");
    expect(init.headers.Authorization).toBe("Bearer apify_api_segredo");
    expect(JSON.parse(init.body)).toEqual({ url: "https://www.instagram.com/reel/DbDp7T4olyC/" });
    expect(result).toMatchObject({ provider: "apify", requestId: "req-1", items: [{ mediaType: "VIDEO", mediaUrl: "https://cdn.example/video.mp4", thumbnailUrl: "https://cdn.example/t.jpg" }] });
  });

  it("post com imagem e carrossel misto", () => {
    const parsed = apify.parseApifyItems([
      {
        status: true,
        media: [
          { url: "https://cdn.example/a.jpg", fileType: "image/jpeg" },
          { url: "https://cdn.example/b.mp4?x=1", thumbnail: "https://cdn.example/b.jpg" },
          { url: "javascript:1", fileType: "video/mp4" },
        ],
      },
    ]);
    expect(parsed.items.map((item) => item.mediaType)).toEqual(["IMAGE", "VIDEO"]);
  });

  it.each([
    ["INVALID_INSTAGRAM_URL", "Provide a supported public Instagram URL.", "INVALID_URL"],
    ["PRIVATE_ACCOUNT", "This account is private", "PRIVATE_CONTENT"],
    ["MEDIA_NOT_FOUND", "Post was deleted", "NOT_FOUND"],
    ["UNSUPPORTED_URL", "Not supported", "UNSUPPORTED"],
    ["INTERNAL", "boom", "PROVIDER_FAILED"],
  ])("erro do Actor %s → %s", (code, message, expected) => {
    expect(() => apify.parseApifyItems([{ status: false, error: { code, message } }])).toThrow(expect.objectContaining({ code: expected }));
  });

  it("sem mídia utilizável = indisponível; HTTP de erro/rede = falha do provedor; sem token não chama", async () => {
    expect(() => apify.parseApifyItems([{ status: true, media: [] }])).toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    fetchMock.mockResolvedValueOnce(json(402, { error: "Not enough usage" }));
    await expect(apify.apifyInstagramProvider.resolve("https://www.instagram.com/p/C1a2B3c4D5e/")).rejects.toMatchObject({ code: "PROVIDER_FAILED", retryable: false });
    fetchMock.mockResolvedValueOnce(json(503, {}));
    await expect(apify.apifyInstagramProvider.resolve("https://www.instagram.com/p/C1a2B3c4D5e/")).rejects.toMatchObject({ code: "PROVIDER_FAILED", retryable: true });
    fetchMock.mockRejectedValueOnce(new Error("ECONNRESET"));
    await expect(apify.apifyInstagramProvider.resolve("https://www.instagram.com/p/C1a2B3c4D5e/")).rejects.toBeInstanceOf(InstagramImportProviderError);
    delete process.env.APIFY_TOKEN;
    fetchMock.mockClear();
    await expect(apify.apifyInstagramProvider.resolve("https://www.instagram.com/p/C1a2B3c4D5e/")).rejects.toMatchObject({ code: "NOT_CONFIGURED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
