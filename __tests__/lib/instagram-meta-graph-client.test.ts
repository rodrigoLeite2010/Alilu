// @vitest-environment node
//
// Mocka global.fetch para testar os 4 endpoints da Meta sem nenhuma
// chamada de rede real — incluindo os casos de erro HTTP, resposta
// malformada, e os dois formatos possíveis de resposta do endpoint /me
// (achatado e envolvido em {data:[...]}).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTHORIZE_URL,
  CODE_EXCHANGE_URL,
  GRAPH_API_VERSION,
  InstagramGraphApiError,
  LONG_LIVED_EXCHANGE_URL,
  REFRESH_URL,
  buildInstagramAuthorizeUrl,
  createCarouselContainer,
  createCarouselItemContainer,
  createImageMediaContainer,
  exchangeCodeForShortLivedToken,
  exchangeForLongLivedToken,
  fetchInstagramProfile,
  getMediaContainerStatus,
  publishMediaContainer,
  refreshLongLivedToken,
} from "@/lib/instagram/backend/meta-graph-client";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("buildInstagramAuthorizeUrl", () => {
  it("monta a URL de autorização com todos os parâmetros esperados", () => {
    const url = new URL(
      buildInstagramAuthorizeUrl({ appId: "app-123", redirectUri: "https://alilu.com.br/cb", state: "state-abc" }),
    );

    expect(url.origin + url.pathname).toBe(AUTHORIZE_URL);
    expect(url.searchParams.get("client_id")).toBe("app-123");
    expect(url.searchParams.get("redirect_uri")).toBe("https://alilu.com.br/cb");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("state")).toBe("state-abc");
    expect(url.searchParams.get("scope")).toBe("instagram_business_basic,instagram_business_content_publish");
  });
});

describe("exchangeCodeForShortLivedToken", () => {
  const originalFetch = global.fetch;
  const fetchMock = vi.fn();

  beforeEach(() => {
    global.fetch = fetchMock as unknown as typeof fetch;
    fetchMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("faz POST para o endpoint correto e retorna os dados na resposta de sucesso", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        data: [{ access_token: "short-token", user_id: "17841400000000000", permissions: "instagram_business_basic,instagram_business_content_publish" }],
      }),
    );

    const result = await exchangeCodeForShortLivedToken({
      appId: "app-1",
      appSecret: "secret-1",
      redirectUri: "https://alilu.com.br/cb",
      code: "code-1",
    });

    expect(fetchMock).toHaveBeenCalledWith(CODE_EXCHANGE_URL, expect.objectContaining({ method: "POST" }));
    expect(result).toEqual({
      accessToken: "short-token",
      igUserId: "17841400000000000",
      permissions: ["instagram_business_basic", "instagram_business_content_publish"],
    });
  });

  it("aceita permissions já como array", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { data: [{ access_token: "short-token", user_id: 123, permissions: ["a", "b"] }] }),
    );

    const result = await exchangeCodeForShortLivedToken({
      appId: "app-1",
      appSecret: "secret-1",
      redirectUri: "https://alilu.com.br/cb",
      code: "code-1",
    });

    expect(result.igUserId).toBe("123");
    expect(result.permissions).toEqual(["a", "b"]);
  });

  it("aceita a resposta achatada, sem o envelope { data: [...] } (formato visto em produção)", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        access_token: "short-token",
        user_id: 28636009026025692,
        permissions: ["instagram_business_basic", "instagram_business_content_publish"],
      }),
    );

    const result = await exchangeCodeForShortLivedToken({
      appId: "app-1",
      appSecret: "secret-1",
      redirectUri: "https://alilu.com.br/cb",
      code: "code-1",
    });

    expect(result).toEqual({
      accessToken: "short-token",
      igUserId: "28636009026025692",
      permissions: ["instagram_business_basic", "instagram_business_content_publish"],
    });
  });

  it("lança InstagramGraphApiError quando a resposta HTTP não é ok", async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, { error: "invalid_code" }));

    await expect(
      exchangeCodeForShortLivedToken({ appId: "a", appSecret: "s", redirectUri: "r", code: "c" }),
    ).rejects.toThrow(InstagramGraphApiError);
  });

  it("lança InstagramGraphApiError quando a resposta não tem o formato esperado", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { unexpected: true }));

    await expect(
      exchangeCodeForShortLivedToken({ appId: "a", appSecret: "s", redirectUri: "r", code: "c" }),
    ).rejects.toThrow(InstagramGraphApiError);
  });
});

