// @vitest-environment node
//
// Testa a orquestração do fluxo de conexão mockando o cliente da Meta, o
// repositório e a criptografia — nenhuma chamada de rede ou de banco real.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class FakeInstagramGraphApiError extends Error {
  details: unknown;
  constructor(message: string, details?: unknown) {
    super(message);
    this.name = "InstagramGraphApiError";
    this.details = details;
  }
}

const exchangeCodeForShortLivedTokenMock = vi.fn();
const exchangeForLongLivedTokenMock = vi.fn();
const fetchInstagramProfileMock = vi.fn();
const buildInstagramAuthorizeUrlMock = vi.fn();
const refreshLongLivedTokenMock = vi.fn();
const repoMocks = {
  listAccountsNeedingTokenRefresh: vi.fn(),
  markExpiredInstagramAccounts: vi.fn(),
  setInstagramAccountStatus: vi.fn(),
  updateInstagramAccountToken: vi.fn(),
};
vi.mock("@/lib/instagram/backend/meta-graph-client", () => ({
  InstagramGraphApiError: FakeInstagramGraphApiError,
  exchangeCodeForShortLivedToken: (...args: unknown[]) => exchangeCodeForShortLivedTokenMock(...args),
  exchangeForLongLivedToken: (...args: unknown[]) => exchangeForLongLivedTokenMock(...args),
  fetchInstagramProfile: (...args: unknown[]) => fetchInstagramProfileMock(...args),
  buildInstagramAuthorizeUrl: (...args: unknown[]) => buildInstagramAuthorizeUrlMock(...args),
  refreshLongLivedToken: (...args: unknown[]) => refreshLongLivedTokenMock(...args),
  describeMetaError: (details: unknown) => {
    const inner = (details as { error?: { code?: number; message?: string } } | null)?.error;
    return { code: inner?.code ?? null, subcode: null, type: null, message: inner?.message ?? null };
  },
}));
vi.mock("@/lib/instagram/backend/oauth-log", () => ({ logInstagramOAuth: vi.fn(async () => undefined) }));

const upsertInstagramAccountMock = vi.fn();
vi.mock("@/lib/instagram/backend/instagram-account-repository", () => ({
  upsertInstagramAccount: (...args: unknown[]) => upsertInstagramAccountMock(...args),
  getInstagramAccountForUser: vi.fn(),
  ...repoMocks,
}));

const encryptSecretMock = vi.fn();
vi.mock("@/lib/instagram/backend/encryption", () => ({
  encryptSecret: (...args: unknown[]) => encryptSecretMock(...args),
  decryptSecret: (value: string) => `plain:${value}`,
}));

const {
  InstagramOAuthConfigError,
  InstagramOAuthExchangeError,
  buildAuthorizeUrlForConnect,
  completeInstagramConnection,
  loadAppCredentials,
  refreshExpiringInstagramTokens,
} = await import("@/lib/instagram/backend/instagram-oauth-service");

describe("loadAppCredentials / buildAuthorizeUrlForConnect", () => {
  const originalAppId = process.env.INSTAGRAM_APP_ID;
  const originalAppSecret = process.env.INSTAGRAM_APP_SECRET;

  afterEach(() => {
    process.env.INSTAGRAM_APP_ID = originalAppId;
    process.env.INSTAGRAM_APP_SECRET = originalAppSecret;
    buildInstagramAuthorizeUrlMock.mockReset();
  });

  it("lança InstagramOAuthConfigError quando faltam as credenciais do app", () => {
    delete process.env.INSTAGRAM_APP_ID;
    delete process.env.INSTAGRAM_APP_SECRET;

    expect(() => loadAppCredentials()).toThrow(InstagramOAuthConfigError);
  });

  it("monta a URL de autorização quando as credenciais existem", () => {
    process.env.INSTAGRAM_APP_ID = "app-1";
    process.env.INSTAGRAM_APP_SECRET = "secret-1";
    buildInstagramAuthorizeUrlMock.mockReturnValue("https://www.instagram.com/oauth/authorize?ok=1");

    const url = buildAuthorizeUrlForConnect("https://alilu.com.br/cb", "state-1");

    expect(buildInstagramAuthorizeUrlMock).toHaveBeenCalledWith({
      appId: "app-1",
      redirectUri: "https://alilu.com.br/cb",
      state: "state-1",
    });
    expect(url).toBe("https://www.instagram.com/oauth/authorize?ok=1");
  });
});

