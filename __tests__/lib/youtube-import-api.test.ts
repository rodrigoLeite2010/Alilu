// Importar do YouTube — cliente da API oficial (Data API v3 + oEmbed) com fetch falso.
import { describe, expect, it, vi } from "vitest";
import { fetchYoutubeMetadata, sanitizeText, sanitizeThumbnailUrl, YoutubeApiError } from "@/lib/youtube-import/backend/youtube-api";

const ID = "dQw4w9WgXcQ";
const KEY = "chave-de-teste-nao-real";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function item(overrides: Record<string, unknown> = {}) {
  return {
    id: ID,
    snippet: {
      title: "Meu vídeo",
      channelTitle: "Canal da Alilu",
      channelId: "UC1234567890",
      liveBroadcastContent: "none",
      thumbnails: { high: { url: `https://i.ytimg.com/vi/${ID}/hqdefault.jpg` }, maxres: { url: `https://i.ytimg.com/vi/${ID}/maxresdefault.jpg` } },
    },
    contentDetails: { duration: "PT4M13S" },
    status: { uploadStatus: "processed", privacyStatus: "public", embeddable: true, madeForKids: false },
    ...overrides,
  };
}

function googleError(status: number, reason: string, message = "erro") {
  return json(status, { error: { code: status, message, errors: [{ reason }] } });
}