describe("exchangeForLongLivedToken / refreshLongLivedToken", () => {
  const originalFetch = global.fetch;
  const fetchMock = vi.fn();

  beforeEach(() => {
    global.fetch = fetchMock as unknown as typeof fetch;
    fetchMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("exchangeForLongLivedToken chama o endpoint correto e retorna o token de longa duração", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { access_token: "long-token", token_type: "bearer", expires_in: 5184000 }));

    const result = await exchangeForLongLivedToken({ appSecret: "secret-1", shortLivedAccessToken: "short-token" });

    const calledUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(calledUrl.origin + calledUrl.pathname).toBe(LONG_LIVED_EXCHANGE_URL);
    expect(calledUrl.searchParams.get("grant_type")).toBe("ig_exchange_token");
    expect(result).toEqual({ accessToken: "long-token", expiresInSeconds: 5184000 });
  });

  it("refreshLongLivedToken chama o endpoint de refresh com o grant_type correto", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { access_token: "renewed-token", token_type: "bearer", expires_in: 5184000 }));

    const result = await refreshLongLivedToken("old-token");

    const calledUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(calledUrl.origin + calledUrl.pathname).toBe(REFRESH_URL);
    expect(calledUrl.searchParams.get("grant_type")).toBe("ig_refresh_token");
    expect(calledUrl.searchParams.get("access_token")).toBe("old-token");
    expect(result.accessToken).toBe("renewed-token");
  });

  it("lança InstagramGraphApiError quando a Meta responde com erro HTTP", async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, { error: "invalid_token" }));

    await expect(exchangeForLongLivedToken({ appSecret: "s", shortLivedAccessToken: "t" })).rejects.toThrow(
      InstagramGraphApiError,
    );
  });

  it("lança InstagramGraphApiError quando falta expires_in ou access_token na resposta", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { access_token: "token-sem-expiracao" }));

    await expect(exchangeForLongLivedToken({ appSecret: "s", shortLivedAccessToken: "t" })).rejects.toThrow(
      InstagramGraphApiError,
    );
  });
});

describe("fetchInstagramProfile", () => {
  const originalFetch = global.fetch;
  const fetchMock = vi.fn();

  beforeEach(() => {
    global.fetch = fetchMock as unknown as typeof fetch;
    fetchMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("aceita o formato achatado ({ user_id, username })", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { user_id: "178414000", username: "alilu.tec" }));

    const result = await fetchInstagramProfile("token-x");

    expect(result).toEqual({ igUserId: "178414000", username: "alilu.tec" });
  });

  it("aceita o formato envolvido em { data: [...] }", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { data: [{ user_id: "178414000", username: "alilu.tec" }] }));

    const result = await fetchInstagramProfile("token-x");

    expect(result).toEqual({ igUserId: "178414000", username: "alilu.tec" });
  });

  it("usa username null quando o campo não vem na resposta", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { user_id: "178414000" }));

    const result = await fetchInstagramProfile("token-x");

    expect(result).toEqual({ igUserId: "178414000", username: null });
  });

  it("lança InstagramGraphApiError quando a resposta HTTP não é ok", async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, { error: "invalid_token" }));

    await expect(fetchInstagramProfile("token-x")).rejects.toThrow(InstagramGraphApiError);
  });

  it("lança InstagramGraphApiError quando não há user_id em nenhum formato", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { foo: "bar" }));

    await expect(fetchInstagramProfile("token-x")).rejects.toThrow(InstagramGraphApiError);
  });
});

