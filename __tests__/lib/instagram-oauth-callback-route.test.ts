// @vitest-environment node
//
// Callback do OAuth: sempre termina em /instagram/conectado com um resultado
// amigável (nunca texto técnico da Meta), valida state assinado + cookie.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: (...args: unknown[]) => authMock(...args) }));
const logMock = vi.fn(async () => undefined);
vi.mock("@/lib/instagram/backend/oauth-log", () => ({ logInstagramOAuth: (...args: unknown[]) => logMock(...(args as [])) }));

class FakeInstagramOAuthConfigError extends Error {}
class FakeInstagramOAuthExchangeError extends Error {
  constructor(message: string, readonly reason: string) {
    super(message);
  }
}
const completeInstagramConnectionMock = vi.fn();
vi.mock("@/lib/instagram/backend/instagram-oauth-service", () => ({
  InstagramOAuthConfigError: FakeInstagramOAuthConfigError,
  InstagramOAuthExchangeError: FakeInstagramOAuthExchangeError,
  completeInstagramConnection: (...args: unknown[]) => completeInstagramConnectionMock(...args),
}));

const { GET } = await import("@/app/api/instagram/oauth/callback/route");
const { generateOAuthState } = await import("@/lib/instagram/backend/oauth-state");

function request(path: string, cookie?: string): NextRequest {
  return new NextRequest(new Request(`https://alilu.com.br${path}`, cookie ? { headers: { cookie } } : undefined));
}
function result(response: Response) {
  const location = new URL(response.headers.get("location") ?? "");
  return { path: location.pathname, resultado: location.searchParams.get("resultado"), continuar: location.searchParams.get("continuar"), all: location.toString() };
}

describe("GET /api/instagram/oauth/callback", () => {
  beforeEach(() => {
    authMock.mockReset();
    completeInstagramConnectionMock.mockReset();
    logMock.mockClear();
    process.env.AUTH_SECRET = "segredo-de-teste-para-o-state-oauth";
    vi.stubEnv("VERCEL_ENV", "production");
  });

  it("usuário cancelou: tela 'cancelado', sem trocar código", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    const response = await GET(request("/api/instagram/oauth/callback?error=access_denied&error_reason=user_denied&error_description=The+user+denied"));
    expect(result(response)).toMatchObject({ path: "/instagram/conectado", resultado: "cancelado" });
    expect(completeInstagramConnectionMock).not.toHaveBeenCalled();
  });

  it("erro técnico da Meta: tela genérica; o texto técnico só vai para o log", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    const response = await GET(request("/api/instagram/oauth/callback?error=invalid_request&error_description=Insufficient+developer+role"));
    const r = result(response);
    expect(r.resultado).toBe("erro");
    expect(r.all).not.toContain("developer");
    expect(JSON.stringify(logMock.mock.calls)).toContain("Insufficient developer role");
  });

  it("sem sessão (voltou em outro navegador): pede para entrar, não conecta", async () => {
    authMock.mockResolvedValue(null);
    const response = await GET(request("/api/instagram/oauth/callback?code=abc&state=x"));
    expect(result(response).resultado).toBe("sessao");
    expect(completeInstagramConnectionMock).not.toHaveBeenCalled();
  });

  it("state de outro usuário ou diferente do cookie: recusa", async () => {
    authMock.mockResolvedValue({ user: { id: "vitima" } });
    const alheio = generateOAuthState("atacante");
    expect(result(await GET(request(`/api/instagram/oauth/callback?code=abc&state=${alheio}`))).resultado).toBe("erro");
    const meu = generateOAuthState("vitima");
    const outro = generateOAuthState("vitima");
    expect(result(await GET(request(`/api/instagram/oauth/callback?code=abc&state=${meu}`, `ig_oauth_state=${outro}`))).resultado).toBe("erro");
    expect(completeInstagramConnectionMock).not.toHaveBeenCalled();
  });

  it("sucesso com cookie: conecta com o redirect_uri fixo e volta para a tela de sucesso com 'continuar'", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    completeInstagramConnectionMock.mockResolvedValue({ id: "account-1" });
    const state = generateOAuthState("user-1");
    const response = await GET(
      request(`/api/instagram/oauth/callback?code=abc&state=${state}`, `ig_oauth_state=${state}; ig_oauth_return=%2Finstagram%2Freels`),
    );
    expect(result(response)).toMatchObject({ path: "/instagram/conectado", resultado: "sucesso", continuar: "/instagram/reels" });
    expect(completeInstagramConnectionMock).toHaveBeenCalledWith({ userId: "user-1", redirectUri: "https://alilu.com.br/api/instagram/oauth/callback", code: "abc" });
    const setCookie = (response.headers.get("set-cookie") ?? "").toLowerCase();
    expect(setCookie).toContain("ig_oauth_state=");
    expect(setCookie).toContain("expires=thu, 01 jan 1970");
  });

  it("sucesso sem cookie (celular voltou em outra aba) mas logado como o mesmo usuário: aceita", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    completeInstagramConnectionMock.mockResolvedValue({ id: "account-1" });
    const response = await GET(request(`/api/instagram/oauth/callback?code=abc&state=${generateOAuthState("user-1")}`));
    expect(result(response).resultado).toBe("sucesso");
  });

  it("conta pessoal e permissão de publicar negada viram telas específicas", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    completeInstagramConnectionMock.mockRejectedValueOnce(new FakeInstagramOAuthExchangeError("x", "not_professional"));
    let state = generateOAuthState("user-1");
    expect(result(await GET(request(`/api/instagram/oauth/callback?code=abc&state=${state}`))).resultado).toBe("conta-nao-profissional");
    completeInstagramConnectionMock.mockRejectedValueOnce(new FakeInstagramOAuthExchangeError("x", "missing_publish_permission"));
    state = generateOAuthState("user-1");
    expect(result(await GET(request(`/api/instagram/oauth/callback?code=abc&state=${state}`))).resultado).toBe("sem-permissao");
  });

  it("erro inesperado: genérico, sem detalhe interno na URL", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    completeInstagramConnectionMock.mockRejectedValue(new Error("detalhe interno sensível"));
    const r = result(await GET(request(`/api/instagram/oauth/callback?code=abc&state=${generateOAuthState("user-1")}`)));
    expect(r.resultado).toBe("erro");
    expect(r.all).not.toContain("sens");
  });
});
