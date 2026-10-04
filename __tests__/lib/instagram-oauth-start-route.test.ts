// @vitest-environment node
//
// Início do OAuth: login exigido, domínio canônico (cookie de state não se
// perde entre www/sem www), state assinado no cookie e redirect normal.
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: (...args: unknown[]) => authMock(...args) }));
vi.mock("@/lib/instagram/backend/oauth-log", () => ({ logInstagramOAuth: vi.fn(async () => undefined) }));

class FakeInstagramOAuthConfigError extends Error {}
const buildAuthorizeUrlForConnectMock = vi.fn();
vi.mock("@/lib/instagram/backend/instagram-oauth-service", () => ({
  InstagramOAuthConfigError: FakeInstagramOAuthConfigError,
  buildAuthorizeUrlForConnect: (...args: unknown[]) => buildAuthorizeUrlForConnectMock(...args),
}));

const { GET } = await import("@/app/api/instagram/oauth/start/route");
const { verifySignedOAuthState } = await import("@/lib/instagram/backend/oauth-state");

function request(url = "https://alilu.com.br/api/instagram/oauth/start"): Request {
  return new Request(url);
}

describe("GET /api/instagram/oauth/start", () => {
  beforeEach(() => {
    authMock.mockReset();
    buildAuthorizeUrlForConnectMock.mockReset();
    process.env.AUTH_SECRET = "segredo-de-teste-para-o-state-oauth";
    delete process.env.INSTAGRAM_OAUTH_REDIRECT_URI;
    vi.stubEnv("VERCEL_ENV", "production");
  });

  it("sem login: manda entrar e volta para a área Instagram", async () => {
    authMock.mockResolvedValue(null);
    const response = await GET(request("https://alilu.com.br/api/instagram/oauth/start?returnTo=%2Finstagram%2Freels"));
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe("/entrar");
    expect(location.searchParams.get("callbackUrl")).toBe("/instagram/reels");
  });

  it("www → domínio canônico antes de começar (mesmo host do redirect_uri)", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    const response = await GET(request("https://www.alilu.com.br/api/instagram/oauth/start?returnTo=%2Finstagram"));
    expect(response.headers.get("location")).toBe("https://alilu.com.br/api/instagram/oauth/start?returnTo=%2Finstagram");
    expect(buildAuthorizeUrlForConnectMock).not.toHaveBeenCalled();
  });

  it("app não configurado: tela amigável, nunca JSON técnico", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    buildAuthorizeUrlForConnectMock.mockImplementation(() => {
      throw new FakeInstagramOAuthConfigError("não configurado");
    });
    const response = await GET(request());
    expect(response.headers.get("location")).toBe("https://alilu.com.br/instagram/conectado?resultado=indisponivel");
  });

  it("redireciona para a Meta com redirect_uri fixo e grava o state assinado no cookie", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    buildAuthorizeUrlForConnectMock.mockImplementation((uri: string, state: string) => `https://www.instagram.com/oauth/authorize?state=${state}`);
    const response = await GET(request("https://alilu.com.br/api/instagram/oauth/start?returnTo=%2Finstagram%2Fposts-virais"));
    expect(response.status).toBe(307);
    const [redirectUri, state] = buildAuthorizeUrlForConnectMock.mock.calls[0];
    expect(redirectUri).toBe("https://alilu.com.br/api/instagram/oauth/callback");
    expect(verifySignedOAuthState(state, "user-1")).toBe("ok");
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`ig_oauth_state=${state}`);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Path=/api/instagram/oauth");
    expect(setCookie).toContain("ig_oauth_return=%2Finstagram%2Fposts-virais");
  });
});