describe("createImageMediaContainer", () => {
  const originalFetch = global.fetch;
  const fetchMock = vi.fn();

  beforeEach(() => {
    global.fetch = fetchMock as unknown as typeof fetch;
    fetchMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("faz POST para <ig-user-id>/media com image_url, caption e access_token, retornando o id do container", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: "container-123" }));

    const id = await createImageMediaContainer({
      igUserId: "ig-1",
      accessToken: "token-1",
      imageUrl: "https://blob.example.com/foto.jpg",
      caption: "Minha legenda",
    });

    expect(id).toBe("container-123");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://graph.instagram.com/${GRAPH_API_VERSION}/ig-1/media`);
    expect(init.method).toBe("POST");
    const body = init.body as URLSearchParams;
    expect(body.get("image_url")).toBe("https://blob.example.com/foto.jpg");
    expect(body.get("caption")).toBe("Minha legenda");
    expect(body.get("access_token")).toBe("token-1");
  });

  it("omite caption quando vazia", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: "container-123" }));

    await createImageMediaContainer({
      igUserId: "ig-1",
      accessToken: "token-1",
      imageUrl: "https://blob.example.com/foto.jpg",
      caption: "",
    });

    const body = fetchMock.mock.calls[0][1].body as URLSearchParams;
    expect(body.has("caption")).toBe(false);
  });

  it("lança InstagramGraphApiError numa resposta de erro HTTP", async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, { error: { message: "Invalid image_url" } }));

    await expect(
      createImageMediaContainer({ igUserId: "ig-1", accessToken: "t", imageUrl: "x", caption: "" }),
    ).rejects.toThrow(InstagramGraphApiError);
  });

  it("lança InstagramGraphApiError quando a resposta não tem id", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { algumaCoisa: true }));

    await expect(
      createImageMediaContainer({ igUserId: "ig-1", accessToken: "t", imageUrl: "x", caption: "" }),
    ).rejects.toThrow(InstagramGraphApiError);
  });
});

describe("getMediaContainerStatus", () => {
  const originalFetch = global.fetch;
  const fetchMock = vi.fn();

  beforeEach(() => {
    global.fetch = fetchMock as unknown as typeof fetch;
    fetchMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("faz GET para <container-id>?fields=status_code e retorna o status", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { status_code: "FINISHED" }));

    const status = await getMediaContainerStatus({ containerId: "container-1", accessToken: "token-1" });

    expect(status).toBe("FINISHED");
    const [url] = fetchMock.mock.calls[0];
    const parsed = new URL(url as string);
    expect(parsed.origin + parsed.pathname).toBe(`https://graph.instagram.com/${GRAPH_API_VERSION}/container-1`);
    expect(parsed.searchParams.get("fields")).toBe("status_code");
    expect(parsed.searchParams.get("access_token")).toBe("token-1");
  });

  it.each(["EXPIRED", "ERROR", "FINISHED", "IN_PROGRESS", "PUBLISHED"])(
    "aceita o status_code conhecido '%s'",
    async (statusCode) => {
      fetchMock.mockResolvedValue(jsonResponse(200, { status_code: statusCode }));
      const status = await getMediaContainerStatus({ containerId: "c", accessToken: "t" });
      expect(status).toBe(statusCode);
    },
  );

  it("lança InstagramGraphApiError para um status_code desconhecido", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { status_code: "ALGO_NOVO_NUNCA_VISTO" }));

    await expect(getMediaContainerStatus({ containerId: "c", accessToken: "t" })).rejects.toThrow(
      InstagramGraphApiError,
    );
  });

  it("lança InstagramGraphApiError numa resposta de erro HTTP", async () => {
    fetchMock.mockResolvedValue(jsonResponse(404, { error: { message: "not found" } }));

    await expect(getMediaContainerStatus({ containerId: "c", accessToken: "t" })).rejects.toThrow(
      InstagramGraphApiError,
    );
  });
});

describe("publishMediaContainer", () => {
  const originalFetch = global.fetch;
  const fetchMock = vi.fn();

  beforeEach(() => {
    global.fetch = fetchMock as unknown as typeof fetch;
    fetchMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("faz POST para <ig-user-id>/media_publish com creation_id, retornando o id da mídia publicada", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: "media-999" }));

    const mediaId = await publishMediaContainer({
      igUserId: "ig-1",
      accessToken: "token-1",
      containerId: "container-1",
    });

    expect(mediaId).toBe("media-999");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://graph.instagram.com/${GRAPH_API_VERSION}/ig-1/media_publish`);
    expect(init.method).toBe("POST");
    const body = init.body as URLSearchParams;
    expect(body.get("creation_id")).toBe("container-1");
    expect(body.get("access_token")).toBe("token-1");
  });

  it("lança InstagramGraphApiError numa resposta de erro HTTP", async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, { error: { message: "Media ID is not available" } }));

    await expect(
      publishMediaContainer({ igUserId: "ig-1", accessToken: "t", containerId: "c" }),
    ).rejects.toThrow(InstagramGraphApiError);
  });

  it("lança InstagramGraphApiError quando a resposta não tem id", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}));

    await expect(
      publishMediaContainer({ igUserId: "ig-1", accessToken: "t", containerId: "c" }),
    ).rejects.toThrow(InstagramGraphApiError);
  });
});