describe("completeInstagramConnection", () => {
  const originalAppId = process.env.INSTAGRAM_APP_ID;
  const originalAppSecret = process.env.INSTAGRAM_APP_SECRET;

  beforeEach(() => {
    process.env.INSTAGRAM_APP_ID = "app-1";
    process.env.INSTAGRAM_APP_SECRET = "secret-1";
    exchangeCodeForShortLivedTokenMock.mockReset();
    exchangeForLongLivedTokenMock.mockReset();
    fetchInstagramProfileMock.mockReset();
    upsertInstagramAccountMock.mockReset();
    encryptSecretMock.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env.INSTAGRAM_APP_ID = originalAppId;
    process.env.INSTAGRAM_APP_SECRET = originalAppSecret;
    vi.restoreAllMocks();
  });

  const input = { userId: "user-1", redirectUri: "https://alilu.com.br/cb", code: "code-1" };

  it("lança InstagramOAuthConfigError quando faltam as credenciais do app, sem chamar a Meta", async () => {
    delete process.env.INSTAGRAM_APP_ID;

    await expect(completeInstagramConnection(input)).rejects.toThrow(InstagramOAuthConfigError);
    expect(exchangeCodeForShortLivedTokenMock).not.toHaveBeenCalled();
  });

  it("lança InstagramOAuthExchangeError quando a troca do código falha", async () => {
    exchangeCodeForShortLivedTokenMock.mockRejectedValue(new FakeInstagramGraphApiError("falhou"));

    await expect(completeInstagramConnection(input)).rejects.toThrow(InstagramOAuthExchangeError);
    expect(exchangeForLongLivedTokenMock).not.toHaveBeenCalled();
  });

  it("classifica bloqueio de App Review/Developer Role na troca do código", async () => {
    exchangeCodeForShortLivedTokenMock.mockRejectedValue(
      new FakeInstagramGraphApiError("falhou", { error: { code: 10, message: "Insufficient developer role" } }),
    );

    await expect(completeInstagramConnection(input)).rejects.toMatchObject({ reason: "meta_review" });
    expect(exchangeForLongLivedTokenMock).not.toHaveBeenCalled();
  });

  it("lança InstagramOAuthExchangeError quando a troca pelo token de longa duração falha", async () => {
    exchangeCodeForShortLivedTokenMock.mockResolvedValue({
      accessToken: "short-token",
      igUserId: "178414000",
      permissions: ["instagram_business_basic"],
    });
    exchangeForLongLivedTokenMock.mockRejectedValue(new FakeInstagramGraphApiError("falhou"));

    await expect(completeInstagramConnection(input)).rejects.toThrow(InstagramOAuthExchangeError);
    expect(upsertInstagramAccountMock).not.toHaveBeenCalled();
  });

  it("segue com fallback (username null) quando a busca do perfil falha", async () => {
    exchangeCodeForShortLivedTokenMock.mockResolvedValue({
      accessToken: "short-token",
      igUserId: "178414000",
      permissions: ["instagram_business_basic", "instagram_business_content_publish"],
    });
    exchangeForLongLivedTokenMock.mockResolvedValue({ accessToken: "long-token", expiresInSeconds: 5184000 });
    fetchInstagramProfileMock.mockRejectedValue(new FakeInstagramGraphApiError("falhou"));
    encryptSecretMock.mockReturnValue("iv.tag.cipher");
    upsertInstagramAccountMock.mockResolvedValue({ id: "account-1" });

    const result = await completeInstagramConnection(input);

    expect(encryptSecretMock).toHaveBeenCalledWith("long-token");
    expect(upsertInstagramAccountMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        igUserId: "178414000",
        igUsername: null,
        accessTokenEncrypted: "iv.tag.cipher",
        scopes: ["instagram_business_basic", "instagram_business_content_publish"],
      }),
    );
    expect(result).toEqual({ id: "account-1" });
  });

  it("caminho de sucesso completo grava a conta com username e expiração calculada", async () => {
    exchangeCodeForShortLivedTokenMock.mockResolvedValue({
      accessToken: "short-token",
      igUserId: "178414000",
      permissions: ["instagram_business_basic", "instagram_business_content_publish"],
    });
    exchangeForLongLivedTokenMock.mockResolvedValue({ accessToken: "long-token", expiresInSeconds: 5184000 });
    fetchInstagramProfileMock.mockResolvedValue({ igUserId: "178414000", username: "alilu.tec" });
    encryptSecretMock.mockReturnValue("iv.tag.cipher");
    upsertInstagramAccountMock.mockResolvedValue({ id: "account-1", igUsername: "alilu.tec" });

    const before = Date.now();
    await completeInstagramConnection(input);
    const after = Date.now();

    const call = upsertInstagramAccountMock.mock.calls[0][0];
    expect(call.igUsername).toBe("alilu.tec");
    expect(call.scopes).toEqual(["instagram_business_basic", "instagram_business_content_publish"]);
    expect(call.tokenExpiresAt.getTime()).toBeGreaterThanOrEqual(before + 5184000 * 1000);
    expect(call.tokenExpiresAt.getTime()).toBeLessThanOrEqual(after + 5184000 * 1000);
  });

  it("conta pessoal (não profissional): não grava e explica o motivo", async () => {
    exchangeCodeForShortLivedTokenMock.mockResolvedValue({ accessToken: "s", igUserId: "1", permissions: ["instagram_business_basic", "instagram_business_content_publish"] });
    exchangeForLongLivedTokenMock.mockResolvedValue({ accessToken: "l", expiresInSeconds: 5184000 });
    fetchInstagramProfileMock.mockResolvedValue({ igUserId: "1", username: "pessoal", accountType: "PERSONAL" });
    await expect(completeInstagramConnection(input)).rejects.toMatchObject({ reason: "not_professional" });
    expect(upsertInstagramAccountMock).not.toHaveBeenCalled();
  });

  it("permissão de publicar desmarcada: não grava", async () => {
    exchangeCodeForShortLivedTokenMock.mockResolvedValue({ accessToken: "s", igUserId: "1", permissions: ["instagram_business_basic"] });
    await expect(completeInstagramConnection(input)).rejects.toMatchObject({ reason: "missing_publish_permission" });
    expect(exchangeForLongLivedTokenMock).not.toHaveBeenCalled();
  });

  it("Criador (MEDIA_CREATOR) e Empresa (BUSINESS) são aceitas", async () => {
    for (const accountType of ["MEDIA_CREATOR", "BUSINESS"]) {
      exchangeCodeForShortLivedTokenMock.mockResolvedValue({ accessToken: "s", igUserId: "1", permissions: ["instagram_business_basic", "instagram_business_content_publish"] });
      exchangeForLongLivedTokenMock.mockResolvedValue({ accessToken: "l", expiresInSeconds: 5184000 });
      fetchInstagramProfileMock.mockResolvedValue({ igUserId: "1", username: "x", accountType });
      encryptSecretMock.mockReturnValue("enc");
      upsertInstagramAccountMock.mockResolvedValue({ id: "a" });
      await expect(completeInstagramConnection(input)).resolves.toEqual({ id: "a" });
    }
  });
});

