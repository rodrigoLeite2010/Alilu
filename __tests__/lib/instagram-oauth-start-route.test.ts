// @vitest-environment node
//
// Início do OAuth: login exigido, domínio canônico (cookie de state não se
// perde entre www/sem www), state assinado no cookie e ponte no browser.
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: (...args: unknown[]) => authMock(...args) }));
vi.mock("@/lib/instagram/backend/oauth-log", () => ({
  logInstagramOAuth: vi.fn(async () => undefined),
}));
const getInstagramAccountByIdForUserMock = vi.fn();
vi.mock("@/lib/instagram/backend/instagram-account-repository", () => ({
  getInstagramAccountByIdForUser: (...args: unknown[]) =>
    getInstagramAccountByIdForUserMock(...args),
}));

class FakeInstagramOAuthConfigError extends Error {}
const buildAuthorizeUrlForConnectMock = vi.fn();
vi.mock("@/lib/instagram/backend/instagram-oauth-service", () => ({
  InstagramOAuthConfigError: FakeInstagramOAuthConfigError,
  buildAuthorizeUrlForConnect: (...args: unknown[]) =>
    buildAuthorizeUrlForConnectMock(...args),
}));

const { GET } = await import("@/app/api/instagram/oauth/start/route");
const { verifySignedOAuthState } = await import(
  "@/lib/instagram/backend/oauth-state"
);

function request(
  url = "https://alilu.com.br/api/instagram/oauth/start",
): Request {
  return new Request(url);
}

describe("GET /api/instagram/oauth/start", () => {
  beforeEach(() => {
    authMock.mockReset();
    buildAuthorizeUrlForConnectMock.mockReset();
    getInstagramAccountByIdForUserMock.mockReset();
    process.env.AUTH_SECRET = "segredo-de-teste-para-o-state-oauth";
    delete process.env.INSTAGRAM_OAUTH_REDIRECT_URI;
    vi.stubEnv("VERCEL_ENV", "production");
  });

  it("sem login: manda entrar e volta para a área Instagram", async () => {
    authMock.mockResolvedValue(null);
    const response = await GET(
      request(
        "https://alilu.com.br/api/instagram/oauth/start?returnTo=%2Finstagram%2Freels",
      ),
    );
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe("/entrar");
    expect(location.searchParams.get("callbackUrl")).toBe("/instagram/reels");
  });

  it("www → domínio canônico antes de começar (mesmo host do redirect_uri)", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    const response = await GET(
      request(
        "https://www.alilu.com.br/api/instagram/oauth/start?returnTo=%2Finstagram",
      ),
    );
    expect(response.headers.get("location")).toBe(
      "https://alilu.com.br/api/instagram/oauth/start?returnTo=%2Finstagram",
    );
    expect(buildAuthorizeUrlForConnectMock).not.toHaveBeenCalled();
  });

  it("app não configurado: tela amigável, nunca JSON técnico", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    buildAuthorizeUrlForConnectMock.mockImplementation(() => {
      throw new FakeInstagramOAuthConfigError("não configurado");
    });
    const response = await GET(request());
    expect(response.headers.get("location")).toBe(
      "https://alilu.com.br/instagram/conectado?resultado=indisponivel",
    );
  });

  it("navega pelo browser à Meta e grava os cookies antes da autorização", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    buildAuthorizeUrlForConnectMock.mockImplementation(
      (uri: string, state: string) =>
        `https://www.instagram.com/oauth/authorize?state=${state}`,
    );
    const response = await GET(
      request(
        "https://alilu.com.br/api/instagram/oauth/start?returnTo=%2Finstagram%2Fposts-virais",
      ),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.text()).toContain("window.location.replace");
    const [redirectUri, state] = buildAuthorizeUrlForConnectMock.mock.calls[0];
    expect(redirectUri).toBe(
      "https://alilu.com.br/api/instagram/oauth/callback",
    );
    expect(verifySignedOAuthState(state, "user-1")).toBe("ok");
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`ig_oauth_state=${state}`);
    expect(setCookie).toContain("ig_oauth_correlation=");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Path=/api/instagram/oauth");
    expect(setCookie).toContain("ig_oauth_return=%2Finstagram%2Fposts-virais");
  });

  it("amarra reconexão ao Instagram User ID da conta selecionada", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    getInstagramAccountByIdForUserMock.mockResolvedValue({
      id: "account-1",
      userId: "user-1",
      igUserId: "17841400000000001",
      igUsername: "alilu.tec",
    });
    buildAuthorizeUrlForConnectMock.mockImplementation(
      (uri: string, state: string) =>
        `https://www.instagram.com/oauth/authorize?state=${state}`,
    );
    const response = await GET(
      request(
        "https://alilu.com.br/api/instagram/oauth/start?accountId=account-1&returnTo=%2Finstagram%2Fpainel",
      ),
    );
    expect(response.status).toBe(200);
    expect(getInstagramAccountByIdForUserMock).toHaveBeenCalledWith(
      "account-1",
      "user-1",
    );
    const [, state, options] = buildAuthorizeUrlForConnectMock.mock.calls[0];
    expect(options).toMatchObject({ forceReauth: false });
    expect(verifySignedOAuthState(state, "user-1")).toBe("ok");
    const { getExpectedInstagramUserId } = await import(
      "@/lib/instagram/backend/oauth-state"
    );
    expect(getExpectedInstagramUserId(state, "user-1")).toBe(
      "17841400000000001",
    );
  });

  it("não inicia OAuth para uma conexão que pertence a outra pessoa ou não existe", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    getInstagramAccountByIdForUserMock.mockResolvedValue(null);
    const response = await GET(
      request(
        "https://alilu.com.br/api/instagram/oauth/start?accountId=foreign-account",
      ),
    );
    expect(response.headers.get("location")).toContain(
      "resultado=conta-nao-encontrada",
    );
    expect(buildAuthorizeUrlForConnectMock).not.toHaveBeenCalled();
  });

  it("força novo login só ao adicionar outra conta, sem alvo de reconexão", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    buildAuthorizeUrlForConnectMock.mockImplementation(
      (uri: string, state: string) =>
        `https://www.instagram.com/oauth/authorize?state=${state}`,
    );
    const response = await GET(
      request("https://alilu.com.br/api/instagram/oauth/start?addAccount=1"),
    );
    expect(response.status).toBe(200);
    expect(buildAuthorizeUrlForConnectMock.mock.calls[0][2]).toMatchObject({
      forceReauth: true,
    });
  });
});