describe("YouTube Data API v3", () => {
  it("vídeo existente: mapeia título, canal, duração, miniatura e manda a chave no cabeçalho (nunca na URL)", async () => {
    const fetchImpl = vi.fn(async () => json(200, { items: [item()] }));
    const meta = await fetchYoutubeMetadata(ID, { apiKey: KEY, fetchImpl });
    expect(meta).toMatchObject({
      source: "data_api",
      availability: "AVAILABLE",
      title: "Meu vídeo",
      channelTitle: "Canal da Alilu",
      durationSeconds: 253,
      thumbnailUrl: `https://i.ytimg.com/vi/${ID}/maxresdefault.jpg`,
      embeddable: true,
      madeForKids: false,
      regionRestricted: false,
    });
    const [calledUrl, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(calledUrl.startsWith("https://www.googleapis.com/youtube/v3/videos?")).toBe(true);
    expect(calledUrl).toContain(`id=${ID}`);
    expect(calledUrl).not.toContain(KEY);
    expect((init.headers as Record<string, string>)["X-Goog-Api-Key"]).toBe(KEY);
    expect(init.redirect).toBe("error");
  });

  it("Short com duração curta", async () => {
    const fetchImpl = vi.fn(async () => json(200, { items: [item({ contentDetails: { duration: "PT45S" } })] }));
    expect((await fetchYoutubeMetadata(ID, { apiKey: KEY, fetchImpl })).durationSeconds).toBe(45);
  });

  it("lista vazia + oEmbed 401 → PRIVATE", async () => {
    const fetchImpl = vi.fn(async (url: string) => (url.includes("googleapis") ? json(200, { items: [] }) : new Response("Unauthorized", { status: 401 })));
    const meta = await fetchYoutubeMetadata(ID, { apiKey: KEY, fetchImpl });
    expect(meta.availability).toBe("PRIVATE");
    expect(meta.title).toBeNull();
    expect(fetchImpl.mock.calls[1][0]).toContain("https://www.youtube.com/oembed?format=json&url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DdQw4w9WgXcQ");
  });

  it("lista vazia + oEmbed 404 → NOT_FOUND (inexistente/removido)", async () => {
    const fetchImpl = vi.fn(async (url: string) => (url.includes("googleapis") ? json(200, { items: [] }) : new Response("Not Found", { status: 404 })));
    expect((await fetchYoutubeMetadata(ID, { apiKey: KEY, fetchImpl })).availability).toBe("NOT_FOUND");
  });

  it("lista vazia + oEmbed fora do ar → NOT_FOUND (sem estourar erro)", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes("googleapis")) return json(200, { items: [] });
      throw new TypeError("network");
    });
    expect((await fetchYoutubeMetadata(ID, { apiKey: KEY, fetchImpl })).availability).toBe("NOT_FOUND");
  });

  it.each([
    [{ status: { uploadStatus: "deleted", privacyStatus: "public" } }, "NOT_FOUND"],
    [{ status: { uploadStatus: "rejected", privacyStatus: "public" } }, "UNAVAILABLE"],
    [{ status: { uploadStatus: "failed", privacyStatus: "public" } }, "UNAVAILABLE"],
    [{ status: { uploadStatus: "processed", privacyStatus: "private" } }, "PRIVATE"],
    [{ contentDetails: { duration: "PT3M", contentRating: { ytRating: "ytAgeRestricted" } } }, "AGE_RESTRICTED"],
  ])("situação %#: %j → %s", async (overrides, expected) => {
    const fetchImpl = vi.fn(async () => json(200, { items: [item(overrides)] }));
    expect((await fetchYoutubeMetadata(ID, { apiKey: KEY, fetchImpl })).availability).toBe(expected);
  });

  it("live em andamento e agendada", async () => {
    const live = item({ snippet: { ...item().snippet, liveBroadcastContent: "live" }, contentDetails: { duration: "P0D" } });
    const meta = await fetchYoutubeMetadata(ID, { apiKey: KEY, fetchImpl: async () => json(200, { items: [live] }) });
    expect(meta).toMatchObject({ availability: "LIVE_NOW", durationSeconds: null });
    const upcoming = item({ snippet: { ...item().snippet, liveBroadcastContent: "upcoming" } });
    expect((await fetchYoutubeMetadata(ID, { apiKey: KEY, fetchImpl: async () => json(200, { items: [upcoming] }) })).availability).toBe("UPCOMING");
  });

  it("restrição de região no Brasil e incorporação desativada", async () => {
    const restricted = item({
      contentDetails: { duration: "PT1M", regionRestriction: { blocked: ["BR", "PT"] } },
      status: { uploadStatus: "processed", privacyStatus: "public", embeddable: false },
    });
    const meta = await fetchYoutubeMetadata(ID, { apiKey: KEY, fetchImpl: async () => json(200, { items: [restricted] }) });
    expect(meta).toMatchObject({ availability: "AVAILABLE", regionRestricted: true, embeddable: false });
    const allowedOnlyUs = item({ contentDetails: { duration: "PT1M", regionRestriction: { allowed: ["US"] } } });
    expect((await fetchYoutubeMetadata(ID, { apiKey: KEY, fetchImpl: async () => json(200, { items: [allowedOnlyUs] }) })).regionRestricted).toBe(true);
  });

  it.each([
    [googleError(403, "quotaExceeded"), "QUOTA_EXCEEDED"],
    [googleError(403, "rateLimitExceeded"), "RATE_LIMITED"],
    [new Response("", { status: 429 }), "RATE_LIMITED"],
    [googleError(400, "keyInvalid", "API key not valid. Please pass a valid API key."), "API_AUTH_FAILED"],
    [googleError(403, "accessNotConfigured"), "API_AUTH_FAILED"],
    [googleError(403, "forbidden"), "API_AUTH_FAILED"],
    [json(403, { error: { code: 403, status: "PERMISSION_DENIED", details: [{ reason: "API_KEY_SERVICE_BLOCKED" }] } }), "API_AUTH_FAILED"],
    [new Response("bad gateway", { status: 502 }), "CONNECTION"],
  ])("erro da API %# → %s", async (response, code) => {
    await expect(fetchYoutubeMetadata(ID, { apiKey: KEY, fetchImpl: async () => response })).rejects.toMatchObject({ code });
  });

  it("falha de rede/timeout vira CONNECTION (sem vazar detalhes)", async () => {
    const error = await fetchYoutubeMetadata(ID, { apiKey: KEY, fetchImpl: async () => Promise.reject(new Error(`timeout ${KEY}`)) }).catch((e) => e);
    expect(error).toBeInstanceOf(YoutubeApiError);
    expect(error.code).toBe("CONNECTION");
    expect(String(error.message)).not.toContain(KEY);
  });

  it("ID inválido nunca chega a fazer requisição", async () => {
    const fetchImpl = vi.fn();
    await expect(fetchYoutubeMetadata("../../admin", { apiKey: KEY, fetchImpl })).rejects.toBeInstanceOf(YoutubeApiError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("sem chave (ausência de credenciais): oEmbed oficial", () => {
  it("vídeo público: dados básicos, sem duração, sem cabeçalho de chave", async () => {
    const fetchImpl = vi.fn(async () =>
      json(200, { title: "Título público", author_name: "Canal", thumbnail_url: `https://i.ytimg.com/vi/${ID}/hqdefault.jpg` }),
    );
    const meta = await fetchYoutubeMetadata(ID, { apiKey: "", fetchImpl });
    expect(meta).toMatchObject({ source: "oembed", availability: "AVAILABLE", title: "Título público", channelTitle: "Canal", durationSeconds: null });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url.startsWith("https://www.youtube.com/oembed?")).toBe(true);
    expect((init.headers as Record<string, string>)["X-Goog-Api-Key"]).toBeUndefined();
  });

  it("privado (401) e inexistente (404)", async () => {
    expect((await fetchYoutubeMetadata(ID, { apiKey: null, fetchImpl: async () => new Response("", { status: 401 }) })).availability).toBe("PRIVATE");
    expect((await fetchYoutubeMetadata(ID, { apiKey: null, fetchImpl: async () => new Response("", { status: 404 }) })).availability).toBe("NOT_FOUND");
  });
});

describe("sanitização dos metadados", () => {
  it("texto: remove controle/bidi, junta espaços e limita tamanho", () => {
    expect(sanitizeText("  Olá‮\u0000 mundo\n\n ")).toBe("Olá mundo");
    expect(sanitizeText("<script>alert(1)</script>")).toBe("<script>alert(1)</script>"); // React escapa ao renderizar
    expect(sanitizeText("a".repeat(500))?.length).toBe(200);
    expect(sanitizeText(42)).toBeNull();
  });

  it("miniatura: só https em hosts do YouTube", () => {
    expect(sanitizeThumbnailUrl(`https://i.ytimg.com/vi/${ID}/hqdefault.jpg`)).toBe(`https://i.ytimg.com/vi/${ID}/hqdefault.jpg`);
    expect(sanitizeThumbnailUrl("http://i.ytimg.com/x.jpg")).toBeNull();
    expect(sanitizeThumbnailUrl("https://evil.com/i.ytimg.com.jpg")).toBeNull();
    expect(sanitizeThumbnailUrl("javascript:alert(1)")).toBeNull();
    expect(sanitizeThumbnailUrl("https://i.ytimg.com.evil.com/x.jpg")).toBeNull();
  });
});
