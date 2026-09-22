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
  InstagramGraphApiError,
  LONG_LIVED_EXCHANGE_URL,
  REFRESH_URL,
  buildInstagramAuthorizeUrl,
  exchangeCodeForShortLivedToken,
  exchangeForLongLivedToken,
  fetchInstagramProfile,
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