describe("refreshExpiringInstagramTokens", () => {
  beforeEach(() => {
    Object.values(repoMocks).forEach((mock) => mock.mockReset());
    refreshLongLivedTokenMock.mockReset();
    encryptSecretMock.mockReset();
  });

  it("renova o token perto de vencer e marca como expirada a conta que a Meta recusa (190)", async () => {
    const now = new Date("2026-10-04T12:00:00Z");
    repoMocks.markExpiredInstagramAccounts.mockResolvedValue(1);
    repoMocks.listAccountsNeedingTokenRefresh.mockResolvedValue([
      { id: "a1", userId: "u1", accessTokenEncrypted: "enc1" },
      { id: "a2", userId: "u2", accessTokenEncrypted: "enc2" },
    ]);
    refreshLongLivedTokenMock
      .mockResolvedValueOnce({ accessToken: "novo", expiresInSeconds: 5184000 })
      .mockRejectedValueOnce(new FakeInstagramGraphApiError("x", { error: { code: 190, message: "Error validating access token" } }));
    encryptSecretMock.mockReturnValue("enc-novo");

    const result = await refreshExpiringInstagramTokens({ now });

    expect(result).toEqual({ refreshed: 1, failed: 1, expired: 1 });
    expect(refreshLongLivedTokenMock).toHaveBeenCalledWith("plain:enc1");
    expect(repoMocks.updateInstagramAccountToken).toHaveBeenCalledWith("a1", "enc-novo", new Date(now.getTime() + 5184000 * 1000));
    expect(repoMocks.setInstagramAccountStatus).toHaveBeenCalledWith("a2", "expired");
  });
});