describe("createCarouselItemContainer", () => {
  const originalFetch = global.fetch;
  const fetchMock = vi.fn();

  beforeEach(() => {
    global.fetch = fetchMock as unknown as typeof fetch;
    fetchMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("faz POST para <ig-user-id>/media com image_url, is_carousel_item=true e SEM caption", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: "item-container-1" }));

    const id = await createCarouselItemContainer({
      igUserId: "ig-1",
      accessToken: "token-1",
      imageUrl: "https://blob.example.com/slide-01.jpg",
    });

    expect(id).toBe("item-container-1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://graph.instagram.com/${GRAPH_API_VERSION}/ig-1/media`);
    expect(init.method).toBe("POST");
    const body = init.body as URLSearchParams;
    expect(body.get("image_url")).toBe("https://blob.example.com/slide-01.jpg");
    expect(body.get("is_carousel_item")).toBe("true");
    expect(body.has("caption")).toBe(false);
    expect(body.get("access_token")).toBe("token-1");
  });

  it("lança InstagramGraphApiError numa resposta de erro HTTP", async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, { error: { message: "Invalid image_url" } }));

    await expect(
      createCarouselItemContainer({ igUserId: "ig-1", accessToken: "t", imageUrl: "x" }),
    ).rejects.toThrow(InstagramGraphApiError);
  });

  it("lança InstagramGraphApiError quando a resposta não tem id", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { algumaCoisa: true }));

    await expect(
      createCarouselItemContainer({ igUserId: "ig-1", accessToken: "t", imageUrl: "x" }),
    ).rejects.toThrow(InstagramGraphApiError);
  });
});

describe("createCarouselContainer", () => {
  const originalFetch = global.fetch;
  const fetchMock = vi.fn();

  beforeEach(() => {
    global.fetch = fetchMock as unknown as typeof fetch;
    fetchMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("faz POST para <ig-user-id>/media com media_type=CAROUSEL, children e caption, retornando o id do container", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: "carousel-container-1" }));

    const id = await createCarouselContainer({
      igUserId: "ig-1",
      accessToken: "token-1",
      childrenContainerIds: ["item-1", "item-2", "item-3"],
      caption: "Legenda do carrossel",
    });

    expect(id).toBe("carousel-container-1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://graph.instagram.com/${GRAPH_API_VERSION}/ig-1/media`);
    expect(init.method).toBe("POST");
    const body = init.body as URLSearchParams;
    expect(body.get("media_type")).toBe("CAROUSEL");
    expect(body.get("children")).toBe("item-1,item-2,item-3");
    expect(body.get("caption")).toBe("Legenda do carrossel");
    expect(body.get("access_token")).toBe("token-1");
  });

  it("omite caption quando vazia", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: "carousel-container-1" }));

    await createCarouselContainer({
      igUserId: "ig-1",
      accessToken: "token-1",
      childrenContainerIds: ["item-1", "item-2"],
      caption: "",
    });

    const body = fetchMock.mock.calls[0][1].body as URLSearchParams;
    expect(body.has("caption")).toBe(false);
  });

  it("lança InstagramGraphApiError numa resposta de erro HTTP", async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, { error: { message: "Invalid children" } }));

    await expect(
      createCarouselContainer({ igUserId: "ig-1", accessToken: "t", childrenContainerIds: ["a", "b"], caption: "" }),
    ).rejects.toThrow(InstagramGraphApiError);
  });

  it("lança InstagramGraphApiError quando a resposta não tem id", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { algumaCoisa: true }));

    await expect(
      createCarouselContainer({ igUserId: "ig-1", accessToken: "t", childrenContainerIds: ["a", "b"], caption: "" }),
    ).rejects.toThrow(InstagramGraphApiError);
  });
});
